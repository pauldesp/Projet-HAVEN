import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryDocumentHtml } from './inventoryDocument';
import type { InventoryReport } from '../types';
test('the downloadable report uses saved findings and escapes user content', () => {
  const html = inventoryDocumentHtml({ date: '2026-11-07T15:00:00Z', bookingId: 'b-test', comments: JSON.stringify({ assessments: { ROOM: { clean: false, comment: '<script>alert(1)</script>', photos: ['javascript:alert(1)'] } } }) } as InventoryReport, 'État des lieux');
  assert.match(html, /Propre : <b>Non/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|javascript:/);
});
