import test from 'node:test';
import assert from 'node:assert/strict';
import { pollWhileVisible } from './visiblePolling';

test('refreshes only while visible, and at once on coming back', () => {
  let state = 'visible';
  const listeners: (() => void)[] = [];
  let tick: () => void = () => undefined;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.document = { get visibilityState() { return state; }, addEventListener: (_: string, fn: () => void) => listeners.push(fn), removeEventListener: () => listeners.splice(0) };
  globals.window = { setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval: () => { tick = () => undefined; } };
  let calls = 0;
  const stop = pollWhileVisible(() => { calls += 1; }, 30_000);
  tick(); assert.equal(calls, 1);
  state = 'hidden'; tick(); tick(); assert.equal(calls, 1);
  state = 'visible'; listeners.forEach(fn => fn()); assert.equal(calls, 2);
  stop(); tick(); assert.equal(calls, 2);
  delete globals.document; delete globals.window;
});
