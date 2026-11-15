import type Stripe from 'stripe';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { Booking, BookingAvailability, BookingSeries, Listing, Room } from '../types';
import { isRoomAvailableForStay } from './availability';
import { CLEANING_POLICY_VERSION } from './cleaningPolicy';
import { DAMAGE_DEPOSIT_CONSENT_TEXT, DAMAGE_DEPOSIT_POLICY } from './damageDeposit';
import { requiredNightsForStay } from './gapStay';
import { countNights, localDateKey } from './stay';
import { CONNECT_POLICY_VERSION } from './stripeConnect';
import { AUTO_CHARGE_CONSENT_TEXT, AUTO_CHARGE_CONSENT_VERSION, installmentChargeDecision, installmentDueDates, installmentReminderAt, isLaterSeriesStay, nextInstallmentAttempt, validateSeriesStays, type SeriesStayInput } from './recurringInstallments';
import type { SeriesMailKind } from './tenantMail';
import { simulationSessionId } from './paymentCheckout';
import { ownerMailId, ownerMailJob } from './ownerMail';

export class SeriesError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

type PaymentReceiptInput = { bookingId: string; sessionId: string; provider: 'STRIPE' | 'SIMULATION'; amountCents: number; currency: string; isTest: boolean };
type SettleResult = { disposition: 'CONFIRM' | 'DUPLICATE' | 'REFUND'; booking: Booking };
type IntentLike = { id: string; metadata: Stripe.Metadata | null; payment_intent: string; livemode: boolean };

export interface RecurringSeriesDependencies {
  db: Firestore;
  paymentMode: () => 'SIMULATION' | 'STRIPE';
  stripe: () => Stripe;
  isTestMode: () => boolean;
  /** The owner's payout account, even when it needs completing (null: none at all). Throws when Stripe is unreachable. */
  ownerPayoutAccount: (ownerId: string) => Promise<{ accountId: string; ready: boolean } | null>;
  settle: (receipt: PaymentReceiptInput, actorId?: string) => Promise<SettleResult>;
  registerPayment: (booking: Booking, payment: IntentLike) => Promise<void>;
  /** Throws when the tenant may not book (verification, role). */
  assertTenantCanBook: (transaction: Transaction, tenantId: string) => Promise<void>;
  notifyMail: () => void;
}

const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const mailJob = (kind: SeriesMailKind, booking: Pick<Booking, 'id' | 'tenantId'>, at: string, extra: Record<string, unknown> = {}) =>
  ({ kind, userId: booking.tenantId, bookingId: booking.id, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at, ...extra });

export function createRecurringSeries(deps: RecurringSeriesDependencies) {
  const { db } = deps;
  const bookings = db.collection('bookings');
  const seriesCollection = db.collection('booking_series');
  const outbox = db.collection('reservation_mail_outbox');

  /** Every stay is priced, held and created at once; only the first is paid now. */
  async function create(tenantId: string, body: { seriesId?: unknown; listingId?: unknown; stays?: unknown; autoChargeConsentVersion?: unknown }) {
    const { seriesId, listingId } = body;
    if (body.autoChargeConsentVersion !== AUTO_CHARGE_CONSENT_VERSION) throw new SeriesError('Autorisez le prélèvement automatique des séjours suivants pour réserver une série.', 422);
    const stays = body.stays as SeriesStayInput[];
    if (typeof seriesId !== 'string' || !ID.test(seriesId) || typeof listingId !== 'string' || !ID.test(listingId)) throw new SeriesError('Série récurrente invalide.', 422);
    const invalid = validateSeriesStays(stays);
    if (invalid) throw new SeriesError(invalid, 422);
    const sorted = [...stays].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const provider = deps.paymentMode();
    const createdAt = new Date().toISOString();
    const dueDates = installmentDueDates(sorted, localDateKey(new Date()));
    const listingRef = db.collection('listings').doc(listingId);
    const seriesRef = seriesCollection.doc(seriesId);

    return db.runTransaction(async transaction => {
      const roomIds = [...new Set(sorted.map(stay => stay.roomId))];
      const [listingSnap, seriesSnap, availabilityQuery, access, ...rest] = await Promise.all([
        transaction.get(listingRef), transaction.get(seriesRef),
        transaction.get(db.collection('booking_availability').where('listingId', '==', listingId)),
        transaction.get(db.collection('listing_access').doc(listingId)),
        ...sorted.map(stay => transaction.get(bookings.doc(stay.id))),
        ...sorted.map(stay => transaction.get(db.collection('booking_availability').doc(stay.id))),
        ...roomIds.map(roomId => transaction.get(db.collection('room_booking_locks').doc(`${listingId}_${roomId}`))),
      ]);
      await deps.assertTenantCanBook(transaction, tenantId);
      if (seriesSnap.exists || rest.slice(0, sorted.length * 2).some(item => item.exists)) throw new SeriesError('Cette série existe déjà.', 409);
      if (!listingSnap.exists || listingSnap.data()?.status !== 'APPROVED') throw new SeriesError('Ce logement n’est plus disponible.', 404);
      const listing = listingSnap.data() as Listing;
      if (listing.ownerId === tenantId) throw new SeriesError('Vous ne pouvez pas réserver votre propre logement.', 403);
      const availability = availabilityQuery.docs.map(item => item.data() as BookingAvailability);
      const cleaningFee = Number.isFinite(Number(listing.cleaningFee)) ? Math.max(0, Number(listing.cleaningFee)) : 0;
      const timeZone = access.data()?.timeZone || 'Europe/Paris';
      const created: Booking[] = sorted.map((stay, index) => {
        const room = listing.rooms?.find((item: Room) => item.id === stay.roomId);
        if (!room || !Number.isFinite(room.pricePerDay) || room.pricePerDay <= 0) throw new SeriesError('Une chambre de la série n’est plus disponible.', 404);
        const nights = countNights(stay.startDate, stay.endDate);
        if (nights < requiredNightsForStay(room, listing, availability, stay.startDate, stay.endDate)) throw new SeriesError(`Le séjour ${index + 1} ne respecte pas la durée minimale.`, 422);
        if (!isRoomAvailableForStay(room, listing, availability, stay.startDate, stay.endDate)) throw new SeriesError(`Le séjour ${index + 1} vient d’être réservé. Relancez la recherche.`, 409);
        // Later stays of the same series block their own dates for the next checks.
        availability.push({ id: stay.id, bookingId: stay.id, listingId, roomId: room.id, startDate: stay.startDate, endDate: stay.endDate, status: 'PENDING', updatedAt: createdAt });
        const basePrice = room.pricePerDay * nights;
        const platformFee = Math.round(basePrice * 0.15);
        return {
          timeZone, id: stay.id, listingId, listingTitle: listing.title, roomId: room.id, roomName: room.name || 'Chambre', tenantId, ownerId: listing.ownerId,
          startDate: stay.startDate, endDate: stay.endDate, status: 'PENDING', basePrice, cleaningFee, platformFee, totalPrice: basePrice + cleaningFee + platformFee,
          createdAt, paymentStatus: 'PENDING', bookingMode: 'INSTANT', cleaningPolicyVersion: CLEANING_POLICY_VERSION, cleaningPolicyAcceptedAt: createdAt,
          depositConsent: { version: DAMAGE_DEPOSIT_POLICY.version, text: DAMAGE_DEPOSIT_CONSENT_TEXT, amountCents: DAMAGE_DEPOSIT_POLICY.amountCents, acceptedAt: createdAt },
          checkInTime: listing.checkInTime || '15:00', checkOutTime: listing.checkOutTime || '11:00',
          seriesId, seriesIndex: index, seriesCount: sorted.length, installmentDueDate: dueDates[index], installmentAttempts: 0,
        };
      });
      const series: BookingSeries = { id: seriesId, tenantId, ownerId: listing.ownerId, listingId, listingTitle: listing.title, bookingIds: created.map(item => item.id), status: 'PENDING', paymentProvider: provider, createdAt,
        autoChargeConsent: { version: AUTO_CHARGE_CONSENT_VERSION, text: AUTO_CHARGE_CONSENT_TEXT, acceptedAt: createdAt } };
      transaction.create(seriesRef, series);
      for (const roomId of roomIds) transaction.set(db.collection('room_booking_locks').doc(`${listingId}_${roomId}`), { updatedAt: createdAt });
      for (const booking of created) {
        transaction.create(bookings.doc(booking.id), booking);
        transaction.create(db.collection('booking_availability').doc(booking.id), { id: booking.id, bookingId: booking.id, listingId, roomId: booking.roomId, startDate: booking.startDate, endDate: booking.endDate, status: 'PENDING', updatedAt: createdAt });
      }
      return { series, bookings: created };
    });
  }

  /** Idempotent: holds every later stay once the first stay is paid, and schedules the mails. */
  async function activate(seriesId: string) {
    const seriesRef = seriesCollection.doc(seriesId);
    const activated = await db.runTransaction(async transaction => {
      const seriesSnap = await transaction.get(seriesRef);
      const series = seriesSnap.data() as BookingSeries | undefined;
      if (!series || series.status !== 'PENDING') return false;
      const snaps = await Promise.all(series.bookingIds.map(id => transaction.get(bookings.doc(id))));
      const stays = snaps.map(item => ({ ...item.data(), id: item.id }) as Booking);
      const first = stays.find(stay => stay.seriesIndex === 0);
      if (!first || first.paymentStatus !== 'PAID' || first.status !== 'CONFIRMED') return false;
      const at = new Date().toISOString();
      transaction.update(seriesRef, { status: 'ACTIVE', activatedAt: at });
      transaction.create(outbox.doc(`${first.id}-SERIES_CONFIRMED`), mailJob('SERIES_CONFIRMED', first, at, { seriesId }));
      const ownerJob = ownerMailJob('OWNER_SERIES', series.ownerId, at, { seriesId });
      transaction.set(outbox.doc(ownerMailId(ownerJob)), ownerJob);
      for (const stay of stays) {
        if (!isLaterSeriesStay(stay) || stay.status !== 'PENDING' || stay.paymentStatus === 'PAID') continue;
        transaction.update(bookings.doc(stay.id), { seriesActivatedAt: at, seriesScheduled: true });
        const reminder = stay.installmentDueDate ? installmentReminderAt(stay.installmentDueDate, at) : undefined;
        if (reminder) transaction.create(outbox.doc(`${stay.id}-INSTALLMENT_UPCOMING`), mailJob('INSTALLMENT_UPCOMING', stay, reminder));
      }
      return true;
    });
    if (activated) deps.notifyMail();
    return activated;
  }

  /** After a checkout of the series: the card just used becomes the one charged for the next installments. */
  async function savePaymentMethod(booking: Booking, session: Stripe.Checkout.Session) {
    if (!booking.seriesId) return;
    const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!intentId) return;
    const intent = await deps.stripe().paymentIntents.retrieve(intentId, { expand: ['payment_method'] });
    const method = intent.payment_method;
    const customer = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
    if (!customer || !method || typeof method === 'string') return;
    await seriesCollection.doc(booking.seriesId).set({ stripeCustomerId: customer, paymentMethodId: method.id, cardBrand: method.card?.brand || '', cardLast4: method.card?.last4 || '' }, { merge: true });
  }

  /** Marks the booking as paid by this PaymentIntent, then settles it like a checkout. */
  async function synchronizeIntent(intent: Stripe.PaymentIntent) {
    const bookingId = intent.metadata?.bookingId;
    if (intent.metadata?.installment !== '1' || !bookingId || intent.status !== 'succeeded') return;
    if (intent.livemode === deps.isTestMode()) throw new Error('Stripe mode mismatch.');
    const ref = bookings.doc(bookingId);
    await db.runTransaction(async transaction => {
      const fresh = await transaction.get(ref);
      const booking = fresh.data() as Booking | undefined;
      if (!booking || booking.paymentStatus === 'PAID') return;
      if ((booking.checkoutSessionId || booking.stripeSessionId) === intent.id) return;
      transaction.update(ref, { paymentProvider: 'STRIPE', checkoutSessionId: intent.id, stripeSessionId: intent.id });
    });
    const result = await deps.settle({ bookingId, sessionId: intent.id, provider: 'STRIPE', amountCents: intent.amount_received || intent.amount, currency: intent.currency, isTest: !intent.livemode });
    if (result.disposition === 'REFUND') {
      // Paid twice (by hand and automatically) or after the deadline: never keep the money.
      await deps.stripe().refunds.create({ payment_intent: intent.id, metadata: { bookingId, reason: 'installment-not-applicable' } }, { idempotencyKey: `installment-refund-${intent.id}` });
      return;
    }
    await deps.registerPayment(result.booking, { id: intent.id, metadata: intent.metadata, payment_intent: intent.id, livemode: intent.livemode });
  }

  async function recordFailure(booking: Booking, message: string) {
    const ref = bookings.doc(booking.id);
    const at = new Date().toISOString();
    await db.runTransaction(async transaction => {
      const fresh = (await transaction.get(ref)).data() as Booking | undefined;
      if (!fresh || fresh.paymentStatus === 'PAID') return;
      const attempts = (fresh.installmentAttempts || 0) + 1;
      transaction.update(ref, { installmentAttempts: attempts, installmentLastError: message.slice(0, 300), nextInstallmentAttemptAt: nextInstallmentAttempt(), installmentLeaseUntil: null });
      transaction.set(outbox.doc(`${booking.id}-INSTALLMENT_FAILED-${attempts}`), mailJob('INSTALLMENT_FAILED', booking, at, { attempt: attempts }));
    });
    deps.notifyMail();
  }

  /** One alert to the Haven team per stay whose owner payout account is not ready at charge time. */
  async function alertOwnerAccount(booking: Booking, situation: string) {
    if (booking.ownerPayoutAlertAt) return;
    const at = new Date().toISOString();
    const message = `Compte de versement du propriétaire ${situation}. Séjour ${booking.id} (${booking.listingTitle || 'logement'}, ${booking.startDate} → ${booking.endDate}).`;
    await db.runTransaction(async transaction => {
      const ref = bookings.doc(booking.id);
      if ((await transaction.get(ref)).data()?.ownerPayoutAlertAt) return;
      transaction.update(ref, { ownerPayoutAlertAt: at });
      transaction.set(outbox.doc(`${booking.id}-OWNER_ACCOUNT-HAVEN_ALERT`), { kind: 'HAVEN_ALERT', task: 'OWNER_TRANSFERS', message, failures: 1, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at });
    });
    console.error('Owner payout account not ready at installment time.', booking.id);
    deps.notifyMail();
  }

  async function chargeOne(booking: Booking) {
    const ref = bookings.doc(booking.id);
    const leased = await db.runTransaction(async transaction => {
      const fresh = { ...(await transaction.get(ref)).data(), id: booking.id } as Booking;
      if (installmentChargeDecision(fresh) !== 'CHARGE') return null;
      transaction.update(ref, { installmentLeaseUntil: new Date(Date.now() + 10 * 60_000).toISOString() });
      return fresh;
    });
    if (!leased || !leased.seriesId) return;
    const series = (await seriesCollection.doc(leased.seriesId).get()).data() as BookingSeries | undefined;
    if (!series || series.status !== 'ACTIVE') return;
    const attempt = (leased.installmentAttempts || 0) + 1;

    if (series.paymentProvider === 'SIMULATION') {
      if (deps.paymentMode() !== 'SIMULATION') return recordFailure(leased, 'Le mode simulation est désactivé : payez ce séjour depuis votre espace.');
      await deps.settle({ bookingId: leased.id, sessionId: simulationSessionId(leased.id), provider: 'SIMULATION', amountCents: Math.round(leased.totalPrice * 100), currency: 'eur', isTest: true }, leased.tenantId);
      return;
    }
    if (!series.stripeCustomerId || !series.paymentMethodId) return recordFailure(leased, 'Aucune carte enregistrée pour cette série.');
    let payoutAccount: { accountId: string; ready: boolean } | null;
    try { payoutAccount = await deps.ownerPayoutAccount(leased.ownerId); }
    catch {
      // Stripe unreachable: not the tenant's fault, retry in an hour without counting an attempt.
      await bookings.doc(leased.id).update({ nextInstallmentAttemptAt: new Date(Date.now() + 3600_000).toISOString(), installmentLeaseUntil: null });
      console.error('Installment waiting for Stripe.', leased.id);
      return;
    }
    if (!payoutAccount || !payoutAccount.ready) {
      // The owner's payout account needs completing. The tenant is never penalised for it: the stay is charged as
      // planned when an account exists (the owner's transfer waits until it is complete), and Haven is warned once.
      await alertOwnerAccount(leased, payoutAccount ? 'incomplet : le séjour est prélevé, son versement attendra que le compte soit complété' : 'absent : le prélèvement attend, contactez le propriétaire avant l’échéance');
      if (!payoutAccount) {
        await bookings.doc(leased.id).update({ nextInstallmentAttemptAt: new Date(Date.now() + 3600_000).toISOString(), installmentLeaseUntil: null });
        return;
      }
    }
    const ownerAccountId = payoutAccount.accountId;
    let intent: Stripe.PaymentIntent;
    try {
      intent = await deps.stripe().paymentIntents.create({
        amount: Math.round(leased.totalPrice * 100), currency: 'eur', customer: series.stripeCustomerId, payment_method: series.paymentMethodId,
        off_session: true, confirm: true, transfer_group: `haven_${leased.id}`,
        description: `${leased.listingTitle || 'Séjour Haven'} · séjour ${(leased.seriesIndex ?? 0) + 1}/${leased.seriesCount ?? ''} · ${leased.startDate} → ${leased.endDate}`,
        metadata: { bookingId: leased.id, seriesId: leased.seriesId, installment: '1', connectPolicy: CONNECT_POLICY_VERSION, ownerAccountId },
      }, { idempotencyKey: `installment-${leased.id}-${attempt}` });
    } catch (error) {
      const stripeError = error as { type?: string; code?: string; message?: string };
      const message = stripeError.code === 'authentication_required' ? 'Votre banque demande une confirmation : payez ce séjour depuis votre espace.'
        : stripeError.type === 'StripeCardError' ? 'Votre carte a été refusée.' : 'Prélèvement momentanément impossible.';
      return recordFailure(leased, message);
    }
    if (intent.status === 'succeeded') return synchronizeIntent(intent);
    return recordFailure(leased, 'Le prélèvement n’a pas abouti.');
  }

  let sweeping = false;
  /** Runs every minute: activates paid series, then charges the installments that are due. */
  async function sweep() {
    if (sweeping) return;
    sweeping = true;
    try {
      const pendingSeries = await seriesCollection.where('status', '==', 'PENDING').get();
      for (const item of pendingSeries.docs) await activate(item.id).catch(() => console.error('Series activation requires a retry.'));
      const due = await bookings.where('seriesScheduled', '==', true).where('status', '==', 'PENDING').get();
      for (const item of due.docs) {
        const booking = { ...item.data(), id: item.id } as Booking;
        if (installmentChargeDecision(booking) !== 'CHARGE') continue;
        await chargeOne(booking).catch(() => console.error('Installment charge requires a retry.', item.id));
      }
    } catch (error) { console.error('Recurring installments unavailable; retry scheduled.'); throw error; }
    finally { sweeping = false; }
  }

  /** Called when a later stay reaches its deadline unpaid and is released. */
  function unpaidCancellationWrites(transaction: Transaction, booking: Booking, at: string) {
    if (!isLaterSeriesStay(booking) || !booking.seriesActivatedAt) return;
    transaction.update(bookings.doc(booking.id), { unpaidCancelledAt: at });
    transaction.set(outbox.doc(`${booking.id}-INSTALLMENT_UNPAID`), mailJob('INSTALLMENT_UNPAID', booking, at));
    const ownerJob = ownerMailJob('OWNER_CANCELLED', booking.ownerId, at, { bookingId: booking.id });
    transaction.set(outbox.doc(ownerMailId(ownerJob)), ownerJob);
  }

  /** The first stay was cancelled or expired before payment: the whole series is released. */
  async function releaseInactive(seriesId: string) {
    const seriesRef = seriesCollection.doc(seriesId);
    await db.runTransaction(async transaction => {
      const series = (await transaction.get(seriesRef)).data() as BookingSeries | undefined;
      if (!series || series.status !== 'PENDING') return;
      const snaps = await Promise.all(series.bookingIds.map(id => transaction.get(bookings.doc(id))));
      const at = new Date().toISOString();
      transaction.update(seriesRef, { status: 'CANCELLED' });
      for (const snap of snaps) {
        const stay = snap.data() as Booking | undefined;
        if (!stay || stay.paymentStatus === 'PAID' || stay.status === 'CANCELLED') continue;
        transaction.update(snap.ref, { status: 'CANCELLED', expiredAt: at });
        transaction.set(db.collection('booking_availability').doc(snap.id), { id: snap.id, bookingId: snap.id, listingId: stay.listingId, roomId: stay.roomId, startDate: stay.startDate, endDate: stay.endDate, status: 'CANCELLED', updatedAt: at });
      }
    });
  }

  return { create, activate, savePaymentMethod, synchronizeIntent, sweep, unpaidCancellationWrites, releaseInactive };
}
