import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerTaxRequestEmail } from './ownerTaxMail';
import { newTaxRequest } from './ownerTaxRequest';

const request = newTaxRequest('o', '2027-01-01T10:00:00.000Z');

test('the first mail reassures: payouts go on, 2 minutes, before the deadline', () => {
  const mail = ownerTaxRequestEmail(0, 'Martin', request, 'https://havencoloc.fr');
  assert.match(mail.text, /Bonjour Martin/);
  assert.match(mail.text, /première réservation payée/);
  assert.match(mail.text, /continuent normalement/);
  assert.match(mail.text, /2 mars 2027/);
  assert.doesNotMatch(mail.text, /suspend/);
  assert.match(mail.text, /https:\/\/havencoloc\.fr\/#\/owner\/dashboard\?tab=finances/);
});

test('only the last reminder mentions the payout hold', () => {
  assert.match(ownerTaxRequestEmail(1, 'Martin', request, undefined, Date.parse('2027-01-21T10:00:00Z')).text, /Il vous reste 40 jours/);
  assert.doesNotMatch(ownerTaxRequestEmail(1, 'Martin', request).text, /suspend/);
  assert.match(ownerTaxRequestEmail(2, 'Martin', request).text, /suspendre vos versements/);
});
