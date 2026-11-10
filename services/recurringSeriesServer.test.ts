import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecurringSeries } from './recurringSeriesServer';
import { CLEANING_POLICY_VERSION } from './cleaningPolicy';
import { localDateKey } from './stay';
import { AUTO_CHARGE_CONSENT_VERSION } from './recurringInstallments';
import type { Booking, BookingSeries } from '../types';

/** Minimal in-memory Firestore: enough for transactions, documents and equality queries. */
function memoryDb() {
  const data = new Map<string, Record<string, any>>();
  const snap = (path: string) => {
    const value = data.get(path);
    return { exists: value !== undefined, id: path.split('/').pop()!, ref: ref(path), data: () => value && structuredClone(value) };
  };
  const ref = (path: string): any => ({
    path, id: path.split('/').pop(),
    get: async () => snap(path),
    set: async (value: any, options?: { merge?: boolean }) => { data.set(path, options?.merge ? { ...data.get(path), ...value } : structuredClone(value)); },
    create: async (value: any) => { if (data.has(path)) throw Object.assign(new Error('exists'), { code: 6 }); data.set(path, structuredClone(value)); },
    update: async (value: any) => { if (!data.has(path)) throw new Error('missing'); data.set(path, { ...data.get(path), ...value }); },
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const query = (name: string, filters: [string, string, unknown][]): any => ({
    where: (field: string, op: string, value: unknown) => query(name, [...filters, [field, op, value]]),
    limit: () => query(name, filters),
    get: async () => ({ docs: [...data.keys()].filter(key => key.startsWith(`${name}/`) && key.split('/').length === name.split('/').length + 1)
      .filter(key => filters.every(([field, op, value]) => op === 'in' ? (value as unknown[]).includes(data.get(key)![field]) : data.get(key)![field] === value)).map(snap) }),
  });
  const collection = (name: string): any => ({ doc: (id: string) => ref(`${name}/${id}`), ...query(name, []) });
  const db: any = {
    collection,
    runTransaction: async (fn: (transaction: any) => Promise<unknown>) => {
      const writes: (() => Promise<void>)[] = [];
      const transaction = {
        get: (target: any) => target.get(),
        set: (target: any, value: any, options?: any) => { writes.push(() => target.set(value, options)); },
        create: (target: any, value: any) => { writes.push(() => target.create(value)); },
        update: (target: any, value: any) => { writes.push(() => target.update(value)); },
      };
      const result = await fn(transaction);
      for (const write of writes) await write();
      return result;
    },
  };
  return { db, data };
}

const listing = { id: 'l1', ownerId: 'owner', title: 'Coloc Martin', status: 'APPROVED', minStay: 4, cleaningFee: 15, checkInTime: '15:00', checkOutTime: '11:00',
  rooms: [{ id: 'r1', name: 'Horizon', pricePerDay: 30 }], blockedDates: [] };
// Same local calendar day as the server's due dates (localDateKey), also around midnight.
const day = (offset: number) => { const value = new Date(); value.setDate(value.getDate() + offset); return localDateKey(value); };

function setup() {
  const { db, data } = memoryDb();
  data.set('listings/l1', structuredClone(listing));
  const settled: string[] = [];
  const series = createRecurringSeries({
    db, paymentMode: () => 'SIMULATION', stripe: () => { throw new Error('no stripe'); }, isTestMode: () => true,
    readyOwnerAccount: async () => 'acct_1', registerPayment: async () => undefined, assertTenantCanBook: async () => undefined, notifyMail: () => undefined,
    settle: async receipt => {
      const path = `bookings/${receipt.bookingId}`;
      const booking = data.get(path) as Booking;
      data.set(path, { ...booking, status: 'CONFIRMED', paymentStatus: 'PAID', paymentProvider: receipt.provider, checkoutSessionId: receipt.sessionId, paidAt: new Date().toISOString() });
      settled.push(receipt.bookingId);
      return { disposition: 'CONFIRM', booking: data.get(path) as Booking };
    },
  });
  return { db, data, series, settled };
}
const stays = () => [
  { id: 'b1', roomId: 'r1', startDate: day(3), endDate: day(8) },
  { id: 'b2', roomId: 'r1', startDate: day(20), endDate: day(25) },
  { id: 'b3', roomId: 'r1', startDate: day(70), endDate: day(75) },
];

test('une série réserve et chiffre tous les séjours, puis s’active au paiement du premier', async () => {
  const { data, series } = setup();
  const created = await series.create('tenant', { seriesId: 's1', listingId: 'l1', stays: stays(), autoChargeConsentVersion: AUTO_CHARGE_CONSENT_VERSION });
  assert.equal(created.bookings.length, 3);
  assert.deepEqual(created.bookings.map(item => item.totalPrice), [30 * 5 + 15 + 23, 188, 188]);
  assert.equal(created.bookings[0].installmentDueDate, day(0));
  assert.equal(created.bookings[1].installmentDueDate, day(0), 'arrivée à moins d’un mois : prélevée tout de suite');
  assert.ok(created.bookings[2].installmentDueDate! > day(0));
  assert.equal(data.get('booking_availability/b3')!.status, 'PENDING');
  assert.equal(CLEANING_POLICY_VERSION, created.bookings[0].cleaningPolicyVersion);

  assert.equal(await series.activate('s1'), false, 'pas d’activation sans paiement du premier séjour');
  data.set('bookings/b1', { ...data.get('bookings/b1'), status: 'CONFIRMED', paymentStatus: 'PAID' });
  assert.equal(await series.activate('s1'), true);
  assert.equal(await series.activate('s1'), false, 'activation idempotente');
  assert.equal((data.get('booking_series/s1') as BookingSeries).status, 'ACTIVE');
  assert.equal(data.get('bookings/b2')!.seriesScheduled, true);
  assert.ok(data.get('reservation_mail_outbox/b1-SERIES_CONFIRMED'));
  assert.ok(data.get('reservation_mail_outbox/b3-INSTALLMENT_UPCOMING'), 'rappel 3 jours avant le prélèvement');
  assert.equal(data.get('reservation_mail_outbox/b2-INSTALLMENT_UPCOMING'), undefined, 'pas de rappel pour un prélèvement immédiat');
});

test('le passage automatique prélève les échéances dues, et seulement elles', async () => {
  const { data, series, settled } = setup();
  await series.create('tenant', { seriesId: 's1', listingId: 'l1', stays: stays(), autoChargeConsentVersion: AUTO_CHARGE_CONSENT_VERSION });
  data.set('bookings/b1', { ...data.get('bookings/b1'), status: 'CONFIRMED', paymentStatus: 'PAID' });
  await series.sweep();
  assert.deepEqual(settled, ['b2']);
  assert.equal(data.get('bookings/b3')!.paymentStatus, 'PENDING');
});

test('une date déjà prise refuse toute la série', async () => {
  const { data, series } = setup();
  data.set('booking_availability/x', { id: 'x', bookingId: 'x', listingId: 'l1', roomId: 'r1', startDate: day(21), endDate: day(23), status: 'CONFIRMED', updatedAt: '' });
  await assert.rejects(series.create('tenant', { seriesId: 's1', listingId: 'l1', stays: stays(), autoChargeConsentVersion: AUTO_CHARGE_CONSENT_VERSION }), /séjour 2 vient d’être réservé/);
  assert.equal(data.get('bookings/b1'), undefined, 'aucun séjour créé');
});

test('sans paiement du premier séjour, toute la série est libérée', async () => {
  const { data, series } = setup();
  await series.create('tenant', { seriesId: 's1', listingId: 'l1', stays: stays(), autoChargeConsentVersion: AUTO_CHARGE_CONSENT_VERSION });
  data.set('bookings/b1', { ...data.get('bookings/b1'), status: 'CANCELLED' });
  await series.releaseInactive('s1');
  assert.equal(data.get('bookings/b3')!.status, 'CANCELLED');
  assert.equal(data.get('booking_availability/b3')!.status, 'CANCELLED');
  assert.equal((data.get('booking_series/s1') as BookingSeries).status, 'CANCELLED');
});

test('sans autorisation explicite du prélèvement automatique, la série est refusée', async () => {
  const { data, series } = setup();
  await assert.rejects(series.create('tenant', { seriesId: 's1', listingId: 'l1', stays: stays() }), /Autorisez le prélèvement automatique/);
  assert.equal(data.get('booking_series/s1'), undefined);
  await series.create('tenant', { seriesId: 's2', listingId: 'l1', stays: stays(), autoChargeConsentVersion: AUTO_CHARGE_CONSENT_VERSION });
  assert.equal((data.get('booking_series/s2') as BookingSeries).autoChargeConsent?.version, AUTO_CHARGE_CONSENT_VERSION);
});
