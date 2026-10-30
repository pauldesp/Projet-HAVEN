import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createApiRequestBodyParser } from './apiRequestBody';

test('les limites HTTP acceptent un document optimisé sans augmenter les autres routes', async t => {
  const app = express();
  app.use(createApiRequestBodyParser());
  app.post('/api/users/me/identity-document', (req, res) => res.json({ received: req.body.documentDataUrl.length }));
  app.post('/api/users/me/residence', (req, res) => res.json({ received: req.body.documentDataUrl.length }));
  app.post('/api/stay-issues', (req, res) => res.json({ received: req.body.photo.length }));
  app.post('/api/listings/listing/access-instructions', (req, res) => res.json({ received: req.body.roomGuides.length }));
  app.post('/api/other', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) => fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });

  await t.test('un PDF factice de 600 Ko encodé en base64 passe intégralement', async () => {
    const documentDataUrl = `data:application/pdf;base64,${Buffer.alloc(600 * 1024, 65).toString('base64')}`;
    const response = await post('/api/users/me/identity-document', { documentDataUrl });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).received, documentDataUrl.length);
  });
  await t.test('un justificatif de domicile optimisé utilise la même enveloppe dédiée', async () => {
    const documentDataUrl = `data:application/pdf;base64,${Buffer.alloc(600 * 1024, 65).toString('base64')}`;
    const response = await post('/api/users/me/residence', { documentDataUrl, residence: { address: '12 rue Exemple', postalCode: '17000', city: 'La Rochelle', country: 'France' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).received, documentDataUrl.length);
  });
  await t.test('une photo d’incident optimisée de 600 Ko passe intégralement', async () => {
    const photo = `data:image/jpeg;base64,${Buffer.alloc(600 * 1024, 65).toString('base64')}`;
    const response = await post('/api/stay-issues', { photo });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).received, photo.length);
  });
  await t.test('un envoi dépassant la limite renvoie une erreur JSON compréhensible', async () => {
    const response = await post('/api/users/me/identity-document', { documentDataUrl: 'A'.repeat(950 * 1024) });
    assert.equal(response.status, 413);
    assert.match((await response.json()).error, /document.*taille autorisée/);
  });
  await t.test('les photos privées des chambres disposent de leur enveloppe dédiée', async () => {
    const roomGuides = 'A'.repeat(1200 * 1024);
    const response = await post('/api/listings/listing/access-instructions', { roomGuides });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).received, roomGuides.length);
  });
  await t.test('les autres routes conservent la limite de 100 Ko', async () => {
    const response = await post('/api/other', { data: 'A'.repeat(110 * 1024) });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, '413');
  });
});
