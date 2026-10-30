import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOwnerFinanceStats } from '../services/ownerFinances';
import type { OwnerPayout } from '../types';

const paid: OwnerPayout = { id: 'payout-1', ownerId: 'owner', amountCents: 12345, currency: 'EUR', provider: 'STRIPE', isTest: false,
  status: 'PAID', createdAt: '2026-10-20T12:00:00Z', paidAt: '2026-10-21T12:00:00Z', providerPayoutId: 'po_1' };
test('owner revenue counts only net confirmed bank payouts and actual pending/processing payouts', () => {
  assert.deepEqual(calculateOwnerFinanceStats([paid,
    { ...paid, id: 'payout-2', providerPayoutId: 'po_2', status: 'PENDING', amountCents: 10001 },
    { ...paid, id: 'payout-3', providerPayoutId: 'po_3', status: 'PROCESSING', amountCents: 2033 },
  ]), { totalRevenue: 123.45, pendingRevenue: 120.34 });
});
test('simulations, unknown mode, invalid amounts and unsuccessful transfers never inflate owner finances', () => {
  assert.deepEqual(calculateOwnerFinanceStats([
    { ...paid, id: 'sim', provider: 'SIMULATION', isTest: true }, { ...paid, id: 'test', isTest: true },
    { ...paid, id: 'legacy', isTest: undefined } as unknown as OwnerPayout,
    { ...paid, id: 'failed', status: 'FAILED' }, { ...paid, id: 'cancelled', status: 'CANCELLED' },
    { ...paid, id: 'returned', status: 'REVERSED' }, { ...paid, id: 'invalid', amountCents: NaN },
    { ...paid, id: 'negative', amountCents: -1 }, { ...paid, id: 'fraction', amountCents: 20.5 },
    { ...paid, id: 'unconfirmed', paidAt: undefined }, { ...paid, id: 'unreferenced', providerPayoutId: undefined },
  ]), { totalRevenue: 0, pendingRevenue: 0 });
});
test('tenant payment history alone produces no owner revenue or pending bank payout', () => {
  assert.deepEqual(calculateOwnerFinanceStats([]), { totalRevenue: 0, pendingRevenue: 0 });
});
test('repeated paid records are counted once and payout status transitions move amounts between indicators', () => {
  assert.deepEqual(calculateOwnerFinanceStats([paid, paid, { ...paid, id: 'duplicate' }]), { totalRevenue: 123.45, pendingRevenue: 0 });
  assert.deepEqual(calculateOwnerFinanceStats([{ ...paid, status: 'PENDING' }]), { totalRevenue: 0, pendingRevenue: 123.45 });
  assert.deepEqual(calculateOwnerFinanceStats([{ ...paid, status: 'PAID' }]), { totalRevenue: 123.45, pendingRevenue: 0 });
});
