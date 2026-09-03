import test from 'node:test';
import assert from 'node:assert/strict';
import { readSearchDates, listingSearchLink } from './searchDates';
test('search dates survive listing links and a reload', () => {
  const params = new URLSearchParams('city=Niort&start=2099-10-04&end=2099-10-12');
  const link = listingSearchLink('abc', params);
  assert.equal(link, '/listing/abc?start=2099-10-04&end=2099-10-12');
  assert.deepEqual(readSearchDates(new URLSearchParams(link.split('?')[1])), {start:'2099-10-04', end:'2099-10-12'});
});
test('empty, past, invalid and reversed dates are not preselected', () => {
  const today = new Date(2026, 8, 3);
  assert.deepEqual(readSearchDates(new URLSearchParams(), today), {start:'', end:''});
  assert.deepEqual(readSearchDates(new URLSearchParams('start=2026-02-30&end=2026-10-01'), today), {start:'', end:''});
  assert.deepEqual(readSearchDates(new URLSearchParams('start=2026-09-02&end=2026-10-01'), today), {start:'', end:''});
  assert.deepEqual(readSearchDates(new URLSearchParams('start=2026-10-04&end=2026-10-01'), today), {start:'2026-10-04', end:''});
});
