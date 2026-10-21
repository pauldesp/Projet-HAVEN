import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryDocumentHtml } from './inventoryDocument';
import type { InventoryReport } from '../types';
test('the downloadable report uses saved findings and escapes user content', () => {
  const html = inventoryDocumentHtml({ date: '2026-11-07T15:00:00Z', bookingId: 'b-test', comments: JSON.stringify({ assessments: { ROOM: { clean: false, comment: '<script>alert(1)</script>', photos: ['javascript:alert(1)'] } } }) } as InventoryReport, 'État des lieux');
  assert.match(html, /<dt>Propre<\/dt><dd class="issue">Non/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|javascript:/);
});


test('presentation adds available stay information without changing the saved inspection', () => {
  const report = { id: 'inspection', tenantId: 'tenant', bookingId: 'booking', type: 'IN', date: '2026-10-20T15:00:00Z', comments: JSON.stringify({ assessments: { ROOM: { clean: true, tidy: true, conditionOk: true } } }) } as InventoryReport;
  const original = JSON.stringify(report);
  const html = inventoryDocumentHtml(report, 'État des lieux', {
    booking: { id: 'booking', listingId: 'listing', roomId: 'room', startDate: '2026-10-20', endDate: '2026-10-27', checkInTime: '15:00', checkOutTime: '11:00' } as any,
    listing: { id: 'listing', title: 'Maison Exemple', address: '12 rue Exemple', city: 'La Rochelle', rooms: [{ id: 'room', name: 'Horizon', size: 14 }] } as any,
    tenant: { id: 'tenant', firstName: 'Camille', lastName: 'Exemple', email: 'camille@example.com' },
  });
  assert.match(html, /alt="Haven"/);
  assert.match(html, /12 rue Exemple, La Rochelle/);
  assert.match(html, /Camille Exemple/);
  assert.match(html, /20\/10\/2026 – 27\/10\/2026/);
  assert.match(html, /14 m²/);
  assert.equal(JSON.stringify(report), original);
  assert.doesNotMatch(html, /<form|<input|signature électronique|validation du propriétaire/i);
});
