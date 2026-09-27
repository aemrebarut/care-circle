import assert from 'node:assert/strict';
import { createServer as createHttpServer, request } from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { createServer, LIMITS } from './server.mjs';

// Ports 4719 and 4712 are reserved for this test. No running product service is called.
const PORT = 4719;
const STUB_PORT = 4712;
const calls = [];
let mode = 'ok';
let errorMetadata = {};
let checks = 0;
let upstreamImpl = syntheticUpstream;
let loopbackStub;

function syntheticUpstream(options, callback) {
  assert.equal(options.hostname, '127.0.0.1');
  assert.ok(options.port >= 4701 && options.port <= 4705);
  assert.equal(options.agent, false);
  assert.equal(options.headers.authorization, undefined);
  assert.equal(options.headers.cookie, undefined);
  const outgoing = new EventEmitter();
  let incoming;
  let destroyed = false;
  outgoing.destroy = () => { destroyed = true; incoming?.destroy(); };
  outgoing.end = (body) => {
    const call = { port: options.port, path: options.path, method: options.method, body: body ? JSON.parse(body.toString()) : undefined };
    calls.push(call);
    queueMicrotask(() => {
      if (destroyed || mode === 'timeout') return;
      if (mode === 'unavailable') { outgoing.emit('error', new Error('Synthetic connection failure')); return; }
      incoming = new PassThrough();
      incoming.headers = { 'content-type': mode === 'html' ? 'text/html' : 'application/json; charset=utf-8' };
      incoming.statusCode = mode === 'error' || mode === 'bad-error' ? 503 : mode === 'redirect' ? 302 : 200;
      if (mode === 'declared-large') incoming.headers['content-length'] = '2049';
      callback(incoming);
      if (destroyed) return;
      if (mode === 'interrupted') { incoming.emit('aborted'); return; }
      const value = mode === 'error' ? { error: { code: 'SYNTHETIC_UNAVAILABLE', message: 'Synthetic test failure.', ...errorMetadata }, internal: 'not forwarded' }
        : mode === 'array' ? []
        : { ok: true, synthetic: true, call };
      const text = mode === 'bad-json' ? '{bad'
        : mode === 'large' ? JSON.stringify({ synthetic: 'x'.repeat(3000) })
        : JSON.stringify(value);
      const split = Math.floor(text.length / 2);
      incoming.write(text.slice(0, split));
      incoming.end(text.slice(split));
    });
  };
  return outgoing;
}

const server = createServer({
  requestImpl: (...args) => upstreamImpl(...args),
  limits: { upstreamTimeoutMs: 1000, bodyTimeoutMs: 100, responseBytes: 2048 },
});

function send(path, { method = 'GET', body, raw, headers = {}, partial = false } = {}) {
  return new Promise((resolve, reject) => {
    const payload = raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined;
    const req = request({
      hostname: '127.0.0.1', port: PORT, path, method, agent: false,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('error', reject);
      res.once('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(text); } catch { /* Static files and HEAD have no JSON body. */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
        req.destroy();
      });
    });
    req.once('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('Smoke client timed out')));
    if (partial) req.write(payload);
    else req.end(payload);
  });
}

async function expectError(path, status, code, options) {
  const before = calls.length;
  const response = await send(path, options);
  assert.equal(response.status, status, `${path}: ${response.text}`);
  assert.equal(response.json?.error?.code, code, `${path}: ${response.text}`);
  assert.equal(typeof response.json.error.message, 'string');
  assert.equal(calls.length, before, `Rejected request reached upstream: ${path}`);
  checks += 1;
}

try {
  server.listen(PORT, '127.0.0.1');
  await once(server, 'listening');
  const health = await send('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.json, { ok: true, service: 'web', syntheticData: true });
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['cache-control'], 'no-store');
  checks += 1;

  const routes = [
    ['brain', 4701, 'state', 'GET'], ['brain', 4701, 'medications', 'GET'],
    ['brain', 4701, 'graph', 'GET'], ['brain', 4701, 'reset', 'POST'],
    ['brain', 4701, 'ingest', 'POST'], ['brain', 4701, 'pages/medications%2Flisinopril', 'GET'],
    ['ingest', 4702, 'extract', 'POST'], ['ingest', 4702, 'ingest', 'POST'],
    ['brief', 4703, 'contradictions', 'GET'], ['brief', 4703, 'previsit', 'POST'],
    ['brief', 4703, 'answer/medications', 'GET'], ['river', 4704, 'status', 'GET'],
    ['river', 4704, 'extract', 'POST'], ['sponsors', 4705, 'status', 'GET'],
    ['sponsors', 4705, 'reset', 'POST'], ['sponsors', 4705, 'procedure/capture', 'POST'],
    ['sponsors', 4705, 'procedure/replay', 'POST'], ['sponsors', 4705, 'procedure/memorable-payload', 'GET'],
    ['sponsors', 4705, 'clinic/fetch', 'POST'],
  ];
  for (const [service, port, endpoint, method] of routes) {
    const body = method === 'POST' ? { note: 'Synthetic smoke note.', idempotencyKey: 'web-smoke-only' } : undefined;
    const result = await send(`/api/${service}/${endpoint}`, { method, body, headers: { Authorization: 'synthetic-do-not-forward', Cookie: 'synthetic=do-not-forward' } });
    assert.equal(result.status, 200, result.text);
    assert.deepEqual(calls.at(-1), { port, path: `/v1/${endpoint}`, method, body });
    assert.equal(result.json.synthetic, true);
    checks += 1;
  }
  const page = await send('/api/brain/pages/medications/lisinopril');
  assert.equal(page.status, 200);
  assert.equal(calls.at(-1).path, '/v1/pages/medications%2Flisinopril');
  checks += 1;

  await expectError('/api/other/state', 404, 'NOT_FOUND');
  await expectError('/api/brain/unknown', 404, 'NOT_FOUND');
  await expectError('/api/brain/state?target=http://example.test', 400, 'QUERY_UNSUPPORTED');
  await expectError('/api/brain/state', 405, 'METHOD_NOT_ALLOWED', { method: 'DELETE' });
  await expectError('/api/brain/state', 400, 'BODY_UNEXPECTED', { raw: '{}', headers: { 'Content-Length': '2' } });
  await expectError('/api/ingest/ingest', 415, 'JSON_REQUIRED', { method: 'POST', raw: '{}' });
  await expectError('/api/ingest/ingest', 415, 'ENCODING_UNSUPPORTED', { method: 'POST', body: {}, headers: { 'Content-Encoding': 'gzip' } });
  await expectError('/api/ingest/ingest', 400, 'INVALID_JSON', { method: 'POST', raw: '{', headers: { 'Content-Type': 'application/json' } });
  await expectError('/api/ingest/ingest', 400, 'INVALID_JSON', { method: 'POST', body: [] });
  await expectError('/api/ingest/ingest', 413, 'BODY_TOO_LARGE', { method: 'POST', body: { note: 'x'.repeat(LIMITS.requestBytes) } });
  await expectError('/api/ingest/ingest', 413, 'BODY_TOO_LARGE', { method: 'POST', raw: '', headers: { 'Content-Type': 'application/json', 'Content-Length': String(LIMITS.requestBytes + 1) } });
  await expectError('/api/ingest/ingest', 408, 'BODY_TIMEOUT', { method: 'POST', raw: '{', headers: { 'Content-Type': 'application/json' }, partial: true });
  await expectError('/api/brain/state', 403, 'ORIGIN_FORBIDDEN', { headers: { Origin: 'https://example.test' } });
  await expectError('/api/brain/pages/%ZZ', 400, 'INVALID_PAGE_ID');
  await expectError('/api/brain/pages/..%2F..%2F.env', 400, 'INVALID_PAGE_ID');
  await expectError('/api/brain/pages/medications%252Flisinopril', 400, 'INVALID_PAGE_ID');
  await expectError('/api/brain/pages/http%3A%2F%2Fexample.test', 400, 'INVALID_PAGE_ID');
  await expectError('//example.test/api/brain/state', 400, 'INVALID_PATH');
  await expectError('/../server.mjs', 404, 'NOT_FOUND');
  await expectError('/%2e%2e/server.mjs', 404, 'NOT_FOUND');
  await expectError('/server.mjs', 404, 'NOT_FOUND');
  await expectError('/.env', 404, 'NOT_FOUND');
  await expectError('/health', 405, 'METHOD_NOT_ALLOWED', { method: 'POST', body: {} });
  await expectError('/health', 400, 'BODY_UNEXPECTED', { raw: '{}', headers: { 'Content-Length': '2' } });

  for (const [failure, status, code] of [
    ['unavailable', 502, 'UPSTREAM_UNAVAILABLE'], ['html', 502, 'UPSTREAM_INVALID_RESPONSE'],
    ['bad-json', 502, 'UPSTREAM_INVALID_RESPONSE'], ['array', 502, 'UPSTREAM_INVALID_RESPONSE'],
    ['bad-error', 502, 'UPSTREAM_INVALID_RESPONSE'], ['redirect', 502, 'UPSTREAM_INVALID_RESPONSE'],
    ['declared-large', 502, 'UPSTREAM_TOO_LARGE'], ['large', 502, 'UPSTREAM_TOO_LARGE'],
    ['interrupted', 502, 'UPSTREAM_UNAVAILABLE'], ['timeout', 504, 'UPSTREAM_TIMEOUT'],
    ['error', 503, 'SYNTHETIC_UNAVAILABLE'],
  ]) {
    mode = failure;
    const response = await send('/api/river/status');
    assert.equal(response.status, status, `${failure}: ${response.text}`);
    assert.equal(response.json?.error?.code, code, `${failure}: ${response.text}`);
    checks += 1;
  }
  mode = 'error';
  const baseError = { code: 'SYNTHETIC_UNAVAILABLE', message: 'Synthetic test failure.' };
  const retryDetails = { idempotencyKey: 'ingest-v1:synthetic-smoke-key', outcome: 'unknown', retryable: true, upstreamStatus: 503 };
  errorMetadata = { ...retryDetails, note: 'Synthetic internal detail.', debug: { notForBrowser: true } };
  const uncertain = await send('/api/ingest/ingest', { method: 'POST', body: { note: 'Synthetic retry metadata check.' } });
  assert.equal(uncertain.status, 503);
  assert.deepEqual(uncertain.json, { error: { ...baseError, ...retryDetails } });
  checks += 1;
  errorMetadata = { ...retryDetails, outcome: 'rejected', retryable: false, upstreamStatus: 409 };
  const rejected = await send('/api/ingest/ingest', { method: 'POST', body: {} });
  assert.deepEqual(rejected.json, { error: { ...baseError, ...errorMetadata } });
  checks += 1;
  errorMetadata = { idempotencyKey: 'x'.repeat(129), outcome: 'committed', retryable: 'true', upstreamStatus: '503' };
  const invalidMetadata = await send('/api/ingest/ingest', { method: 'POST', body: {} });
  assert.deepEqual(invalidMetadata.json, { error: baseError });
  checks += 1;
  errorMetadata = { idempotencyKey: 'invalid key\n', upstreamStatus: 200 };
  const unsafeMetadata = await send('/api/ingest/ingest', { method: 'POST', body: {} });
  assert.deepEqual(unsafeMetadata.json, { error: baseError });
  checks += 1;
  errorMetadata = retryDetails;
  const otherRoute = await send('/api/river/status');
  assert.deepEqual(otherRoute.json, { error: baseError });
  checks += 1;
  errorMetadata = {};
  mode = 'ok';

  loopbackStub = createHttpServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ synthetic: true, method: req.method, path: req.url, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
  });
  loopbackStub.listen(STUB_PORT, '127.0.0.1');
  await once(loopbackStub, 'listening');
  upstreamImpl = (options, callback) => {
    assert.equal(options.hostname, '127.0.0.1');
    assert.equal(options.port, 4702);
    return request({ ...options, port: STUB_PORT }, callback);
  };
  const transported = await send('/api/ingest/extract', { method: 'POST', body: { note: 'Synthetic local transport check.' } });
  assert.equal(transported.status, 200, transported.text);
  assert.deepEqual(transported.json, { synthetic: true, method: 'POST', path: '/v1/extract', body: { note: 'Synthetic local transport check.' } });
  checks += 1;
  upstreamImpl = syntheticUpstream;

  for (const [path, type] of [['/', 'text/html'], ['/styles.css', 'text/css'], ['/app.js', 'text/javascript'], ['/favicon.svg', 'image/svg+xml']]) {
    const result = await send(path);
    assert.equal(result.status, 200, `${path}: ${result.text}`);
    assert.ok(result.headers['content-type'].startsWith(type));
    assert.ok(result.text.length > 0);
    if (path === '/') assert.ok(result.text.includes('Not medical advice'));
    checks += 1;
  }
  const head = await send('/app.js', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.text, '');
  assert.ok(Number(head.headers['content-length']) > 0);
  checks += 1;
  console.log(`web smoke: ${checks} checks passed; synthetic upstream only; no family brain mutations`);
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  if (loopbackStub) {
    loopbackStub.closeAllConnections();
    await new Promise((resolve) => loopbackStub.close(resolve));
  }
}
