import assert from 'node:assert/strict';
import http from 'node:http';
import { HOST, PORTS } from '../../contract/index.mjs';

const base = `http://${HOST}:${PORTS.sponsors}`;
const clinicBase = `http://${HOST}:${PORTS.clinic}`;

async function request(path, body, expected = 200, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(7000),
  });
  const value = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`);
  if (expected >= 400) assert.equal(typeof value.error?.message, 'string');
  return value;
}

export async function smoke() {
  const health = await request('/health');
  assert.equal(health.service, 'sponsors');
  assert.equal(health.synthetic, true);
  const clinicHealth = await fetch(`${clinicBase}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
  assert.equal(clinicHealth.service, 'sponsors-clinic');
  const clinicPage = await fetch(`${clinicBase}/`, { signal: AbortSignal.timeout(5000) }).then((r) => r.text());
  assert.match(clinicPage, /synthetic|fictional/i);
  assert.match(clinicPage, /Not medical advice/);

  const status = await request('/v1/status');
  assert.equal(status.memorable.mode, 'local-simulation');
  assert.equal(status.ufo.mode, 'local-http-fetch');
  assert.notEqual(status.memorable.remoteSubmissionEnabledInService, true);
  assert.equal(status.ufo.officialUfoExecution, false);
  await request('/v1/reset', {});
  await request('/v1/procedure/replay', {}, 409);
  const captured = await request('/v1/procedure/capture', {});
  assert.equal(captured.mode, 'local-simulation');
  assert.ok(captured.procedureId);
  assert.ok(captured.steps.length >= 3);
  assert.equal(captured.evidence.synthetic, true);
  const repeated = await request('/v1/procedure/capture', {});
  assert.equal(repeated.procedureId, captured.procedureId);
  const replayed = await request('/v1/procedure/replay', { procedureId: captured.procedureId });
  assert.equal(replayed.actorId, 'people/ben-alvarez');
  assert.equal(replayed.mode, 'local-simulation');
  assert.ok(replayed.result);
  assert.equal(replayed.evidence.synthetic, true);
  await request('/v1/procedure/replay', { procedureId: captured.procedureId, actorId: 'people/ana-alvarez' }, 409);
  const payload = await request('/v1/procedure/memorable-payload');
  assert.ok(payload);

  const clinic = await request('/v1/clinic/fetch', {});
  assert.equal(clinic.sourceUrl, `${clinicBase}/`);
  assert.equal(clinic.mode, 'local-http-fetch');
  for (const field of ['name', 'hours', 'phone']) assert.ok(clinic.clinic[field]);
  assert.equal(clinic.evidence.synthetic, true);
  assert.equal(clinic.evidence.officialUfoExecution, false);
  const refetched = await request('/v1/clinic/fetch', {});
  assert.deepEqual(refetched.clinic, clinic.clinic);
  await request('/v1/clinic/fetch', { url: 'https://example.com' }, 400);
  await request('/v1/reset', { arbitrary: true }, 400);
  await request('/v1/procedure/capture', [], 400);
  await request('/v1/procedure/capture', { actorId: 'real-person' }, 400);
  await request('/health', undefined, 403, { origin: 'https://example.com' });
  const forbiddenHostStatus = await new Promise((resolve, reject) => {
    const req = http.get(`${base}/health`, { headers: { host: 'example.com' }, timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.once('error', reject);
    req.once('timeout', () => req.destroy(new Error('Host test timed out.')));
  });
  assert.equal(forbiddenHostStatus, 403);
  await request('/missing', undefined, 404);
  const malformed = await fetch(`${base}/v1/procedure/capture`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{', signal: AbortSignal.timeout(5000),
  });
  assert.equal(malformed.status, 400);
  const oversized = await fetch(`${base}/v1/procedure/capture`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(33000) }), signal: AbortSignal.timeout(5000),
  });
  assert.equal(oversized.status, 413);
  const chunkedStatus = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/v1/procedure/capture`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, timeout: 5000,
    }, (res) => { res.resume(); resolve(res.statusCode); });
    req.once('error', reject);
    req.once('timeout', () => req.destroy(new Error('Chunked body test timed out.')));
    req.write('{"value":"');
    req.end(`${'x'.repeat(33000)}"}`);
  });
  assert.equal(chunkedStatus, 413);
  await request('/v1/reset', {});
  await request('/v1/procedure/replay', {}, 409);
  return { ok: true, service: 'sponsors', checks: ['health', 'capture', 'distinct-sibling-replay', 'memorable-payload', 'real-local-http-fetch', 'repeatable-clinic', 'reset', 'input-bounds', 'origin-and-host'], externalSubmissions: 0 };
}

console.log(JSON.stringify(await smoke()));
