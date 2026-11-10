import type Stripe from 'stripe';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Booking, BookingSeries, HavenRefund, OwnerPayout, Payment } from '../types';
import { isLaterSeriesStay } from './recurringInstallments';
import { goodwillLimits } from './adminFinances';
import { localDateKey } from './stay';

export class AdminFinanceError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export interface AdminActorRef { uid: string; name: string }
export interface AdminFinanceData {
  payments: Payment[];
  settlements: Record<string, unknown>[];
  payouts: OwnerPayout[];
  series: BookingSeries[];
}

const ID = /^[a-zA-Z0-9_-]{1,160}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;


export function createAdminFinances(deps: { db: Firestore; stripe: () => Stripe; sweepInstallments: () => Promise<void> }) {
  const { db } = deps;
  const audit = (transaction: FirebaseFirestore.Transaction, admin: AdminActorRef, action: string, targetId: string, summary: string) => {
    const ref = db.collection('admin_audit').doc();
    transaction.create(ref, { id: ref.id, actorId: admin.uid, actorName: admin.name, action, category: 'BOOKING', targetType: 'BOOKING', targetId, summary, createdAt: new Date().toISOString() });
  };

  async function overview(): Promise<AdminFinanceData> {
    const [payments, settlements, payouts, series] = await Promise.all(['payments', 'owner_settlements', 'owner_payouts', 'booking_series'].map(name => db.collection(name).get()));
    return {
      payments: payments.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Payment),
      settlements: settlements.docs.map(doc => ({ ...doc.data(), bookingId: doc.id })),
      payouts: payouts.docs.map(doc => ({ ...doc.data(), id: doc.id }) as OwnerPayout),
      series: series.docs.map(doc => ({ ...doc.data(), id: doc.id }) as BookingSeries),
    };
  }

  /** Total or partial refund without cancelling the stay (goodwill gesture, dispute settled in the tenant's favour). */
  async function refund(admin: AdminActorRef, bookingId: string, amountCents: unknown, reasonInput: unknown) {
    const reason = typeof reasonInput === 'string' ? reasonInput.trim().replace(/\s+/g, ' ') : '';
    if (!ID.test(bookingId)) throw new AdminFinanceError('Réservation invalide.', 422);
    if (!Number.isSafeInteger(amountCents) || (amountCents as number) <= 0) throw new AdminFinanceError('Indiquez un montant à rembourser.', 422);
    if (reason.length < 3 || reason.length > 300) throw new AdminFinanceError('Indiquez un motif entre 3 et 300 caractères.', 422);
    const ref = db.collection('bookings').doc(bookingId);
    const booking = { ...(await ref.get()).data(), id: bookingId } as Booking;
    if (booking.paymentStatus !== 'PAID' || booking.status === 'CANCELLED') throw new AdminFinanceError('Seul un séjour payé et non annulé peut être remboursé ici. Pour annuler, utilisez l’onglet Réservations.');
    const { maxCents } = goodwillLimits(booking);
    if ((amountCents as number) > maxCents) throw new AdminFinanceError(`Le remboursement ne peut pas dépasser ${(maxCents / 100).toFixed(2)} €.`, 422);
    const index = (booking.havenRefunds?.length || 0) + 1;
    let refundId = `sim_refund_${bookingId}_${index}`;
    let status: HavenRefund['status'] = 'SIMULATED';
    if (booking.paymentProvider === 'STRIPE') {
      const sessionId = booking.checkoutSessionId || booking.stripeSessionId;
      if (!sessionId) throw new AdminFinanceError('Le paiement d’origine est introuvable.', 503);
      const session = sessionId.startsWith('pi_') ? null : await deps.stripe().checkout.sessions.retrieve(sessionId);
      const paymentIntent = !session ? sessionId : typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      if (!paymentIntent) throw new AdminFinanceError('Le paiement d’origine est introuvable.', 503);
      const created = await deps.stripe().refunds.create({ payment_intent: paymentIntent, amount: amountCents as number, metadata: { bookingId, kind: 'haven-goodwill', adminId: admin.uid } },
        { idempotencyKey: `haven-goodwill-${bookingId}-${index}` });
      if (['failed', 'canceled'].includes(created.status || '')) throw new AdminFinanceError('Stripe a refusé le remboursement.', 503);
      refundId = created.id;
      status = created.status === 'succeeded' ? 'COMPLETED' : 'PENDING';
    }
    const at = new Date().toISOString();
    const entry: HavenRefund = { id: refundId, amountCents: amountCents as number, reason, at, adminId: admin.uid, adminName: admin.name, status };
    await db.runTransaction(async transaction => {
      const settlementRef = db.collection('owner_settlements').doc(bookingId);
      const settlement = await transaction.get(settlementRef);
      transaction.update(ref, { havenRefunds: FieldValue.arrayUnion(entry) });
      if (settlement.exists) transaction.update(settlementRef, { havenRefundedCents: FieldValue.increment(amountCents as number), updatedAt: at });
      const paymentId = refundId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      transaction.set(db.collection('payments').doc(paymentId), { id: paymentId, bookingId, listingId: booking.listingId, ownerId: booking.ownerId, tenantId: booking.tenantId,
        amount: (amountCents as number) / 100, provider: booking.paymentProvider || 'SIMULATION', isTest: booking.paymentIsTest === true || booking.paymentProvider !== 'STRIPE',
        currency: 'EUR', status: status === 'PENDING' ? 'PENDING' : 'REFUNDED', type: 'REFUND', createdAt: at });
      audit(transaction, admin, 'BOOKING_REFUNDED_BY_HAVEN', bookingId, `Remboursement de ${((amountCents as number) / 100).toFixed(2)} € : ${reason}`);
    });
    return entry;
  }

  /** Holds or releases the owner's transfer for a stay (dispute, suspicion of fraud). */
  async function hold(admin: AdminActorRef, bookingId: string, holdInput: unknown, reasonInput: unknown) {
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (!ID.test(bookingId) || typeof holdInput !== 'boolean') throw new AdminFinanceError('Demande invalide.', 422);
    if (holdInput && reason.length < 3) throw new AdminFinanceError('Indiquez le motif du blocage.', 422);
    const ref = db.collection('owner_settlements').doc(bookingId);
    await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if (!current.exists) throw new AdminFinanceError('Aucun versement n’est prévu pour ce séjour.', 404);
      if (['TRANSFERRED', 'REVERSED', 'PARTIALLY_REVERSED', 'CANCELLED'].includes(current.data()?.state)) throw new AdminFinanceError('Ce versement est déjà terminé.');
      transaction.update(ref, holdInput ? { adminHold: true, holdReason: reason, heldAt: new Date().toISOString(), heldBy: admin.name } : { adminHold: false, holdReason: FieldValue.delete(), heldAt: FieldValue.delete(), heldBy: FieldValue.delete() });
      audit(transaction, admin, holdInput ? 'PAYOUT_HELD' : 'PAYOUT_RELEASED', bookingId, holdInput ? `Versement bloqué : ${reason}` : 'Versement débloqué.');
    });
  }

  /** After checking a transfer that needed review, let the automatic transfer try again. */
  async function retryTransfer(admin: AdminActorRef, bookingId: string) {
    if (!ID.test(bookingId)) throw new AdminFinanceError('Demande invalide.', 422);
    const ref = db.collection('owner_settlements').doc(bookingId);
    await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if (current.data()?.state !== 'REVIEW_REQUIRED') throw new AdminFinanceError('Ce versement n’attend pas de vérification.');
      transaction.update(ref, { state: 'RETRY', retryAt: new Date().toISOString(), error: FieldValue.delete(), firstAttemptAt: FieldValue.delete(), updatedAt: new Date().toISOString() });
      audit(transaction, admin, 'PAYOUT_RETRIED', bookingId, 'Transfert relancé après vérification.');
    });
  }

  /** Charges an installment now, or moves its due date (before the arrival). */
  async function installment(admin: AdminActorRef, bookingId: string, action: unknown, dueDateInput: unknown) {
    if (!ID.test(bookingId) || !['RETRY_NOW', 'POSTPONE'].includes(String(action))) throw new AdminFinanceError('Demande invalide.', 422);
    const ref = db.collection('bookings').doc(bookingId);
    const today = localDateKey(new Date());
    await db.runTransaction(async transaction => {
      const booking = { ...(await transaction.get(ref)).data(), id: bookingId } as Booking;
      if (!isLaterSeriesStay(booking) || !booking.seriesActivatedAt || booking.status !== 'PENDING' || booking.paymentStatus === 'PAID') throw new AdminFinanceError('Ce séjour n’a pas d’échéance en attente.');
      if (action === 'RETRY_NOW') {
        transaction.update(ref, { installmentDueDate: booking.installmentDueDate && booking.installmentDueDate < today ? booking.installmentDueDate : today, nextInstallmentAttemptAt: FieldValue.delete(), installmentLeaseUntil: FieldValue.delete() });
        audit(transaction, admin, 'INSTALLMENT_RETRIED', bookingId, 'Prélèvement relancé immédiatement.');
      } else {
        const due = String(dueDateInput || '');
        if (!DATE.test(due) || due < today || due >= booking.startDate.slice(0, 10)) throw new AdminFinanceError('Choisissez une date entre aujourd’hui et la veille de l’arrivée.', 422);
        transaction.update(ref, { installmentDueDate: due, installmentAttempts: 0, nextInstallmentAttemptAt: FieldValue.delete(), installmentLastError: FieldValue.delete() });
        audit(transaction, admin, 'INSTALLMENT_POSTPONED', bookingId, `Échéance déplacée au ${due}.`);
      }
    });
    if (action === 'RETRY_NOW') await deps.sweepInstallments();
  }

  return { overview, refund, hold, retryTransfer, installment };
}
