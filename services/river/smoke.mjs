import assert from 'node:assert/strict';

const url = 'http://127.0.0.1:4704';
const health = await fetch(`${url}/health`, {signal: AbortSignal.timeout(5000)}).then(r => r.json());
assert.equal(health.ok, true);
assert.equal(health.service, 'river');
const status = await fetch(`${url}/v1/status`, {signal: AbortSignal.timeout(5000)}).then(r => r.json());
assert.equal(status.mode, 'deterministic');
assert.equal(status.externalSubmissionAuthorized, true);
assert.equal(status.extractionAvailable, false);
if (status.metrics !== null) assert.equal(status.metrics.paired, true);
const extraction = await fetch(`${url}/v1/extract`, {
  method: 'POST', headers: {'content-type': 'application/json'},
  body: JSON.stringify({note: 'Synthetic cardiology note with Ana.', date: '2026-09-27', authorId: 'people/ana-alvarez'}),
  signal: AbortSignal.timeout(5000),
});
assert.equal(extraction.status, 503);
assert.equal((await extraction.json()).error.code, 'RIVER_UNAVAILABLE');
console.log('River smoke passed: local health/status and honest extraction fallback.');
