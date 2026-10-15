import { HousematePreview } from '../types';

export interface HousemateBooking {
  tenantId?: unknown;
  roomId?: unknown;
  status?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

export interface HousemateProfile {
  id: string;
  firstName?: unknown;
  avatarUrl?: unknown;
  birthDate?: unknown;
  job?: unknown;
  school?: unknown;
  shareProfileWithHousemates?: unknown;
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
    booking.status === 'CONFIRMED' &&
    typeof booking.tenantId === 'string' && booking.tenantId !== stay.viewerId &&
    typeof booking.roomId === 'string' && booking.roomId !== stay.roomId &&
    typeof booking.startDate === 'string' && typeof booking.endDate === 'string' &&
    booking.startDate < stay.endDate && booking.endDate > stay.startDate
  );

const ageOf = (birthDate: unknown, today: Date) => {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return undefined;
  const date = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== birthDate) return undefined;
  let age = today.getFullYear() - date.getFullYear();
  if (new Date(today.getFullYear(), date.getMonth(), date.getDate()) > today) age -= 1;
  return age >= 18 && age <= 120 ? age : undefined;
};

/** The response contains only fields covered by the member's opt-in. */
export const buildHousematePreviews = (
  bookings: HousemateBooking[],
  profilesById: Map<string, HousemateProfile>,
  stay: StayContext,
  today = new Date(),
): HousematePreview[] => {
  const byTenant = new Map<string, HousematePreview>();
  for (const booking of eligibleHousemateBookings(bookings, stay)) {
    const profile = profilesById.get(booking.tenantId);
    if (profile?.shareProfileWithHousemates !== true) continue;
    const coverage = booking.startDate <= stay.startDate && booking.endDate >= stay.endDate ? 'FULL' : 'PARTIAL';
    const existing = byTenant.get(booking.tenantId);
    if (existing) {
      // A person can have successive bookings. Keep one preview per person.
      if (coverage === 'FULL') existing.coverage = 'FULL';
      continue;
    }
    const job = typeof profile.job === 'string' ? profile.job.trim() : '';
    const school = typeof profile.school === 'string' ? profile.school.trim() : '';
    byTenant.set(booking.tenantId, {
      id: profile.id,
      firstName: typeof profile.firstName === 'string' && profile.firstName.trim()
        ? profile.firstName.trim().slice(0, 100) : 'Membre HAVEN',
      avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : '',
      age: ageOf(profile.birthDate, today),
      activity: job ? job.slice(0, 120) : school ? `Étudie à ${school.slice(0, 100)}` : undefined,
      coverage,
    });
  }
  return [...byTenant.values()];
};
