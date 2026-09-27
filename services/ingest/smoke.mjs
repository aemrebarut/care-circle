import assert from 'node:assert/strict';
import { DEMO_NOTE, HOST, PORTS } from '../../contract/index.mjs';

const base = `http://${HOST}:${PORTS.ingest}`;
const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
assert.equal(health.status, 200);
assert.equal((await health.json()).service, 'ingest');
const response = await fetch(`${base}/v1/extract`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ note: DEMO_NOTE }),
  signal: AbortSignal.timeout(10000),
});
assert.equal(response.status, 200);
const result = await response.json();
assert.equal(result.extraction.visit.summary, DEMO_NOTE);
assert.equal(result.extraction.medicationChanges[0].dose, '20 mg');
assert.equal(result.extraction.medicationChanges[0].frequency, 'daily');
assert.equal(result.extraction.questions[0].doctorId, 'doctors/nephrologist');
assert.equal(result.applied, undefined);
console.log('ingest smoke passed: health and source-preserving extract; no mutation');
