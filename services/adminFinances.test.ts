import test from 'node:test';
import assert from 'node:assert/strict';
import { goodwillLimits, havenRefundedCents } from './adminFinances';

const booking = { totalPrice: 188, platformFee: 23, havenRefunds: [] as { amountCents: number }[] };

test('un geste commercial est pris d’abord sur la commission Haven, sans dépasser le montant payé', () => {
  assert.deepEqual(goodwillLimits(booking as never), { maxCents: 18800, fromCommissionCents: 2300 });
  const after = { ...booking, havenRefunds: [{ amountCents: 1500 }] };
  assert.equal(havenRefundedCents(after as never), 1500);
  assert.deepEqual(goodwillLimits(after as never), { maxCents: 17300, fromCommissionCents: 800 });
  assert.equal(goodwillLimits({ ...booking, havenRefunds: [{ amountCents: 18800 }] } as never).maxCents, 0);
});
