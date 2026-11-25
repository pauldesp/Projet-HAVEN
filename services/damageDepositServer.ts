import type { Firestore } from 'firebase-admin/firestore';
import type Stripe from 'stripe';
import type { Booking, BookingSeries, DamageClaim } from '../types';
import { CONNECT_POLICY_VERSION } from './stripeConnect';
import { CONNECT_ON_BEHALF_POLICY, isOnBehalfPolicy, onBehalfChargeData } from './onBehalfPayments';
import { damageMailId, damageMailJob } from './damageMail';
import { DamageClaimError, canDeclareDamage, damageClaimDeadline, validateDamageClaimInput, validateDamageDecision, validateDamageResponse } from './damageDeposit';

export interface DamageDepositDependencies {
  db: Firestore;
  stripe: () => Stripe;
  /** 'SIMULATION' in local development without Stripe. */
  paymentMode: () => 'SIMULATION' | 'STRIPE';
  isTestMode: () => boolean;
  payoutAccount: (ownerId: string) => Promise<{ accountId: string; ready: boolean; onBehalf?: boolean } | null>;
  /** Wakes the mail outbox up after a message was queued. */
  notifyMail?: () => void;
}
type Admin = { uid: string; name: string };

/** Caution : carte gardée, déclaration du propriétaire, réponse du locataire, décision et prélèvement par Haven. */
export function createDamageDeposit(deps: DamageDepositDependencies) {
  const { db } = deps;
  const claims = db.collection('damage_claims');
  const cards = db.collection('deposit_cards');
  const bookings = db.collection('bookings');
  const outbox = db.collection('reservation_mail_outbox');

  /** After a single stay is paid: keeps the card Stripe saved for the deposit (series keep theirs on the series). */
  async function saveCard(booking: Booking, session: Pick<Stripe.Checkout.Session, 'payment_intent'>) {
    if (booking.seriesId || !booking.depositConsent) return;
    const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!intentId || (await cards.doc(booking.id).get()).exists) return;
    const intent = await deps.stripe().paymentIntents.retrieve(intentId, { expand: ['payment_method'] });
    const method = intent.payment_method;
    const customer = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
    if (!customer || !method || typeof method === 'string') return;
    await cards.doc(booking.id).set({ bookingId: booking.id, tenantId: booking.tenantId, stripeCustomerId: customer, paymentMethodId: method.id,
      cardBrand: method.card?.brand || '', cardLast4: method.card?.last4 || '', isTest: !intent.livemode, savedAt: new Date().toISOString() });
  }

  async function cardFor(booking: Booking) {
    if (booking.seriesId) {
      const series = (await db.collection('booking_series').doc(booking.seriesId).get()).data() as BookingSeries | undefined;
      return series?.stripeCustomerId && series.paymentMethodId ? { customer: series.stripeCustomerId, method: series.paymentMethodId } : null;
    }
    const saved = (await cards.doc(booking.id).get()).data();
    return saved?.stripeCustomerId && saved.paymentMethodId ? { customer: String(saved.stripeCustomerId), method: String(saved.paymentMethodId) } : null;
  }

  /** By the owner, or by Haven on the owner's behalf (`declaredBy`), e.g. from a report by the next tenant. */
  async function declare(ownerId: string, bookingId: string, body: Record<string, unknown>, declaredBy?: { adminId: string; adminName: string; reportId?: string }) {
    const input = validateDamageClaimInput(body);
    const at = new Date().toISOString();
    return db.runTransaction(async transaction => {
      const [bookingSnap, existing] = await Promise.all([transaction.get(bookings.doc(bookingId)), transaction.get(claims.doc(bookingId))]);
      const booking = bookingSnap.exists ? { ...bookingSnap.data(), id: bookingSnap.id } as Booking : null;
      if (!booking || booking.ownerId !== ownerId) throw new DamageClaimError('Réservation introuvable.', 404);
      if (existing.exists) throw new DamageClaimError('Une dégradation a déjà été déclarée pour ce séjour. Complétez-la en écrivant à Haven.', 409);
      if (!booking.depositConsent) throw new DamageClaimError('Ce séjour a été réservé avant la mise en place de la caution : signalez la dégradation à Haven depuis l’aide.', 409);
      if (!canDeclareDamage(booking)) throw new DamageClaimError(`La déclaration est possible du jour du départ au ${damageClaimDeadline(booking)} inclus.`, 409);
      const claim: DamageClaim = {
        id: bookingId, bookingId, listingId: booking.listingId, listingTitle: booking.listingTitle || 'Logement', ownerId, tenantId: booking.tenantId,
        stayEndDate: booking.endDate, requestedCents: input.amountCents, description: input.description, photos: input.photos, createdAt: at, status: 'SUBMITTED',
        ...(declaredBy ? { declaredBy } : {}),
      };
      transaction.create(claims.doc(bookingId), claim);
      // The tenant is told at once, with the date until which they can answer; the team is alerted.
      for (const event of ['CLAIM_OPENED', 'TEAM_NEW_CLAIM'] as const) transaction.create(outbox.doc(damageMailId(event, bookingId)), damageMailJob(event, bookingId, at));
      return claim;
    }).then(claim => { deps.notifyMail?.(); return claim; });
  }

  async function respond(tenantId: string, bookingId: string, value: unknown) {
    const text = validateDamageResponse(value);
    return db.runTransaction(async transaction => {
      const snap = await transaction.get(claims.doc(bookingId));
      const claim = snap.data() as DamageClaim | undefined;
      if (!claim || claim.tenantId !== tenantId) throw new DamageClaimError('Déclaration introuvable.', 404);
      if (claim.status !== 'SUBMITTED') throw new DamageClaimError('Haven a déjà rendu sa décision.', 409);
      if (claim.tenantResponse) throw new DamageClaimError('Vous avez déjà répondu. Écrivez à Haven pour compléter.', 409);
      const tenantResponse = { text, at: new Date().toISOString() };
      transaction.update(claims.doc(bookingId), { tenantResponse });
      return { ...claim, tenantResponse };
    });
  }

  async function listForMember(uid: string) {
    const [asOwner, asTenant] = await Promise.all([claims.where('ownerId', '==', uid).get(), claims.where('tenantId', '==', uid).get()]);
    // Payment and transfer details stay with Haven: members only see the status and the decision.
    return [...asOwner.docs, ...asTenant.docs].map(doc => {
      const { charge: _charge, transfer: _transfer, ...claim } = doc.data() as DamageClaim;
      return claim;
    });
  }

  const listAll = async () => (await claims.orderBy('createdAt', 'desc').limit(200).get()).docs.map(doc => doc.data() as DamageClaim);

  async function decide(admin: Admin, bookingId: string, body: Record<string, unknown>) {
    const at = new Date().toISOString();
    const decision = await db.runTransaction(async transaction => {
      const snap = await transaction.get(claims.doc(bookingId));
      if (!snap.exists) throw new DamageClaimError('Déclaration introuvable.', 404);
      const result = validateDamageDecision(snap.data() as DamageClaim, body);
      transaction.update(claims.doc(bookingId), {
        status: result.decision === 'REJECT' ? 'REJECTED' : 'CHARGING',
        decision: { amountCents: result.amountCents, note: result.note, at, adminId: admin.uid, adminName: admin.name },
      });
      for (const event of ['DECISION_TENANT', 'DECISION_OWNER'] as const) transaction.set(outbox.doc(damageMailId(event, bookingId)), damageMailJob(event, bookingId, at));
      return result;
    });
    deps.notifyMail?.();
    if (decision.decision === 'APPROVE') await charge(bookingId);
    return (await claims.doc(bookingId).get()).data() as DamageClaim;
  }

  /** Charges the tenant's saved card off-session, then hands the amount to the owner. */
  async function charge(bookingId: string) {
    const claim = (await claims.doc(bookingId).get()).data() as DamageClaim | undefined;
    if (!claim || claim.status !== 'CHARGING' || !claim.decision) return;
    const booking = (await bookings.doc(bookingId).get()).data() as Booking | undefined;
    const attempts = (claim.charge?.attempts || 0) + 1;
    const at = new Date().toISOString();
    const fail = (error: string) => claims.doc(bookingId).update({ status: 'CHARGE_FAILED', charge: { ...claim.charge, provider: 'STRIPE', attempts, error, at, isTest: deps.isTestMode() } });
    if (!booking) return fail('Réservation introuvable.');
    if (booking.paymentProvider === 'SIMULATION') {
      await claims.doc(bookingId).update({ status: 'CHARGED', charge: { provider: 'SIMULATION', attempts, at, isTest: true }, transfer: { status: 'SIMULATED', at } });
      return;
    }
    if (deps.paymentMode() !== 'STRIPE' || booking.paymentIsTest !== deps.isTestMode()) return fail('Les clés Stripe actuelles ne correspondent pas au mode de paiement de ce séjour.');
    const card = await cardFor({ ...booking, id: bookingId });
    if (!card) return fail('Aucune carte enregistrée pour ce séjour.');
    // A stay paid on the owner's behalf: the damage charge goes straight to the owner, without any Haven fee.
    let owner: { accountId: string; ready: boolean; onBehalf?: boolean } | null = null;
    if (isOnBehalfPolicy(booking.connectPolicy)) { try { owner = await deps.payoutAccount(claim.ownerId); } catch { owner = null; } }
    const onBehalf = Boolean(owner?.ready && owner.onBehalf);
    let intent: Stripe.PaymentIntent;
    try {
      intent = await deps.stripe().paymentIntents.create({
        amount: claim.decision.amountCents, currency: 'eur', customer: card.customer, payment_method: card.method, off_session: true, confirm: true,
        transfer_group: `haven_damage_${bookingId}`, description: `Caution · dégradation · ${claim.listingTitle} · séjour terminé le ${claim.stayEndDate}`,
        ...(onBehalf ? onBehalfChargeData(owner!.accountId, 0) : {}),
        metadata: { bookingId, damageClaim: '1', ownerId: claim.ownerId, connectPolicy: onBehalf ? CONNECT_ON_BEHALF_POLICY : CONNECT_POLICY_VERSION },
      }, { idempotencyKey: `damage-${bookingId}-${attempts}` });
    } catch (error) {
      const stripeError = error as { type?: string; code?: string };
      return fail(stripeError.code === 'authentication_required' ? 'La banque du locataire demande une confirmation : contactez-le pour un paiement manuel.'
        : stripeError.type === 'StripeCardError' ? 'Carte refusée (expirée, opposée ou provision insuffisante).' : 'Prélèvement momentanément impossible, réessayez.');
    }
    if (intent.status !== 'succeeded') return fail('Le prélèvement n’a pas abouti.');
    if (onBehalf) {
      // Already on the owner's balance: it is paid out to the bank with their next payout.
      await claims.doc(bookingId).update({ status: 'CHARGED', charge: { provider: 'STRIPE', paymentIntentId: intent.id, attempts, at, isTest: !intent.livemode, onBehalfOf: owner!.accountId }, transfer: { status: 'DONE', onBehalf: true, at } });
      // Owner accounts pay out manually: queue the bank payout of this amount (made once Stripe makes the funds available).
      await db.collection('owner_damage_payouts').doc(`damage_${bookingId}`).set({ bookingId, ownerId: claim.ownerId, accountId: owner!.accountId, mode: deps.isTestMode() ? 'test' : 'live',
        amountCents: claim.decision.amountCents, paymentIntentId: intent.id, state: 'WAITING_FUNDS', createdAt: at, updatedAt: at });
      return;
    }
    await claims.doc(bookingId).update({ status: 'CHARGED', charge: { provider: 'STRIPE', paymentIntentId: intent.id, attempts, at, isTest: !intent.livemode } });
    await transferToOwner(bookingId);
  }

  async function transferToOwner(bookingId: string) {
    const claim = (await claims.doc(bookingId).get()).data() as DamageClaim | undefined;
    if (!claim || claim.status !== 'CHARGED' || !claim.decision || claim.charge?.provider !== 'STRIPE' || !claim.charge.paymentIntentId) return;
    if (claim.transfer?.status === 'DONE') return;
    const at = new Date().toISOString();
    try {
      const account = await deps.payoutAccount(claim.ownerId);
      if (!account?.ready) { await claims.doc(bookingId).update({ transfer: { status: 'WAITING_ACCOUNT', at } }); return; }
      const intent = await deps.stripe().paymentIntents.retrieve(claim.charge.paymentIntentId);
      const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
      const transfer = await deps.stripe().transfers.create({
        amount: claim.decision.amountCents, currency: 'eur', destination: account.accountId, ...(chargeId ? { source_transaction: chargeId } : {}),
        transfer_group: `haven_damage_${bookingId}`, metadata: { bookingId, ownerId: claim.ownerId, damageClaim: '1' },
      }, { idempotencyKey: `haven-damage-transfer-${bookingId}` });
      await claims.doc(bookingId).update({ transfer: { status: 'DONE', transferId: transfer.id, at } });
    } catch {
      await claims.doc(bookingId).update({ transfer: { status: 'FAILED', error: 'Le versement au propriétaire n’a pas abouti, relancez-le.', at } });
    }
  }

  /** Back office: charge again after a refusal, or send the owner's share again. */
  async function retry(bookingId: string) {
    const claim = (await claims.doc(bookingId).get()).data() as DamageClaim | undefined;
    if (!claim) throw new DamageClaimError('Déclaration introuvable.', 404);
    if (claim.status === 'CHARGE_FAILED') {
      await claims.doc(bookingId).update({ status: 'CHARGING' });
      await charge(bookingId);
    } else if (claim.status === 'CHARGED' && claim.transfer?.status !== 'DONE' && claim.transfer?.status !== 'SIMULATED') {
      await transferToOwner(bookingId);
    } else throw new DamageClaimError('Rien à relancer pour cette déclaration.', 409);
    return (await claims.doc(bookingId).get()).data() as DamageClaim;
  }

  /** Runs with the Stripe reconciliation: transfers waiting for the owner's account are sent once it is ready. */
  async function sweep() {
    const waiting = await claims.where('status', '==', 'CHARGED').get();
    for (const doc of waiting.docs) {
      const status = (doc.data() as DamageClaim).transfer?.status;
      if (status === 'WAITING_ACCOUNT') await transferToOwner(doc.id).catch(() => undefined);
    }
  }

  return { saveCard, declare, respond, listForMember, listAll, decide, retry, sweep };
}
