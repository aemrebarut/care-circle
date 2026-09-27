import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { DEMO_NOTE, IDS } from '../../../contract/index.mjs';
import { createIngestServer } from '../server.mjs';
import { extractDeterministic } from '../extract.mjs';

const URL = 'http://127.0.0.1:4713';
const receipt = { ok: true, visitId: 'visits/synthetic-test', changedPageIds: ['visits/synthetic-test', IDS.lisinopril], revision: 7 };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
async function withServer(options, fn) {
  const server = createIngestServer(options);
  server.listen(4713, '127.0.0.1');
  await once(server, 'listening');
  try { await fn(); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
async function post(path, body, options = {}) {
  const response = await fetch(`${URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', connection: 'close' }, body: JSON.stringify(body), ...options });
  return { status: response.status, data: await response.json() };
}

test('HTTP health and extract are read-only; source and attendee metadata survive commit', async () => {
  const calls = [];
  await withServer({ fetchImpl: async (url, options) => { calls.push({ url, payload: JSON.parse(options.body), redirect: options.redirect }); return reply(receipt); } }, async () => {
    assert.equal((await fetch(`${URL}/health`, { headers: { connection: 'close' } })).status, 200);
    const preview = await post('/v1/extract', { note: DEMO_NOTE, authorId: IDS.ben });
    assert.equal(preview.status, 200);
    assert.equal(calls.length, 0);
    const first = await post('/v1/ingest', { note: DEMO_NOTE, authorId: IDS.ben });
    const second = await post('/v1/ingest', { note: DEMO_NOTE, authorId: IDS.ben });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(first.data.applied, receipt);
    assert.equal(first.data.idempotencyKey, second.data.idempotencyKey);
    assert.equal(calls.length, 2, 'always call durable brain, so reset cannot be hidden by a local cache');
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[0].url, 'http://127.0.0.1:4701/v1/ingest');
    assert.equal(calls[0].payload.note, DEMO_NOTE);
    assert.equal(calls[0].payload.authorId, IDS.ben);
    assert.deepEqual(calls[0].payload.extraction.visit.attendeeIds, [IDS.ana]);
    assert.equal(calls[0].redirect, 'error');
  });
});

test('invalid, unsupported and oversized requests never call brain', async () => {
  await withServer({ fetchImpl: () => assert.fail('No upstream call allowed') }, async () => {
    assert.equal((await post('/v1/ingest', { note: 'invent a medication change' })).status, 422);
    assert.equal((await post('/v1/ingest', { note: DEMO_NOTE, date: '2026-02-30' })).status, 400);
    for (const path of ['/v1/extract', '/v1/ingest']) {
      assert.equal((await post(path, { note: DEMO_NOTE, date: '2026-10-01' })).status, 422);
      assert.equal((await post(path, { note: 'Cardiology 2026-10-01 with Ana.' })).status, 422);
    }
    assert.equal((await post('/v1/extract', { note: DEMO_NOTE, idempotencyKey: 'not-for-preview' })).status, 400);
    assert.equal((await post('/v1/ingest', { note: 'x'.repeat(70000) })).status, 413);
    assert.equal((await post('/v1/ingest', {}, { body: '{' })).status, 400);
    assert.equal((await post('/v1/ingest', {}, { headers: { 'content-type': 'text/plain' } })).status, 415);
    assert.equal((await fetch(`${URL}/v1/extract`, { headers: { connection: 'close' } })).status, 405);
    assert.equal((await fetch(`${URL}/missing`, { headers: { connection: 'close' } })).status, 404);
  });
});

test('brain rejection and key conflict cannot become success', async () => {
  for (const status of [409, 422, 503]) {
    await withServer({ fetchImpl: async () => reply({ error: { code: 'upstream', message: 'private implementation detail' } }, status) }, async () => {
      const result = await post('/v1/ingest', { note: DEMO_NOTE, idempotencyKey: 'retry-key' });
      assert.equal(result.status, status);
      assert.equal(result.data.error.idempotencyKey, 'retry-key');
      assert.equal(result.data.applied, undefined);
      assert.equal(JSON.stringify(result.data).includes('private implementation detail'), false);
    });
  }
});

test('uncertain brain timeout, disconnect and malformed receipt preserve retry key', async () => {
  for (const fetchImpl of [
    async () => { throw new DOMException('Timeout', 'TimeoutError'); },
    async () => { throw new TypeError('connect failed'); },
    async () => reply({ ok: true }),
    async () => reply({ ok: true, visitId: 'visits/', changedPageIds: [], revision: '' }),
    async () => new Response('invalid JSON'),
    async () => new Response('x'.repeat(1024 * 1024 + 1)),
  ]) {
    await withServer({ fetchImpl }, async () => {
      const result = await post('/v1/ingest', { note: DEMO_NOTE, idempotencyKey: 'retry-exact-key' });
      assert.ok([502, 504].includes(result.status));
      assert.equal(result.data.error.idempotencyKey, 'retry-exact-key');
      assert.equal(result.data.error.outcome, 'unknown');
      assert.equal(result.data.error.retryable, true);
      assert.equal(result.data.applied, undefined);
    });
  }
});

test('River failure, invalid provenance and deterministic mode explicitly fall back', async () => {
  const good = extractDeterministic({ note: DEMO_NOTE });
  const hallucinated = structuredClone(good);
  hallucinated.method = 'river';
  hallucinated.extraction.medicationChanges[0].dose = '80 mg';
  for (const response of [reply({ error: { code: 'unavailable' } }, 503), reply(hallucinated), reply(good)]) {
    await withServer({ useRiver: true, fetchImpl: async () => response }, async () => {
      const result = await post('/v1/extract', { note: DEMO_NOTE });
      assert.equal(result.status, 200);
      assert.equal(result.data.method, 'deterministic');
      assert.equal(result.data.extraction.medicationChanges[0].dose, '20 mg');
      assert.ok(result.data.warnings.some(value => value.includes('River was unavailable')));
    });
  }
});

test('River may label verified identical extraction; normalized source metadata sent', async () => {
  const good = extractDeterministic({ note: DEMO_NOTE });
  await withServer({ useRiver: true, fetchImpl: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:4704/v1/extract');
    assert.deepEqual(JSON.parse(options.body), { note: DEMO_NOTE, authorId: IDS.ana, date: '2026-09-27' });
    return reply({ ...good, method: 'river' });
  } }, async () => {
    const result = await post('/v1/extract', { note: DEMO_NOTE });
    assert.equal(result.data.method, 'river');
    assert.deepEqual(result.data.extraction, good.extraction);
  });
});


test('unfinished body gets bounded JSON 408 without touching upstream', async () => {
  await withServer({ requestBodyTimeoutMs: 25, fetchImpl: () => assert.fail('No upstream call allowed') }, async () => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 4713 });
    await once(socket, 'connect');
    const chunks = [];
    socket.on('data', chunk => chunks.push(chunk));
    socket.write('POST /v1/ingest HTTP/1.1\r\nHost: 127.0.0.1:4713\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{');
    await once(socket, 'end');
    const response = Buffer.concat(chunks).toString();
    assert.match(response, /^HTTP\/1\.1 408/);
    const body = JSON.parse(response.split('\r\n\r\n')[1]);
    assert.equal(body.error.code, 'request_timeout');
    socket.destroy();
  });
});
