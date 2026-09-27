import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './server.mjs';

test('HTTP boundary limits payloads and safely decodes page IDs', async t => {
  let mutations = 0;
  let pageId;
  const store = {
    ready: true,
    health: () => ({ ok: true, service: 'brain' }),
    getPage: id => { pageId = id; return { page: { id } }; },
    ingest: async () => { mutations++; return { ok: true }; },
    reset: async () => { mutations++; return { ok: true }; },
  };
  const server = createServer(store);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4719, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (path, options = {}) => fetch(`http://127.0.0.1:4719${path}`, { ...options, signal: AbortSignal.timeout(5000) });
  let response = await request('/v1/pages/medications%2Flisinopril');
  assert.equal(response.status, 200);
  assert.equal(pageId, 'medications/lisinopril');
  response = await request('/v1/pages/%GG');
  assert.equal(response.status, 400);
  response = await request('/v1/ingest', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(response.status, 415);
  response = await request('/v1/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(response.status, 400);
  response = await request('/v1/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'a'.repeat(70_000) }) });
  assert.equal(response.status, 413);
  response = await request('/v1/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: '{}' });
  assert.equal(response.status, 403);
  response = await request('/v1/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"unexpected":true}' });
  assert.equal(response.status, 400);
  assert.equal(mutations, 0);
  response = await request('/v1/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 200);
  assert.equal(mutations, 1);
});
