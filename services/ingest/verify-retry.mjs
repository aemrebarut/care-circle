// Run only in a coordinated window after runtime's exact-state brain restart.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { HOST, PORTS } from '../../contract/index.mjs';

const canonical = JSON.parse(await readFile(new URL('./evidence/canonical-request.json', import.meta.url), 'utf8'));
const original = JSON.parse(await readFile(new URL('./evidence/first-commit.json', import.meta.url), 'utf8'));
async function request(port, path, input) {
  const response = await fetch(`http://${HOST}:${port}${path}`, {
    ...(input ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(100000),
  });
  const result = await response.json();
  assert.equal(response.status, 200, `${path} got ${response.status} (${result.error?.code ?? 'no error code'})`);
  return result;
}
const before = await request(PORTS.brain, '/v1/state');
assert.equal(before.revision, original.revision, 'the reserved source state must still be intact');
const retry = await request(PORTS.ingest, '/v1/ingest', { ...canonical.input, idempotencyKey: canonical.idempotencyKey });
assert.equal(retry.applied.ok, true);
assert.equal(retry.applied.visitId, original.visitId);
assert.equal(retry.applied.revision, original.revision);
assert.equal(retry.idempotencyKey, canonical.idempotencyKey);
assert.equal(retry.method, original.method);
assert.deepEqual(retry.extraction, canonical.extraction);
const after = await request(PORTS.brain, '/v1/state');
assert.deepEqual(after, before, 'replaying after restart must not alter durable state');
const receipt = {
  ok: true,
  check: 'same key and payload after runtime brain restart',
  unchangedState: true,
  originalVisitId: original.visitId,
  originalRevision: original.revision,
  input: canonical.input,
  retry,
};
await writeFile(new URL('./evidence/restart-retry.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
