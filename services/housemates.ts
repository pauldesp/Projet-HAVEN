import { profileAge, profileActivity, profileInterests } from './publicProfile';
import { Booking, HousematePreview } from '../types';

export interface HousemateBooking {
  tenantId?: unknown;
  roomId?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

export interface HousemateProfile {
  id: string;
  firstName?: unknown;
  avatarUrl?: unknown;
  birthDate?: unknown;
  activity?: unknown;
  interests?: unknown;
  job?: unknown;
  school?: unknown;
  /** Legacy field, ignored: minimal profiles are always visible. */
  shareProfileWithHousemates?: unknown;
  status?: unknown;
}

interface StayContext {
  viewerId: string;
  roomId: string;
  startDate: string;
  endDate: string;
}

/** Departure is exclusive: two stays meeting on checkout day do not overlap. */
export const eligibleHousemateBookings = (bookings: HousemateBooking[], stay: StayContext) =>
  bookings.filter((booking): booking is HousemateBooking & {
    tenantId: string; roomId: string; startDate: string; endDate: string;
  } =>
    booking.status === 'CONFIRMED' && booking.paymentStatus === 'PAID' &&
    typeof booking.tenantId === 'string' && booking.tenantId !== stay.viewerId &&
    typeof booking.roomId === 'string' && booking.roomId !== stay.roomId &&
    typeof booking.startDate === 'string' && typeof booking.endDate === 'string' &&
    booking.startDate < stay.endDate && booking.endDate > stay.startDate
  );

/** Only minimal public information is shown for tenants sharing the stay. */
export const buildHousematePreviews = (
  bookings: HousemateBooking[],
  profilesById: Map<string, HousemateProfile>,
  stay: StayContext,
  today = new Date(),
): HousematePreview[] => {
  const byTenant = new Map<string, HousematePreview>();
  for (const booking of eligibleHousemateBookings(bookings, stay)) {
    const profile = profilesById.get(booking.tenantId);
    if (!profile || profile.status === 'BANNED') continue;
    const coverage = booking.startDate <= stay.startDate && booking.endDate >= stay.endDate ? 'FULL' : 'PARTIAL';
    const existing = byTenant.get(booking.tenantId);
    if (existing) {
      // A person can have successive bookings. Keep one preview per person.
      if (coverage === 'FULL') existing.coverage = 'FULL';
      continue;
    }
    byTenant.set(booking.tenantId, {
      id: profile.id,
      firstName: typeof profile.firstName === 'string' && profile.firstName.trim()
        ? profile.firstName.trim().slice(0, 100) : 'Membre HAVEN',
      avatarUrl: '',
      age: profileAge(profile.birthDate, today),
      activity: profileActivity(profile),
      ...(profileInterests(profile.interests).length ? { interests: profileInterests(profile.interests) } : {}),
      coverage,
    });
  }
  return [...byTenant.values()];
};

export function canViewBookingHousemates(booking: Pick<Booking, 'tenantId' | 'paymentStatus' | 'status' | 'endDate'>, viewerId: string, today: string) {
  return booking.tenantId === viewerId && booking.paymentStatus === 'PAID' && booking.status === 'CONFIRMED' && booking.endDate.slice(0, 10) >= today;
}
