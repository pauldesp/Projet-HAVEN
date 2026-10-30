import test, { after } from 'node:test';
import { getApps, deleteApp } from 'firebase/app';
after(async () => { await Promise.all(getApps().map(app => deleteApp(app))); });
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import { englishUi, translateActivity, translateUiText } from './uiTranslations';
import { ACTIVITIES, INTERESTS } from './publicProfile';
import { TenantCommunityProfile } from '../components/TenantCommunityProfile';
import { UserRole, type User } from '../types';

test('English covers account navigation, occupations and every selectable interest without changing stored values', () => {
  for (const text of ['Mon compte', 'Mon profil', 'Informations personnelles', 'Mon domicile', 'Mes documents', 'Vérification du compte', 'Enregistrer', ...Object.values(ACTIVITIES), ...INTERESTS]) assert.ok(englishUi[text], text);
  assert.equal(translateUiText('Mon compte', 'en'), 'My account');
  assert.equal(translateUiText('Mon compte', 'fr'), 'Mon compte');
  assert.equal(translateUiText('École du Centre', 'en'), 'École du Centre');
  assert.equal(translateActivity('Étudiant · École du Centre', 'en'), 'Student · École du Centre');
  assert.equal(INTERESTS[0], 'Voyages');
});
test('a saved English preference is applied to profile rendering and French remains available', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved = 'en';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved } });
  try {
    const user = { id: 'u', firstName: 'Voyages', lastName: 'Private', email: 'private@example.test', role: UserRole.TENANT, age: 25, activityLabel: 'Étudiant · École du Centre', interests: ['Lecture', 'Cuisine'] } as User;
    const render = () => renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(TenantCommunityProfile, { user, own: false, onSaved: async () => {} })));
    const english = render();
    assert.match(english, /Tenant profile/); assert.match(english, /25 years old/); assert.match(english, /Student · École du Centre/); assert.match(english, /Reading/); assert.match(english, /Cooking/);
    assert.match(english, /Voyages/); assert.doesNotMatch(english, /Private|private@example/);
    saved = 'fr'; const french = render(); assert.match(french, /Profil locataire/); assert.match(french, /25 ans/); assert.match(french, /Lecture/);
    saved = 'invalid'; const Probe = () => React.createElement('p', null, useLanguage().language); assert.equal(renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(Probe))), '<p>fr</p>');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
