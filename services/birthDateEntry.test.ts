import assert from 'node:assert/strict';
import test from 'node:test';
import { birthDateFromParts, parsePastedBirthDate, partsFromBirthDate, updateBirthDatePart } from './birthDateEntry';
import { isValidPastBirthDate } from './profileVerification';

test('la saisie avance automatiquement après le jour et le mois', () => {
  const day = updateBirthDatePart(['', '', ''], 0, '13');
  assert.equal(day.advance, true);
  assert.equal(day.value, '');
  const month = updateBirthDatePart(day.parts, 1, '10');
  assert.equal(month.advance, true);
  const year = updateBirthDatePart(month.parts, 2, '2000');
  assert.equal(year.advance, false);
  assert.equal(year.value, '2000-10-13');
});

test('une date existante reste modifiable par segment sans décaler les autres', () => {
  const initial = partsFromBirthDate('1990-11-24');
  assert.deepEqual(initial, ['24', '11', '1990']);
  assert.equal(updateBirthDatePart(initial, 0, '25').value, '1990-11-25');
  assert.equal(updateBirthDatePart(initial, 1, '12').value, '1990-12-24');
  assert.equal(updateBirthDatePart(initial, 2, '1985').value, '1985-11-24');
  assert.equal(updateBirthDatePart(initial, 1, '').value, '');
});

test('coller une date complète accepte les formats français et ISO', () => {
  for (const source of ['13/10/2000', '13.10.2000', '13102000', '2000-10-13']) {
    const parsed = parsePastedBirthDate(source);
    assert.ok(parsed);
    assert.equal(birthDateFromParts(parsed), '2000-10-13');
  }
  assert.equal(parsePastedBirthDate('date inconnue'), null);
});

test('une date impossible ou future est toujours refusée avant enregistrement', () => {
  assert.equal(isValidPastBirthDate(birthDateFromParts(['31', '02', '2000']), '2026-10-13'), false);
  assert.equal(isValidPastBirthDate(birthDateFromParts(['14', '10', '2026']), '2026-10-13'), false);
  assert.equal(isValidPastBirthDate(birthDateFromParts(['13', '10', '2000']), '2026-10-13'), true);
});
