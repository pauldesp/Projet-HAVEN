import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Booking, InventoryReport } from '../types';
import { CONNECT_POLICY_VERSION, connectStatus, hasRecordedArrival, ownerShareCents, payoutStatus, type OwnerConnectView } from './stripeConnect';

export class ConnectError extends Error { constructor(message: string, public status = 409) { super(message); } }
export function createStripeConnect(db: Firestore, stripe: () => Stripe, configuration: () => { enabled: boolean; isTest: boolean }) {
  const mode = () => configuration().isTest ? 'test' : 'live';
  const accountRef = (uid: string) => db.collection('owner_stripe_accounts').doc(`${mode()}_${uid}`);
  const unavailable = (): OwnerConnectView => ({ available: false, isTest: configuration().isTest, status: 'NOT_STARTED', checkedAt: null, bank: null });
  const assertEnabled = () => { if (!configuration().enabled) throw new ConnectError('La configuration des versements Stripe n’est pas encore activée sur Haven.', 503); };
  const accountOwner = async (id: string) => {
    const saved = await db.collection('stripe_account_owners').doc(`${mode()}_${id}`).get();
    return typeof saved.data()?.ownerId === 'string' ? saved.data()!.ownerId as string : null;
  };

  async function syncAccount(uid: string): Promise<OwnerConnectView> {
    if (!configuration().enabled) return unavailable();
    const ref = accountRef(uid), snapshot = await ref.get(), saved = snapshot.data();
    if (!saved?.accountId) return { ...unavailable(), available: true };
    const checkedAt = new Date().toISOString();
    const account = await stripe().accounts.retrieve(saved.accountId);
    if (account.metadata?.havenOwnerId !== uid || account.metadata?.havenMode !== mode()) throw new ConnectError('Le compte de versement ne correspond pas au propriétaire.', 403);
    const banks = await stripe().accounts.listExternalAccounts(account.id, { object: 'bank_account', limit: 10 });
    const bank = banks.data.find(item => item.object === 'bank_account' && item.currency === 'eur' && !['errored', 'verification_failed'].includes(item.status) && item.default_for_currency) || banks.data.find(item => item.object === 'bank_account' && item.currency === 'eur' && !['errored', 'verification_failed'].includes(item.status));
    const status = connectStatus(account);
    const view: OwnerConnectView = { available: true, isTest: configuration().isTest, status: status === 'READY' && !bank ? 'INCOMPLETE' : status, checkedAt,
      bank: bank?.object === 'bank_account' ? { last4: bank.last4, name: bank.bank_name || null, currency: bank.currency } : null };
    return db.runTransaction(async transaction => {
      const fresh = await transaction.get(ref);
      if (fresh.data()?.checkedAt > checkedAt) return fresh.data()!.view as OwnerConnectView;
      transaction.set(ref, { ownerId: uid, accountId: account.id, mode: mode(), checkedAt, view }, { merge: true });
      return view;
    });
  }

  async function onboarding(uid: string, email: string | undefined, origin: string) {
    assertEnabled();
    const ref = accountRef(uid);
    const snapshot = await ref.get();
    let id = snapshot.data()?.accountId as string | undefined;
    if (!id) {
      await db.runTransaction(async transaction => {
        const fresh = await transaction.get(ref);
        const attempted = fresh.data()?.creationAttemptAt;
        if (attempted && Date.now() - Date.parse(attempted) > 23 * 3600000) throw new ConnectError('La création du compte doit être vérifiée par Haven avant une nouvelle tentative.');
        transaction.set(ref, { ownerId: uid, mode: mode(), creationAttemptAt: attempted || new Date().toISOString() }, { merge: true });
      });
      const account = await stripe().accounts.create({
        ...(email ? { email } : {}),
        controller: { fees: { payer: 'application' }, losses: { payments: 'application' }, requirement_collection: 'stripe', stripe_dashboard: { type: 'express' } },
        capabilities: { transfers: { requested: true } },
        metadata: { havenOwnerId: uid, havenMode: mode() },
      }, { idempotencyKey: `haven-connect-account-${mode()}-${uid}` });
      await db.runTransaction(async transaction => {
        const fresh = await transaction.get(ref);
        if (fresh.data()?.accountId && fresh.data()!.accountId !== account.id) throw new ConnectError('Un compte de versement existe déjà. Actualisez la page.');
        const mapping = db.collection('stripe_account_owners').doc(`${mode()}_${account.id}`);
        const owner = await transaction.get(mapping);
        if (owner.exists && owner.data()?.ownerId !== uid) throw new ConnectError('Compte Stripe déjà associé.', 403);
        transaction.set(mapping, { ownerId: uid, accountId: account.id, mode: mode() });
        transaction.set(ref, { ownerId: uid, accountId: account.id, mode: mode(), createdAt: new Date().toISOString() }, { merge: true });
      });
      id = account.id;
    }
    const link = await stripe().accountLinks.create({ account: id, type: 'account_onboarding',
      return_url: `${origin}/#/owner/dashboard?stripe=return`, refresh_url: `${origin}/#/owner/dashboard?stripe=refresh`,
      collection_options: { fields: 'eventually_due' } });
    return { url: link.url };
  }

  async function dashboard(uid: string) {
    assertEnabled();
    const saved = await accountRef(uid).get();
    if (!saved.data()?.accountId) throw new ConnectError('Configurez d’abord vos versements.');
    const link = await stripe().accounts.createLoginLink(saved.data()!.accountId);
    return { url: link.url };
  }

  async function readyAccount(uid: string) {
    assertEnabled();
    const view = await syncAccount(uid);
    if (view.status !== 'READY' || !view.bank) throw new ConnectError('Le propriétaire doit terminer la configuration de ses versements avant de recevoir des réservations payantes.');
    return (await accountRef(uid).get()).data()!.accountId as string;
  }

  async function registerPayment(booking: Booking, session: Stripe.Checkout.Session) {
    if (session.metadata?.connectPolicy !== CONNECT_POLICY_VERSION) return; // Never transfer historical/legacy receipts.
    const destination = session.metadata?.ownerAccountId;
    if (!destination || await accountOwner(destination) !== booking.ownerId || booking.paymentStatus !== 'PAID' || booking.paymentProvider !== 'STRIPE' || (booking.checkoutSessionId || booking.stripeSessionId) !== session.id || session.livemode === configuration().isTest) throw new ConnectError('Destination ou paiement Stripe incohérent.');
    const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!intentId) throw new Error('Payment intent absent.');
    const intent = await stripe().paymentIntents.retrieve(intentId, { expand: ['latest_charge.balance_transaction'] });
    const charge = intent.latest_charge;
    if (intent.status !== 'succeeded' || typeof charge !== 'object' || !charge || !charge.paid || charge.currency !== 'eur' || charge.amount !== Math.round(booking.totalPrice * 100)) throw new Error('Encaissement Stripe non confirmé.');
    const ref = db.collection('owner_settlements').doc(booking.id);
    const providerFee = typeof charge.balance_transaction === 'object' ? charge.balance_transaction?.fee : undefined;
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists) {
        if (existing.data()?.chargeId !== charge.id || existing.data()?.accountId !== destination) throw new Error('Settlement incompatible.');
        return;
      }
      transaction.create(ref, { bookingId: booking.id, ownerId: booking.ownerId, accountId: destination, mode: mode(), isTest: !session.livemode,
        amountCents: ownerShareCents(booking), havenFeeCents: Math.round(booking.platformFee * 100), stripeFeeCents: providerFee ?? null,
        currency: 'eur', chargeId: charge.id, paymentIntentId: intent.id, policy: CONNECT_POLICY_VERSION,
        state: 'WAITING_ARRIVAL', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    });
  }

  let releasing = false;
  async function releaseArrivedBookings() {
    if (releasing || !configuration().enabled) return;
    releasing = true;
    try {
      const jobs = await db.collection('owner_settlements').where('mode', '==', mode()).get();
      for (const job of jobs.docs) {
        const saved = job.data();
        if (!['WAITING_ARRIVAL', 'WAITING_ACCOUNT', 'RETRY', 'CREATING'].includes(saved.state) || (saved.retryAt && Date.parse(saved.retryAt) > Date.now())) continue;
        const bookingSnapshot = await db.collection('bookings').doc(job.id).get();
        if (!bookingSnapshot.exists) continue;
        const booking = { ...bookingSnapshot.data(), id: job.id } as Booking;
        if (booking.status === 'CANCELLED') { await job.ref.update({ state: 'CANCELLED', updatedAt: new Date().toISOString() }); continue; }
        const arrival = booking.checkInReportId ? await db.collection('inventory').doc(booking.checkInReportId).get() : null;
        const proof = await db.collection('owner_arrivals').doc(job.id).get();
        if (!hasRecordedArrival(booking, arrival?.exists ? arrival.data() as InventoryReport : null, proof.exists ? proof.data() as { reportId: string; tenantId: string } : null)) continue;
        const leaseToken = randomUUID();
        const claimed = await db.runTransaction(async transaction => {
          const [current, freshBooking] = await Promise.all([transaction.get(job.ref), transaction.get(bookingSnapshot.ref)]);
          const data = current.data();
          if (!data || !['WAITING_ARRIVAL', 'WAITING_ACCOUNT', 'RETRY', 'CREATING'].includes(data.state) || (data.leaseUntil && Date.parse(data.leaseUntil) > Date.now()) || freshBooking.data()?.status === 'CANCELLED' || freshBooking.data()?.checkInReportId !== booking.checkInReportId) return false;
          transaction.update(job.ref, { state: 'CREATING', leaseToken, leaseUntil: new Date(Date.now() + 120000).toISOString(), updatedAt: new Date().toISOString() });
          return true;
        });
        if (!claimed) continue;
        const finish = async (update: Record<string, unknown>) => db.runTransaction(async transaction => {
          const current = await transaction.get(job.ref);
          if (current.data()?.leaseToken === leaseToken && current.data()?.state === 'CREATING') transaction.update(job.ref, update);
        });
        try {
          if (ownerShareCents(booking) !== saved.amountCents || await accountOwner(saved.accountId) !== booking.ownerId) throw new Error('Settlement mismatch.');
          const ready = await syncAccount(booking.ownerId);
          if (ready.status !== 'READY' || !ready.bank) throw new ConnectError('Compte de versement à compléter.');
          const charge = await stripe().charges.retrieve(saved.chargeId);
          if (!charge.paid || charge.refunded || charge.amount_refunded > 0 || charge.disputed || charge.livemode === configuration().isTest) {
            await finish({ state: 'REVIEW_REQUIRED', error: 'Paiement remboursé ou contesté.', leaseUntil: FieldValue.delete(), updatedAt: new Date().toISOString() }); continue;
          }
          const group = `haven_${job.id}`;
          const prior = await stripe().transfers.list({ transfer_group: group, limit: 100 });
          if (prior.data.length > 1 || prior.has_more) throw new Error('Multiple transfers require review.');
          let transfer = prior.data[0];
          if (transfer && (transfer.amount !== saved.amountCents || transfer.destination !== saved.accountId || transfer.metadata?.bookingId !== job.id || transfer.reversed)) throw new Error('Transfer mismatch.');
          if (!transfer) {
            // Do not blindly reuse an expired Stripe idempotency key after an ambiguous result.
            if (saved.firstAttemptAt && Date.now() - Date.parse(saved.firstAttemptAt) > 23 * 3600000) {
              await finish({ state: 'REVIEW_REQUIRED', error: 'Confirmation du transfert à vérifier.', leaseUntil: FieldValue.delete(), updatedAt: new Date().toISOString() }); continue;
            }
            await job.ref.update({ firstAttemptAt: saved.firstAttemptAt || new Date().toISOString() });
            transfer = await stripe().transfers.create({ amount: saved.amountCents, currency: 'eur', destination: saved.accountId,
              source_transaction: saved.chargeId, transfer_group: group, metadata: { bookingId: job.id, ownerId: booking.ownerId, policy: CONNECT_POLICY_VERSION } },
              { idempotencyKey: `haven-owner-transfer-${mode()}-${job.id}` });
          }
          await finish({ state: 'TRANSFERRED', transferId: transfer.id, transferredAt: new Date(transfer.created * 1000).toISOString(), updatedAt: new Date().toISOString(), error: FieldValue.delete(), leaseUntil: FieldValue.delete() });
        } catch (error) {
          const retryable = error instanceof ConnectError || Boolean((error as { type?: string }).type?.match(/Connection|APIError|RateLimit/));
          await finish({ state: retryable ? error instanceof ConnectError ? 'WAITING_ACCOUNT' : 'RETRY' : 'REVIEW_REQUIRED', error: retryable ? 'Nouvelle vérification programmée.' : 'Le transfert nécessite une vérification par Haven.', retryAt: new Date(Date.now() + 60000).toISOString(), leaseUntil: FieldValue.delete(), updatedAt: new Date().toISOString() });
        }
      }
    } finally { releasing = false; }
  }

  async function syncPayout(accountId: string, payoutId: string) {
    const uid = await accountOwner(accountId);
    if (!uid) return;
    const checkedAt = new Date().toISOString();
    const payout = await stripe().payouts.retrieve(payoutId, {}, { stripeAccount: accountId });
    if (payout.livemode === configuration().isTest) throw new Error('Payout mode mismatch.');
    if (payout.currency !== 'eur') return;
    const ref = db.collection('owner_payouts').doc(`${mode()}_${accountId}_${payout.id}`);
    await db.runTransaction(async transaction => {
      const previous = await transaction.get(ref);
      if (previous.data()?.checkedAt > checkedAt) return;
      transaction.set(ref, { id: ref.id, ownerId: uid, accountId, amountCents: payout.amount, currency: 'EUR', provider: 'STRIPE', isTest: !payout.livemode,
        status: payoutStatus(payout.status), createdAt: new Date(payout.created * 1000).toISOString(), providerPayoutId: payout.id,
        expectedArrivalAt: new Date(payout.arrival_date * 1000).toISOString(),
        // This is when Stripe confirmed the paid status, never an invented arrival date.
        ...(payout.status === 'paid' ? { paidAt: previous.data()?.paidAt || checkedAt } : {}),
        failureCode: payout.failure_code || null, checkedAt });
    });
  }

  async function reconcileOwner(uid: string) {
    if (!configuration().enabled) return;
    await syncAccount(uid);
    const saved = await accountRef(uid).get();
    if (!saved.data()?.accountId) return;
    const accountId = saved.data()!.accountId as string;
    // Full pagination recovers missed notifications; re-read non-terminal records as well.
    for await (const payout of stripe().payouts.list({ limit: 100 }, { stripeAccount: accountId })) await syncPayout(accountId, payout.id);
  }

  async function handleEvent(event: Stripe.Event) {
    if (event.livemode === configuration().isTest) throw new Error('Stripe event mode mismatch.');
    const accountId = event.account;
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      const uid = await accountOwner(account.id); if (uid) await syncAccount(uid);
    } else if (accountId && event.type.startsWith('payout.')) {
      await syncPayout(accountId, (event.data.object as Stripe.Payout).id);
    } else if (accountId && event.type.startsWith('account.external_account.')) {
      const uid = await accountOwner(accountId); if (uid) await syncAccount(uid);
    } else if (!accountId && event.type.startsWith('transfer.')) {
      const checkedAt = new Date().toISOString();
      const transfer = await stripe().transfers.retrieve((event.data.object as Stripe.Transfer).id);
      await syncTransfer(transfer, checkedAt);
    } else if (!accountId && (event.type === 'charge.refunded' || event.type.startsWith('charge.dispute.'))) {
      const object = event.data.object as { id: string; charge?: string | Stripe.Charge };
      const chargeId = event.type === 'charge.refunded' ? object.id : typeof object.charge === 'string' ? object.charge : object.charge?.id;
      if (chargeId) {
        const affected = await db.collection('owner_settlements').where('chargeId', '==', chargeId).get();
        for (const job of affected.docs) await reconcileSettlement(job);
      }
    }
  }

  async function syncTransfer(transfer: Stripe.Transfer, checkedAt: string) {
    if (transfer.metadata?.policy !== CONNECT_POLICY_VERSION || !transfer.metadata.bookingId || transfer.livemode === configuration().isTest) return;
    const ref = db.collection('owner_settlements').doc(transfer.metadata.bookingId);
    await db.runTransaction(async transaction => {
      const saved = await transaction.get(ref), data = saved.data();
      if (data?.transferCheckedAt > checkedAt) return;
      if (!data || data.accountId !== transfer.destination || data.amountCents !== transfer.amount) throw new Error('Transfer binding mismatch.');
      if (data.transferId && data.transferId !== transfer.id) throw new Error('Duplicate transfer binding.');
      const review = (data.refundedAmountCents > 0 || data.disputed) && !transfer.reversed;
      transaction.update(ref, { transferCheckedAt: checkedAt, transferId: transfer.id, error: review ? 'Paiement remboursé ou contesté : rapprochement nécessaire par Haven.' : FieldValue.delete(), reversedAmountCents: transfer.amount_reversed,
        state: review ? 'REVIEW_REQUIRED' : transfer.reversed ? 'REVERSED' : transfer.amount_reversed > 0 ? 'PARTIALLY_REVERSED' : 'TRANSFERRED',
        transferredAt: new Date(transfer.created * 1000).toISOString(), updatedAt: new Date().toISOString(), leaseUntil: FieldValue.delete() });
    });
  }

  async function reconcileSettlement(job: FirebaseFirestore.QueryDocumentSnapshot) {
    const saved = job.data();
    const checkedAt = new Date().toISOString();
    const charge = await stripe().charges.retrieve(saved.chargeId);
    if (charge.livemode === configuration().isTest) throw new Error('Charge mode mismatch.');
    // Refunds on separate charges do not reverse transfers automatically. Any
    // post-transfer refund/dispute is flagged for operational review, never hidden.
    let transfer: Stripe.Transfer | undefined;
    if (saved.transferId) {
      transfer = await stripe().transfers.retrieve(saved.transferId);
      await syncTransfer(transfer, checkedAt);
    }
    const balance = typeof charge.balance_transaction === 'string' ? await stripe().balanceTransactions.retrieve(charge.balance_transaction) : charge.balance_transaction;
    await db.runTransaction(async transaction => {
      const fresh = await transaction.get(job.ref);
      if (fresh.data()?.checkedAt > checkedAt) return;
      transaction.update(job.ref, { refundedAmountCents: charge.amount_refunded, disputed: charge.disputed,
        stripeFeeCents: balance?.fee ?? null, checkedAt,
        ...((charge.amount_refunded > 0 || charge.disputed) && !transfer?.reversed ? { state: 'REVIEW_REQUIRED', error: 'Paiement remboursé ou contesté : rapprochement nécessaire par Haven.' } : {}) });
    });
  }

  let reconciling = false;
  async function reconcileAll() {
    if (!configuration().enabled || reconciling) return;
    reconciling = true;
    try {
      const accounts = await db.collection('owner_stripe_accounts').where('mode', '==', mode()).get();
      for (const account of accounts.docs) try { await reconcileOwner(account.data().ownerId); } catch { console.error('Stripe Connect account reconciliation unavailable.'); }
      const settlements = await db.collection('owner_settlements').where('mode', '==', mode()).get();
      for (const job of settlements.docs) try { await reconcileSettlement(job); } catch { console.error('Stripe settlement reconciliation unavailable.'); }
      await releaseArrivedBookings();
    } finally { reconciling = false; }
  }
  return { syncAccount, onboarding, dashboard, readyAccount, registerPayment, releaseArrivedBookings, syncPayout, reconcileOwner, reconcileAll, handleEvent };
}
