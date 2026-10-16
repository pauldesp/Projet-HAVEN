import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminAuditJournal } from '../components/AdminAuditJournal';
import type { AdminAuditEntry, User } from '../types';
import type { AuditContext } from './auditPresentation';
const entry: AdminAuditEntry = { id: 'event-1', actorId: 'admin-1', actorName: 'Paul Desplanques', category: 'ACCOUNT', action: 'USER_APPROVED', targetType: 'USER', targetId: 'WrD4XgpDSyNeuabT35FN1SoCJB43', summary: 'Profil et identité validés après examen du dossier.', createdAt: '2026-10-16T21:14:21Z' };
const context: AuditContext = { users: [{ id: entry.targetId, firstName: 'Alice', lastName: 'Paquiet', email: 'alice@example.test' } as User], listings: [], reports: [], contacts: [], incidents: [], bookings: [], legalDocs: [] };
const render = (entries: AdminAuditEntry[]) => renderToStaticMarkup(React.createElement(AdminAuditJournal, { entries, context, loading: false, error: null, onRefresh() {}, onOpenTarget() {} }));
test('la vue affiche la personne et l’action en français sans code technique dans le texte visible', () => {
  const html = render([entry]);
  const text = html.replace(/<[^>]*>/g, '');
  assert.match(text, /Alice Paquiet/);
  assert.match(text, /alice@example.test/);
  assert.match(text, /Profil validé/);
  assert.doesNotMatch(text, /USER_APPROVED|WrD4Xgp/);
  assert.match(html, /aria-expanded="false"/);
});
test('le journal affiche 25 lignes par page et conserve l’accès aux actions suivantes', () => {
  const html = render(Array.from({ length: 30 }, (_, index) => ({ ...entry, id: `event-${index}` })));
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 25);
  assert.match(html, /Suivant/);
  assert.match(html.replace(/<[^>]*>/g, ''), /30 action/);
});
