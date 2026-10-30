import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../contexts/LanguageContext';
import { StayPracticalInformation } from '../components/StayPracticalInformation';
import { normalizePracticalInfo } from './stayGuide';

const info = normalizePracticalInfo({ parking: 'Place privée 27', wifiName: 'Réseau privé', wifiPassword: '<secret-wifi>', usefulInfo: 'Entrée par le jardin' });
const render = (available: boolean) => renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(StayPracticalInformation, { available, info })));

test('the practical-information panel displays the release notice without rendering credentials before release', () => {
  const markup = render(false);
  assert.match(markup, /72 h/);
  for (const secret of ['Place privée 27', 'Réseau privé', 'secret-wifi', 'Entrée par le jardin']) assert.equal(markup.includes(secret), false);
});
test('released practical details are grouped into parking, Wi-Fi and useful information, as escaped text', () => {
  const markup = render(true);
  assert.match(markup, /Stationnement/); assert.match(markup, /Place privée 27/); assert.match(markup, /Réseau privé/);
  assert.match(markup, /&lt;secret-wifi&gt;/); assert.doesNotMatch(markup, /<secret-wifi>/); assert.match(markup, /Entrée par le jardin/);
});
