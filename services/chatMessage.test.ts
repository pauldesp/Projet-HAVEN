import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createChatMessage } from './chatMessage';
const httpCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } as Pick<Crypto, 'getRandomValues'>;
test('tenant and owner messages can be composed on the HTTP preview without randomUUID', () => {
  for (const [sender, receiver] of [['tenant', 'owner'], ['owner', 'tenant']]) {
    const message = createChatMessage('  Bonjour, puis-je vous poser une question ?  ', sender, receiver, 'booking', httpCrypto);
    assert.match(message.id, /^m-[a-f0-9]{32}$/);
    assert.equal(message.content, 'Bonjour, puis-je vous poser une question ?');
    assert.deepEqual(message.participants, [sender, receiver]);
    assert.equal(message.bookingId, 'booking');
    assert.equal(message.isRead, false);
    assert.ok(Number.isFinite(Date.parse(message.timestamp)));
  }
});
test('messages respect Firestore content bounds before attempting a write', () => {
  assert.throws(() => createChatMessage('   ', 'a', 'b', 'booking', httpCrypto));
  assert.throws(() => createChatMessage('x'.repeat(5000), 'a', 'b', 'booking', httpCrypto));
  assert.equal(createChatMessage('x'.repeat(4999), 'a', 'b', 'booking', httpCrypto).content.length, 4999);
});
