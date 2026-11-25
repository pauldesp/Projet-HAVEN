import assert from 'node:assert/strict';
import test from 'node:test';
import { CONNECT_ON_BEHALF_POLICY, canChargeOnBehalf, cancellationRefundBearer, onBehalfChargeData, onBehalfRefundOptions, ownerNetCents, refundOptionsFor } from './onBehalfPayments';

test('a stay is charged on behalf of the owner, Haven taking only its service fee', () => {
  assert.deepEqual(onBehalfChargeData('acct_123', 3000), { on_behalf_of: 'acct_123', transfer_data: { destination: 'acct_123' }, application_fee_amount: 3000 });
  assert.deepEqual(onBehalfChargeData('acct_123', 0), { on_behalf_of: 'acct_123', transfer_data: { destination: 'acct_123' } }, 'caution : pas de frais Haven');
  assert.throws(() => onBehalfChargeData('pas-un-compte', 100));
  assert.throws(() => onBehalfChargeData('acct_1', -1));
});

test('only an owner account accepting cards can be the merchant', () => {
  assert.equal(canChargeOnBehalf({ charges_enabled: true, capabilities: { card_payments: 'active' } }), true);
  assert.equal(canChargeOnBehalf({ charges_enabled: true, capabilities: { card_payments: 'pending' } }), false);
  assert.equal(canChargeOnBehalf({ charges_enabled: false, capabilities: { card_payments: 'active' } }), false);
  assert.equal(canChargeOnBehalf({}), false);
});

test('refunds: full ones return the fee, partial ones are taken from the owner, goodwill from Haven', () => {
  assert.equal(cancellationRefundBearer(100), 'FULL');
  assert.equal(cancellationRefundBearer(50), 'OWNER_SHARE');
  assert.deepEqual(onBehalfRefundOptions('FULL'), { reverse_transfer: true, refund_application_fee: true });
  assert.deepEqual(onBehalfRefundOptions('OWNER_SHARE'), { reverse_transfer: true, refund_application_fee: false });
  assert.deepEqual(onBehalfRefundOptions('HAVEN_ONLY'), { reverse_transfer: false, refund_application_fee: false });
  assert.deepEqual(refundOptionsFor('haven-connect-arrival-v1', 'FULL'), {}, 'anciens paiements : inchangés');
  assert.deepEqual(refundOptionsFor(CONNECT_ON_BEHALF_POLICY, 'FULL'), { reverse_transfer: true, refund_application_fee: true });
});

test('the owner net is the transfer minus reversals and the fee Haven keeps', () => {
  // 240 € paid: 30 € fee. Cancellation at 10 days: 105 € refunded from the owner's share, fee kept.
  assert.equal(ownerNetCents({ amount: 24000, amount_reversed: 0 }, { amount: 3000, amount_refunded: 0 }), 21000);
  assert.equal(ownerNetCents({ amount: 24000, amount_reversed: 10500 }, { amount: 3000, amount_refunded: 0 }), 10500);
  assert.equal(ownerNetCents({ amount: 24000, amount_reversed: 24000 }, { amount: 3000, amount_refunded: 3000 }), 0);
  assert.equal(ownerNetCents({ amount: 5000, amount_reversed: 0 }, null), 5000, 'caution : tout pour le propriétaire');
});
