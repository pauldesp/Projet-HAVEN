import test from 'node:test';
import assert from 'node:assert/strict';
import { cancellationMail, tenantMailDisposition, tenantNotificationEmail, type TenantMailJob } from './tenantMail';
import { tenantResendTemplate } from './resendTemplates';
import type { Booking, BookingSeries } from '../types';

const at = '2026-12-07T09:00:00.000Z';
const stay = (over: Partial<Booking> = {}) => ({ id: 'b2', listingId: 'l', listingTitle: 'Coloc Martin', roomId: 'r', roomName: 'Horizon', tenantId: 't', ownerId: 'o', startDate: '2027-01-10', endDate: '2027-01-15', status: 'PENDING', paymentStatus: 'PENDING', createdAt: '2026-11-06T09:00:00Z', basePrice: 100, cleaningFee: 10, platformFee: 15, totalPrice: 125, seriesId: 's1', seriesIndex: 1, seriesCount: 2, installmentDueDate: '2026-12-10', seriesActivatedAt: '2026-11-06T09:30:00Z', seriesScheduled: true, installmentAttempts: 0, ...over }) as Booking;
const job = (kind: TenantMailJob['kind'], over: Partial<TenantMailJob> = {}) => ({ kind, userId: 't', bookingId: 'b2', occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at, ...over }) as TenantMailJob;
const profile = { firstName: 'Léa', email: 'lea@example.test', role: 'TENANT' };
const start = '2026-01-01T00:00:00Z';
const now = Date.parse(at) + 60_000;

test('le rappel de prélèvement part tant que le séjour attend son échéance', () => {
  assert.equal(tenantMailDisposition(job('INSTALLMENT_UPCOMING'), profile, stay(), false, start, now), 'SEND');
  assert.equal(tenantMailDisposition(job('INSTALLMENT_UPCOMING'), profile, stay({ paymentStatus: 'PAID', status: 'CONFIRMED' }), false, start, now), 'CANCELLED');
  const mail = tenantNotificationEmail(job('INSTALLMENT_UPCOMING'), profile, stay(), undefined, 'https://haven.test');
  assert.match(mail.subject, /Prochain prélèvement le 10 décembre 2026/);
  assert.match(mail.text, /125,00/);
});

test('un échec de prélèvement donne le délai et un lien pour payer le séjour', () => {
  const failed = stay({ installmentAttempts: 1, installmentLastError: 'Votre carte a été refusée.' });
  assert.equal(tenantMailDisposition(job('INSTALLMENT_FAILED', { attempt: 1 }), profile, failed, false, start, now), 'SEND');
  assert.equal(tenantMailDisposition(job('INSTALLMENT_FAILED', { attempt: 1 }), profile, stay({ installmentAttempts: 2 }), false, start, now), 'CANCELLED');
  const mail = tenantNotificationEmail(job('INSTALLMENT_FAILED', { attempt: 1 }), profile, failed, undefined, 'https://haven.test');
  assert.match(mail.text, /Votre carte a été refusée/);
  assert.match(mail.text, /15 décembre 2026/);
  assert.match(mail.text, /Payer ce séjour : https:\/\/haven\.test\/#\/payment\/b2/);
});

test('la confirmation de série liste l’échéancier et la carte', () => {
  const first = stay({ id: 'b1', seriesIndex: 0, startDate: '2026-11-20', endDate: '2026-11-25', paymentStatus: 'PAID', status: 'CONFIRMED', paymentProvider: 'STRIPE' });
  const series = { id: 's1', status: 'ACTIVE', paymentProvider: 'STRIPE', cardBrand: 'visa', cardLast4: '4242', bookingIds: ['b1', 'b2'] } as BookingSeries;
  const mail = tenantNotificationEmail(job('SERIES_CONFIRMED', { bookingId: 'b1' }), profile, first, undefined, undefined, { series, stays: [first, stay()] });
  assert.match(mail.subject, /Vos 2 séjours sont réservés/);
  assert.match(mail.text, /Séjour 1 · .* · payé/);
  assert.match(mail.text, /Séjour 2 · .* · prélevé le 10 décembre 2026/);
  assert.match(mail.text, /VISA se terminant par 4242/);
  assert.match(mail.text, /Total de la série : 250,00/);
});

test('un séjour annulé faute de paiement est annoncé, et l’annulation d’un séjour réservé non prélevé aussi', () => {
  assert.equal(tenantMailDisposition(job('INSTALLMENT_UNPAID'), profile, stay({ status: 'CANCELLED', unpaidCancelledAt: at }), false, start, now), 'SEND');
  const cancelled = stay({ status: 'CANCELLED', cancellation: { cancelledAt: at, cancelledBy: 'OWNER', reason: 'Travaux', refundPercent: 0, refundAmount: 0, refundStatus: 'NOT_REQUIRED' } });
  assert.ok(cancellationMail(cancelled));
  assert.equal(tenantMailDisposition(job('CANCELLED'), profile, cancelled, false, start, now), 'SEND');
});

test('l’annulation d’un séjour réservé mais pas encore prélevé n’annonce pas de remboursement', () => {
  const cancelled = stay({ status: 'CANCELLED', cancellation: { cancelledAt: at, cancelledBy: 'OWNER', reason: 'Travaux', refundPercent: 0, refundAmount: 0, refundStatus: 'NOT_REQUIRED' } });
  assert.match(tenantNotificationEmail(job('CANCELLED'), profile, cancelled).text, /pas encore été prélevé : aucun montant ne vous a été débité/);
  assert.equal(tenantResendTemplate(job('CANCELLED'), profile, cancelled, undefined, 'https://haven.test')!.template.variables.INFORMATION_REMBOURSEMENT, 'Ce séjour n’avait pas encore été prélevé : aucun montant ne vous a été débité.');
});
