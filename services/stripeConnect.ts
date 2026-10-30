import type { Booking, InventoryReport, OwnerPayout } from '../types';

export type ConnectStatus = 'NOT_STARTED' | 'INCOMPLETE' | 'PENDING' | 'READY' | 'RESTRICTED';
export interface OwnerConnectView {
  available: boolean; isTest: boolean; status: ConnectStatus; checkedAt: string | null;
  bank: { last4: string; name: string | null; currency: string } | null;
  error?: string;
}
export const CONNECT_POLICY_VERSION = 'haven-connect-arrival-v1';
export const DEPOSIT_POLICY = { enabled: false, amountCents: null, timing: 'TO_DEFINE', version: null } as const;

export function ownerShareCents(booking: Pick<Booking, 'basePrice' | 'cleaningFee' | 'platformFee' | 'totalPrice'>) {
  const amounts = [booking.basePrice, booking.cleaningFee, booking.platformFee, booking.totalPrice].map(value => Math.round(value * 100));
  if (amounts.some(value => !Number.isSafeInteger(value) || value < 0) || amounts[0] + amounts[1] + amounts[2] !== amounts[3] || amounts[0] + amounts[1] <= 0) throw new Error('Montants de réservation incohérents.');
  return amounts[0] + amounts[1]; // Stripe fees are borne by Haven, never deducted here.
}

export function hasRecordedArrival(booking: Booking, report: InventoryReport | null, proof: { reportId: string; tenantId: string } | null) {
  return booking.paymentProvider === 'STRIPE' && booking.paymentStatus === 'PAID' && ['CONFIRMED', 'COMPLETED'].includes(booking.status) &&
    Boolean(proof && proof.reportId === booking.checkInReportId && proof.tenantId === booking.tenantId && booking.checkInReportId && report && report.id === booking.checkInReportId && report.bookingId === booking.id && report.tenantId === booking.tenantId && report.type === 'IN');
}

export function connectStatus(account: { payouts_enabled?: boolean; capabilities?: { transfers?: string }; requirements?: { disabled_reason?: string | null; currently_due?: string[]; pending_verification?: string[] }; details_submitted?: boolean }): ConnectStatus {
  if (account.payouts_enabled && account.capabilities?.transfers === 'active' && !account.requirements?.disabled_reason && !account.requirements?.currently_due?.length) return 'READY';
  if (account.requirements?.disabled_reason && !account.requirements.disabled_reason.startsWith('requirements.')) return 'RESTRICTED';
  if (account.requirements?.currently_due?.length || !account.details_submitted) return 'INCOMPLETE';
  return 'PENDING';
}

export function payoutStatus(status: string): OwnerPayout['status'] {
  const mapped: Record<string, OwnerPayout['status']> = { pending: 'PENDING', in_transit: 'PROCESSING', paid: 'PAID', failed: 'FAILED', canceled: 'CANCELLED' };
  if (!mapped[status]) throw new Error('Statut Stripe de virement inconnu.');
  return mapped[status];
}

export interface OwnerSettlementView {
  bookingId: string; amountCents: number; state: string; isTest: boolean; updatedAt: string; error: string | null;
}
export function settlementLabel(state: string) {
  const labels: Record<string, string> = {
    WAITING_ARRIVAL: 'En attente de l’arrivée', WAITING_ACCOUNT: 'Compte Stripe à compléter',
    RETRY: 'Nouvelle tentative programmée', CREATING: 'Transfert en cours',
    TRANSFERRED: 'Transféré sur votre solde Stripe', CANCELLED: 'Séjour annulé',
    REVERSED: 'Transfert annulé par retour des fonds', PARTIALLY_REVERSED: 'Retour partiel des fonds', REVIEW_REQUIRED: 'Vérification par Haven nécessaire'
  };
  return labels[state] || 'Vérification en cours';
}
