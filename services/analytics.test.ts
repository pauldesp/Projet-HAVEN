import test from 'node:test';
import assert from 'node:assert/strict';
import { addToDelta, pageKind, parisDayAndHour, sumDays, topEntries, trafficSource, validEvent, change } from './analytics';

test('les pages sont regroupées par type, sans identifiant, et le back office n’est pas mesuré', () => {
  assert.equal(pageKind('/listing/abc123'), 'listing');
  assert.equal(pageKind('/payment/b-123?cancelled=1'), 'payment');
  assert.equal(pageKind('/owner/edit/xyz'), 'publish');
  assert.equal(pageKind('/'), 'home');
  assert.equal(pageKind('/admin/dashboard'), null);
  assert.equal(pageKind('/une-page-inconnue'), 'other');
});

test('la provenance ne garde que le nom du site ou la campagne', () => {
  assert.equal(trafficSource('https://www.google.fr/search?q=coloc', 'havencoloc.fr'), 'google');
  assert.equal(trafficSource('https://l.instagram.com/?u=x', 'havencoloc.fr'), 'instagram');
  assert.equal(trafficSource('https://havencoloc.fr/#/search', 'havencoloc.fr'), 'direct');
  assert.equal(trafficSource('https://checkout.stripe.com/c/pay', 'havencoloc.fr'), 'direct');
  assert.equal(trafficSource('', 'havencoloc.fr', 'Newsletter_Nov'), 'newsletter_nov');
  assert.equal(trafficSource('https://www.lemonde.fr/article?id=1', 'havencoloc.fr'), 'lemonde.fr');
});

test('les événements inattendus sont refusés', () => {
  assert.equal(validEvent({ type: 'page', page: '/listing/123' }), null, 'une adresse de page brute est refusée');
  assert.equal(validEvent({ type: 'search', city: '12 rue de la Paix' }), null, 'une adresse n’est jamais enregistrée');
  assert.deepEqual(validEvent({ type: 'search', city: 'saint-étienne', recurring: true }), { type: 'search', city: 'Saint-étienne', recurring: true });
  assert.equal(validEvent({ type: 'step', step: 'hack' }), null);
  assert.equal(validEvent({ type: 'session', source: 'google', device: 'fridge', landing: 'home' }), null);
  assert.equal(validEvent(null), null);
});

test('les totaux du jour s’additionnent puis se cumulent sur une période', () => {
  const delta = addToDelta({}, [
    { type: 'session', source: 'google', device: 'mobile', landing: 'home' },
    { type: 'page', page: 'home' }, { type: 'page', page: 'search' },
    { type: 'search', city: 'Lyon', recurring: false },
    { type: 'step', step: 'search' }, { type: 'listing_view', listingId: 'l1' }, { type: 'signup' },
  ], 21);
  assert.equal(delta.sessions, 1);
  assert.equal(delta.pageviews, 2);
  assert.deepEqual(delta.funnel, { visit: 1, search: 1 });
  assert.deepEqual(delta.hours, { 21: 1 });
  const total = sumDays([{ ...delta, date: '2026-11-10' }, { sessions: 2, pages: { home: 3 }, date: '2026-11-11' }]);
  assert.equal(total.sessions, 3);
  assert.equal(total.pages.home, 4);
  assert.deepEqual(topEntries({ a: 5, b: 3, c: 1, d: 1 }, 2), [{ key: 'a', count: 5 }, { key: 'b', count: 3 }, { key: 'Autres', count: 2 }]);
  assert.equal(change(15, 10), 50);
  assert.equal(change(5, 0), null);
});

test('une visite à 0 h 30 à Paris compte pour le bon jour', () => {
  assert.deepEqual(parisDayAndHour(new Date('2026-11-11T23:30:00Z')), { date: '2026-11-12', hour: 0 });
});
