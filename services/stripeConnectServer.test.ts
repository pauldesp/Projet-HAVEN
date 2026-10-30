import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createStripeConnect } from './stripeConnectServer';
import { CONNECT_POLICY_VERSION } from './stripeConnect';
import type { Booking } from '../types';

// Minimal persistent-store double: exercise the service against real SDK shapes,
// without keys, network access, bank details or a Firebase emulator.
function fixture() {
  const records = new Map<string, any>();
  const patch = (path: string, data: any, merge = true) => {
    const next = merge ? { ...records.get(path) } : {};
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof FieldValue) delete next[key]; else next[key] = value;
    }
    records.set(path, next);
  };
  const reference = (path: string): any => ({
    id: path.split('/').at(-1), path,
    get: async () => ({ id: path.split('/').at(-1), ref: reference(path), exists: records.has(path), data: () => records.get(path) }),
    update: async (data: any) => patch(path, data),
  });
  const collection = (name: string, filters: any[] = []): any => ({
    doc: (id: string) => reference(`${name}/${id}`),
    where: (key: string, _op: string, value: unknown) => collection(name, [...filters, [key, value]]),
    get: async () => ({ docs: await Promise.all([...records].filter(([path, data]) => path.startsWith(`${name}/`) && filters.every(([key, value]) => data[key] === value)).map(([path]) => reference(path).get())) }),
  });
  const db = { collection, runTransaction: async (callback: any) => callback({
    get: (ref: any) => ref.get(), update: (ref: any, data: any) => patch(ref.path, data),
    set: (ref: any, data: any, options?: any) => patch(ref.path, data, Boolean(options?.merge)),
    create: (ref: any, data: any) => { assert.equal(records.has(ref.path), false); patch(ref.path, data, false); },
  }) } as unknown as Firestore;
  const booking = { id: 'b', ownerId: 'o', tenantId: 't', basePrice: 110, cleaningFee: 15, platformFee: 17, totalPrice: 142,
    paymentProvider: 'STRIPE', paymentIsTest: true, paymentStatus: 'PAID', status: 'CONFIRMED', checkoutSessionId: 'cs_b', checkInReportId: 'in' } as Booking;
  records.set('bookings/b', booking);
  records.set('inventory/in', { id: 'in', bookingId: 'b', tenantId: 't', type: 'IN' });
  records.set('owner_arrivals/b', { reportId: 'in', tenantId: 't' });
  records.set('owner_stripe_accounts/test_o', { ownerId: 'o', accountId: 'acct_o' });
  records.set('stripe_account_owners/test_acct_o', { ownerId: 'o' });
  let payout: any = { id: 'po_1', amount: 12500, currency: 'eur', status: 'pending', created: 1, arrival_date: 2, livemode: false };
  let charge: any = { id: 'ch_b', paid: true, amount: 14200, currency: 'eur', amount_refunded: 0, refunded: false, disputed: false, livemode: false, balance_transaction: { fee: 238 } };
  const transfers: any[] = [];
  let createCalls = 0, loseFirstResponse = false;
  const provider = {
    accounts: {
      retrieve: async () => ({ id: 'acct_o', payouts_enabled: true, capabilities: { transfers: 'active' }, metadata: { havenOwnerId: 'o', havenMode: 'test' } }),
      listExternalAccounts: async () => ({ data: [{ object: 'bank_account', currency: 'eur', last4: '1234', bank_name: 'Test', default_for_currency: true }] }),
    },
    payouts: { retrieve: async () => ({ ...payout }) },
    paymentIntents: { retrieve: async () => ({ id: 'pi_b', status: 'succeeded', latest_charge: charge }) },
    charges: { retrieve: async () => charge },
    transfers: {
      list: async () => ({ data: transfers, has_more: false }),
      retrieve: async () => transfers[0],
      create: async (params: any, options: any) => {
        createCalls++;
        assert.equal(options.idempotencyKey, 'haven-owner-transfer-test-b');
        transfers.push({ ...params, id: 'tr_b', created: 1, amount_reversed: 0, reversed: false, livemode: false });
        if (loseFirstResponse) { loseFirstResponse = false; throw { type: 'StripeConnectionError' }; }
        return transfers[0];
      }
    }
  } as unknown as Stripe;
  const service = createStripeConnect(db, () => provider, () => ({ enabled: true, isTest: true }));
  const session = { id: 'cs_b', payment_intent: 'pi_b', livemode: false, metadata: { connectPolicy: CONNECT_POLICY_VERSION, ownerAccountId: 'acct_o' } } as unknown as Stripe.Checkout.Session;
  return { service, records, booking, session, transfers, provider, db, createCalls: () => createCalls, loseResponse: () => { loseFirstResponse = true; }, setPayout: (next: any) => { payout = { ...payout, ...next }; }, setCharge: (next: any) => { charge = { ...charge, ...next }; } };
}

test('payment confirmation retries create one immutable settlement without releasing before arrival', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  await f.service.registerPayment(f.booking, f.session);
  assert.equal(f.records.get('owner_settlements/b').amountCents, 12500);
  assert.equal(f.records.get('owner_settlements/b').stripeFeeCents, 238);
  f.records.delete('owner_arrivals/b');
  await f.service.releaseArrivedBookings();
  assert.equal(f.createCalls(), 0);
  assert.equal(f.records.get('owner_settlements/b').state, 'WAITING_ARRIVAL');
});
test('a lost Stripe response recovers the existing transfer without paying twice', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  f.loseResponse();
  await f.service.releaseArrivedBookings();
  assert.equal(f.records.get('owner_settlements/b').state, 'RETRY');
  f.records.get('owner_settlements/b').retryAt = '2000-01-01T00:00:00Z';
  await f.service.releaseArrivedBookings();
  await f.service.releaseArrivedBookings();
  assert.equal(f.createCalls(), 1);
  assert.equal(f.records.get('owner_settlements/b').state, 'TRANSFERRED');
  assert.equal(f.transfers[0].amount, 12500);
  assert.equal(f.transfers[0].source_transaction, 'ch_b');
  assert.equal(f.records.has('owner_payouts/test_acct_o_tr_b'), false);
});
test('cancelled, refunded or disputed reservations never release owner money', async () => {
  for (const scenario of ['cancelled', 'refunded', 'disputed']) {
    const f = fixture();
    await f.service.registerPayment(f.booking, f.session);
    if (scenario === 'cancelled') f.records.get('bookings/b').status = 'CANCELLED';
    if (scenario === 'refunded') f.setCharge({ amount_refunded: 100 });
    if (scenario === 'disputed') f.setCharge({ disputed: true });
    await f.service.releaseArrivedBookings();
    assert.equal(f.createCalls(), 0);
    assert.equal(f.records.get('owner_settlements/b').state, scenario === 'cancelled' ? 'CANCELLED' : 'REVIEW_REQUIRED');
  }
});
test('an ambiguous transfer older than provider idempotency retention needs review', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  f.records.get('owner_settlements/b').firstAttemptAt = '2000-01-01T00:00:00Z';
  await f.service.releaseArrivedBookings();
  assert.equal(f.createCalls(), 0);
  assert.equal(f.records.get('owner_settlements/b').state, 'REVIEW_REQUIRED');
});
test('out-of-order webhook content is ignored in favor of the current provider status', async () => {
  const f = fixture();
  await f.service.syncPayout('acct_o', 'po_1');
  const event = { id: 'evt_1', account: 'acct_o', livemode: false, type: 'payout.paid', data: { object: { id: 'po_1', status: 'paid' } } } as unknown as Stripe.Event;
  f.setPayout({ status: 'paid' });
  await f.service.handleEvent(event);
  assert.equal(f.records.get('owner_payouts/test_acct_o_po_1').status, 'PAID');
  f.setPayout({ status: 'failed', failure_code: 'account_closed' });
  await f.service.handleEvent(event); // A late paid notification cannot restore revenue.
  const record = f.records.get('owner_payouts/test_acct_o_po_1');
  assert.equal(record.status, 'FAILED');
  assert.equal(record.paidAt, undefined);
  await assert.rejects(() => f.service.handleEvent({ ...event, livemode: true }));
});
test('unconfigured integration cannot make a Stripe call or simulate a bank account', async () => {
  const f = fixture();
  const service = createStripeConnect(f.db, () => { throw new Error('Must never contact Stripe'); }, () => ({ enabled: false, isTest: true }));
  assert.equal((await service.syncAccount('o')).available, false);
  await service.reconcileAll();
  await service.releaseArrivedBookings();
  await assert.rejects(() => service.readyAccount('o'));
});
