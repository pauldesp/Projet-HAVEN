import test from 'node:test';
import assert from 'node:assert/strict';
import { PRICE_COMPARISON, comparisonNotice, comparisonStayLabel, havenIsCheapest } from './priceComparison';

test('the compared stay states city, guests and full dates', () => {
  assert.equal(comparisonStayLabel(), 'Séjour de 5 nuits à La Rochelle pour 1 personne, du dimanche 22 novembre au vendredi 27 novembre 2026');
});

test('the notice gives the survey date, the scope of prices and the sources once filled in', () => {
  const filled = { ...PRICE_COMPARISON, surveyedOn: '2026-06-02', hotel: { ...PRICE_COMPARISON.hotel, establishment: 'hotelF1 La Rochelle Nord' }, haven: { ...PRICE_COMPARISON.haven, example: 'Coloc Martin · chambre Horizon' } };
  const notice = comparisonNotice(filled);
  assert.match(notice, /relevés le 2 juin 2026/);
  assert.match(notice, /tous frais obligatoires inclus/);
  assert.match(notice, /Hôtel : hotelF1 La Rochelle Nord\./);
  assert.match(notice, /annonce « Coloc Martin · chambre Horizon »/);
  assert.match(notice, /n’est pas lié à Airbnb ni au groupe Accor/);
});

test('missing survey details are left out rather than invented', () => {
  const notice = comparisonNotice({ ...PRICE_COMPARISON, surveyedOn: null, hotel: { ...PRICE_COMPARISON.hotel, establishment: null } });
  assert.doesNotMatch(notice, /relevés le/);
  assert.match(notice, /Hôtel : hôtel F1\./);
});

test('the cheapest badge needs a Haven price below every other offer', () => {
  const withHaven = (priceEuros: number | null) => ({ ...PRICE_COMPARISON, haven: { ...PRICE_COMPARISON.haven, priceEuros } });
  assert.equal(havenIsCheapest(withHaven(null)), false);
  assert.equal(havenIsCheapest(withHaven(PRICE_COMPARISON.hotel.priceEuros)), false);
  assert.equal(havenIsCheapest(withHaven(PRICE_COMPARISON.hotel.priceEuros + 1)), false);
  assert.equal(havenIsCheapest(withHaven(PRICE_COMPARISON.hotel.priceEuros - 1)), true);
});
