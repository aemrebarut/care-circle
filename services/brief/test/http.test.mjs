import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createServer } from '../server.mjs';
import { fixture, doctorId } from './fixture.mjs';

test('HTTP endpoints, bounded input and upstream errors on reserved ports', async () => {
  let mode = 'ok';
  const upstream = http.createServer((req, res) => {
    assert.equal(req.url, '/v1/state');
    if (mode === 'timeout') return;
    res.writeHead(mode === 'error' ? 503 : 200, { 'content-type': 'application/json' });
    res.end(mode === 'bad-json' ? 'not json' : JSON.stringify(fixture()));
  });
  const server = createServer({ brainUrl: 'http://127.0.0.1:4717', timeoutMs: 150 });
  try {
    upstream.listen(4717, '127.0.0.1');
    await once(upstream, 'listening');
    server.listen(4718, '127.0.0.1');
    await once(server, 'listening');
    const get = (path, init) => fetch(`http://127.0.0.1:4718${path}`, init);
    const health = await (await get('/health')).json();
    assert.equal(health.service, 'brief');
    assert.equal(health.ok, true);
    const brief = await (await get('/v1/previsit', { method: 'POST', body: JSON.stringify({ doctorId }) })).json();
    assert.equal(brief.since, '2026-09-15');
    assert.equal(brief.contradictions.length, 1);
    assert.equal((await (await get('/v1/answer/medications')).json()).medications.length, 1);
    assert.equal((await (await get('/v1/contradictions')).json()).contradictions.length, 1);
    assert.equal((await get('/v1/previsit', { method: 'POST', body: '{}' })).status, 400);
    assert.equal((await get('/v1/previsit', { method: 'POST', body: '{' })).status, 400);
    assert.equal((await get('/v1/previsit', { method: 'POST', body: JSON.stringify({ doctorId: 'doctors/unknown' }) })).status, 404);
    assert.equal((await get('/v1/previsit', { method: 'POST', body: 'x'.repeat(17_000) })).status, 413);
    assert.equal((await get('/unknown')).status, 404);
    mode = 'error';
    let response = await get('/v1/contradictions');
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'BRAIN_UNAVAILABLE');
    mode = 'bad-json';
    assert.equal((await get('/v1/contradictions')).status, 502);
    mode = 'timeout';
    response = await get('/v1/contradictions');
    assert.equal(response.status, 504);
    assert.equal((await response.json()).error.code, 'BRAIN_TIMEOUT');
  } finally {
    for (const ownedServer of [server, upstream]) {
      ownedServer.closeAllConnections();
      await new Promise((resolve) => ownedServer.close(resolve));
    }
  }
});

test('upstream configuration refuses non-loopback and out-of-range ports', () => {
  for (const brainUrl of ['https://127.0.0.1:4701', 'http://localhost:4701', 'http://127.0.0.1:8787', 'http://example.com:4701', 'http://user:pass@127.0.0.1:4701']) {
    assert.throws(() => createServer({ brainUrl }), /loopback HTTP URL/);
  }
});
