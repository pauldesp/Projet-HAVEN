import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createStripeConnect } from './stripeConnectServer';
import { CONNECT_ON_BEHALF_POLICY } from './onBehalfPayments';
import type { Booking } from '../types';

/** Payments made on the owner's behalf: recorded at payment, paid out to the owner's bank after the arrival. */
function fixture() {
  const records = new Map<string, any>();
  const patch = (path: string, data: any, merge = true) => {
    const next = merge ? { ...records.get(path) } : {};
    for (const [key, value] of Object.entries(data)) { if (value instanceof FieldValue) delete next[key]; else next[key] = value; }
    records.set(path, next);
  };
  const reference = (path: string): any => ({
    id: path.split('/').at(-1), path,
    get: async () => ({ id: path.split('/').at(-1), ref: reference(path), exists: records.has(path), data: () => records.get(path) }),
    update: async (data: any) => patch(path, data),
    set: async (data: any) => patch(path, data, false),
  });
  const collection = (name: string, filters: any[] = []): any => ({
    doc: (id: string) => reference(`${name}/${id}`),
    where: (key: string, op: string, value: unknown) => collection(name, [...filters, [key, op, value]]),
    get: async () => ({ docs: await Promise.all([...records].filter(([path, data]) => path.startsWith(`${name}/`) && path.split('/').length === 2
      && filters.every(([key, op, value]) => op === 'in' ? (value as unknown[]).includes(data[key]) : data[key] === value)).map(([path]) => reference(path).get())) }),
  });
  const db = { collection, runTransaction: async (callback: any) => callback({
    get: (ref: any) => ref.get(), update: (ref: any, data: any) => patch(ref.path, data),
    set: (ref: any, data: any, options?: any) => patch(ref.path, data, Boolean(options?.merge)),
    create: (ref: any, data: any) => { assert.equal(records.has(ref.path), false); patch(ref.path, data, false); },
  }) } as unknown as Firestore;
  // 110 € stay + 15 € cleaning + 17 € Haven fee = 142 €.
  const booking = { id: 'b', ownerId: 'o', tenantId: 't', basePrice: 110, cleaningFee: 15, platformFee: 17, totalPrice: 142,
    paymentProvider: 'STRIPE', paymentIsTest: true, paymentStatus: 'PAID', status: 'CONFIRMED', checkoutSessionId: 'cs_b', checkInReportId: 'in' } as Booking;
  records.set('bookings/b', { ...booking });
  records.set('inventory/in', { id: 'in', bookingId: 'b', tenantId: 't', type: 'IN' });
  records.set('owner_arrivals/b', { reportId: 'in', tenantId: 't' });
  records.set('owner_stripe_accounts/test_o', { ownerId: 'o', accountId: 'acct_o' });
  records.set('stripe_account_owners/test_acct_o', { ownerId: 'o' });
  const account = { id: 'acct_o', payouts_enabled: true, charges_enabled: true, capabilities: { transfers: 'active', card_payments: 'active' }, settings: { payouts: { schedule: { interval: 'manual' } } }, metadata: { havenOwnerId: 'o', havenMode: 'test' } };
  const transfer = { id: 'tr_auto', amount: 14200, amount_reversed: 0 };
  const fee = { id: 'fee_b', amount: 1700, amount_refunded: 0 };
  let charge: any = { id: 'ch_b', paid: true, amount: 14200, currency: 'eur', amount_refunded: 0, refunded: false, disputed: false, livemode: false, balance_transaction: { fee: 238 }, transfer, application_fee: fee };
  const payouts: any[] = [];
  const reversals: any[] = [];
  let fundsAvailable = true;
  const provider = {
    accounts: { retrieve: async () => account, update: async () => account,
      listExternalAccounts: async () => ({ data: [{ object: 'bank_account', currency: 'eur', last4: '1234', bank_name: 'Test', default_for_currency: true }] }) },
    paymentIntents: { retrieve: async () => ({ id: 'pi_b', status: 'succeeded', latest_charge: charge, on_behalf_of: 'acct_o', transfer_data: { destination: 'acct_o' } }) },
    charges: { retrieve: async () => charge },
    balanceTransactions: { retrieve: async () => ({ fee: 238 }) },
    transfers: { retrieve: async () => ({ ...transfer, metadata: {} }), create: async () => { throw new Error('Aucun transfert séparé ne doit être créé.'); },
      createReversal: async (id: string, params: any, options: any) => { reversals.push({ id, params, options }); return { id: 'trr_1' }; } },
    payouts: {
      list: async () => ({ data: payouts }),
      create: async (params: any, options: any) => {
        if (!fundsAvailable) throw Object.assign(new Error('Insufficient funds'), { code: 'balance_insufficient' });
        const payout = { id: `po_${payouts.length + 1}`, status: 'pending', ...params, options };
        payouts.push(payout); return payout;
      },
    },
  } as unknown as Stripe;
  const service = createStripeConnect(db, () => provider, () => ({ enabled: true, isTest: true }));
  const session = { id: 'cs_b', payment_intent: 'pi_b', livemode: false, metadata: { connectPolicy: CONNECT_ON_BEHALF_POLICY, ownerAccountId: 'acct_o' } } as unknown as Stripe.Checkout.Session;
  return { service, records, booking, session, payouts, reversals, setFunds: (value: boolean) => { fundsAvailable = value; }, setCharge: (next: any) => { charge = { ...charge, ...next }; }, transfer };
}

test('a payment on the owner’s behalf is recorded without any transfer, and the stay remembers its flow', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  const settlement = f.records.get('owner_settlements/b');
  assert.equal(settlement.model, 'ON_BEHALF');
  assert.equal(settlement.transferId, 'tr_auto');
  assert.equal(settlement.applicationFeeId, 'fee_b');
  assert.equal(settlement.state, 'WAITING_ARRIVAL');
  assert.equal(f.records.get('bookings/b').connectPolicy, CONNECT_ON_BEHALF_POLICY);
});

test('after the arrival, the owner’s net share is paid out to their bank once', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  f.records.delete('owner_arrivals/b');
  await f.service.releaseArrivedBookings();
  assert.equal(f.payouts.length, 0, 'rien avant l’arrivée');
  f.records.set('owner_arrivals/b', { reportId: 'in', tenantId: 't' });
  await f.service.releaseArrivedBookings();
  await f.service.releaseArrivedBookings();
  assert.equal(f.payouts.length, 1);
  assert.equal(f.payouts[0].amount, 12500, '142 € moins les 17 € de Haven');
  assert.equal(f.payouts[0].options.stripeAccount, 'acct_o');
  assert.equal(f.records.get('owner_settlements/b').state, 'PAID_OUT');
});

test('funds not yet available at Stripe: the payout waits and is tried again later', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  f.setFunds(false);
  await f.service.releaseArrivedBookings();
  assert.equal(f.records.get('owner_settlements/b').state, 'WAITING_FUNDS');
  assert.equal(f.payouts.length, 0);
  f.setFunds(true);
  f.records.get('owner_settlements/b').retryAt = '2000-01-01T00:00:00Z';
  await f.service.releaseArrivedBookings();
  assert.equal(f.records.get('owner_settlements/b').state, 'PAID_OUT');
  assert.equal(f.payouts[0].options.idempotencyKey, 'haven-owner-payout-test-b-2');
});

test('a late cancellation leaves the non-refunded share with the owner, who is paid it out', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  f.records.set('bookings/b', { ...f.records.get('bookings/b'), status: 'CANCELLED', checkInReportId: undefined });
  f.transfer.amount_reversed = 6250; // 50 % of the stay and cleaning refunded from the owner's share
  await f.service.releaseArrivedBookings();
  assert.equal(f.payouts[0].amount, 6250);
});

test('a dispute takes the amount back from the owner and suspends the payout', async () => {
  const f = fixture();
  await f.service.registerPayment(f.booking, f.session);
  f.setCharge({ disputed: true });
  await f.service.handleEvent({ type: 'charge.dispute.created', livemode: false, data: { object: { id: 'dp_1', amount: 14200, charge: 'ch_b' } } } as unknown as Stripe.Event);
  assert.equal(f.reversals.length, 1);
  assert.equal(f.reversals[0].params.amount, 14200);
  const settlement = f.records.get('owner_settlements/b');
  assert.equal(settlement.adminHold, true);
  assert.equal(settlement.state, 'REVIEW_REQUIRED');
  await f.service.releaseArrivedBookings();
  assert.equal(f.payouts.length, 0, 'aucun versement pendant la contestation');
});
