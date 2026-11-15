import test from 'node:test';
import assert from 'node:assert/strict';
import type { DamageClaim } from '../types';
import { damageMailContent, damageMailDisposition, damageMailId, damageMailJob } from './damageMail';

const claim: DamageClaim = {
  id: 'b1', bookingId: 'b1', listingId: 'l1', listingTitle: 'Coloc Martin', ownerId: 'o1', tenantId: 't1', stayEndDate: '2026-12-10',
  requestedCents: 8500, description: 'Porte de placard arrachée, devis 85 €.', photos: [], createdAt: '2026-12-11T09:00:00.000Z', status: 'SUBMITTED',
};

test('the tenant learns the amount, the reason and the date until which they can answer', () => {
  const mail = damageMailContent('CLAIM_OPENED', claim, 'Lucie', 'https://havencoloc.fr');
  assert.match(mail.subject, /répondez avant le 14 décembre/);
  assert.match(mail.text, /Bonjour Lucie,/);
  assert.match(mail.text, /85,00\s€/);
  assert.match(mail.text, /Porte de placard/);
  assert.match(mail.text, /Rien n’est prélevé sans décision de Haven/);
  assert.match(mail.text, /https:\/\/havencoloc\.fr\/#\/dashboard/);
});

test('each party is told the decision in its own words', () => {
  const decided = { ...claim, status: 'CHARGING' as const, decision: { amountCents: 6000, note: 'Usure déduite.', at: '2026-12-14T10:00:00.000Z', adminId: 'a', adminName: 'Paul' } };
  assert.match(damageMailContent('DECISION_TENANT', decided, 'Lucie').text, /a retenu 60,00\s€.*prélevé sur la carte/s);
  assert.match(damageMailContent('DECISION_OWNER', decided, 'Jean').text, /versé sur votre compte/);
  const rejected = { ...decided, status: 'REJECTED' as const };
  assert.match(damageMailContent('DECISION_TENANT', rejected, 'Lucie').text, /Aucun montant ne sera prélevé/);
});

test('a message is dropped once it no longer matches the claim', () => {
  const at = '2026-12-11T09:00:00.000Z';
  const now = Date.parse('2026-12-11T10:00:00.000Z');
  assert.equal(damageMailDisposition(damageMailJob('CLAIM_OPENED', 'b1', at), claim, now), 'SEND');
  assert.equal(damageMailDisposition(damageMailJob('CLAIM_OPENED', 'b1', at), { ...claim, status: 'REJECTED' }, now), 'CANCELLED');
  assert.equal(damageMailDisposition(damageMailJob('DECISION_TENANT', 'b1', at), claim, now), 'CANCELLED');
  assert.equal(damageMailDisposition(damageMailJob('CLAIM_OPENED', 'b1', at), undefined, now), 'CANCELLED');
  assert.equal(damageMailDisposition(damageMailJob('CLAIM_OPENED', 'b1', at), claim, Date.parse('2026-12-19T10:00:00.000Z')), 'EXPIRED');
  assert.equal(damageMailId('DECISION_OWNER', 'b1'), 'b1-DAMAGE-DECISION_OWNER');
});
