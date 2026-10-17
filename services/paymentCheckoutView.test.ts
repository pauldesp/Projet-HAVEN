import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { PaymentCheckoutView } from '../components/PaymentCheckoutView';
import type { CheckoutDetails } from './paymentCheckout';

const details = { mode: 'SIMULATION', booking: { id: 'b-test', listingId: 'listing', roomName: 'Chambre Horizon', startDate: '2026-11-07', endDate: '2026-11-14', createdAt: new Date().toISOString(), status: 'PENDING', paymentStatus: 'PENDING', totalPrice: 161, basePrice: 140, cleaningFee: 0, platformFee: 21 }, listing: { title: 'Coloc Martin', city: 'Paris', image: '' }, customer: { name: 'Compte Test', email: 'test@example.test' }, expiresAt: null } as CheckoutDetails;
const render = (data: CheckoutDetails) => renderToStaticMarkup(React.createElement(StaticRouter, { location: '/payment/b-test' }, React.createElement(PaymentCheckoutView, { details: data, busy: false, error: '', onPay: () => {} })));

test('the simulation checkout is visibly a test, has read-only fictitious card details and does not claim confirmation', () => {
  const html = render(details);
  assert.match(html, /aucun débit bancaire/);
  assert.match(html, /Simuler le paiement/);
  assert.match(html, /readonly=""/i);
  assert.match(html, /4242 4242 4242 4242/);
  assert.doesNotMatch(html, /Votre réservation est confirmée/);
});
test('real mode delegates card collection to Stripe and settled mode only shows confirmation', () => {
  const real = render({ ...details, mode: 'STRIPE' });
  assert.doesNotMatch(real, /4242 4242 4242 4242|Simuler le paiement/);
  const confirmed = render({ ...details, booking: { ...details.booking, status: 'CONFIRMED', paymentStatus: 'PAID', paymentIsTest: true } });
  assert.match(confirmed, /Votre réservation est confirmée/);
  assert.match(confirmed, /Voir mes séjours/);
  assert.doesNotMatch(confirmed, /<form/);
});
