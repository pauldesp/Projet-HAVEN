import { Booking, Payment } from '../types';

type OwnerBooking = Pick<Booking, 'id' | 'status' | 'startDate' | 'totalPrice'>;

export interface OwnerFinanceStats {
  /** Revenus des loyers encaissés, diminués des remboursements. */
  totalRevenue: number;
  /** Loyers déjà réglés pour des séjours qui n'ont pas encore commencé. */
  pendingRevenue: number;
}

export function calculateOwnerFinanceStats(
  bookings: OwnerBooking[],
  payments: Payment[],
  now = new Date()
): OwnerFinanceStats {
  const completedRentPayments = payments.filter(payment =>
    payment.status === 'COMPLETED' && payment.type === 'RENT'
  );
  const refundedPayments = payments.filter(payment =>
    payment.status === 'REFUNDED' && payment.type === 'REFUND'
  );
  const paidBookingIds = new Set(completedRentPayments.map(payment => payment.bookingId));

  return {
    totalRevenue: completedRentPayments.reduce((total, payment) => total + payment.amount, 0)
      - refundedPayments.reduce((total, payment) => total + payment.amount, 0),
    pendingRevenue: bookings
      .filter(booking =>
        booking.status === 'CONFIRMED' &&
        paidBookingIds.has(booking.id) &&
        new Date(`${booking.startDate}T00:00:00`).getTime() > now.getTime()
      )
      .reduce((total, booking) => total + booking.totalPrice, 0),
  };
}
