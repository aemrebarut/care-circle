import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capture, replay, reset } from './index.mjs';
import { postLocalProcedure, runCaptureRecallReplay } from './memorable-bridge.mjs';
import { parseRecalledProcedureId, serializeCapturedProcedure, sha256 } from './memorable-local-runner.mjs';

function fakeRecall(captured) {
  const row = serializeCapturedProcedure(captured);
  return { row, storeBody: JSON.stringify(row) + '\n', recalledProcedureId: captured.procedureId, commands: [], isolation: { testDouble: true } };
}

test('the official-recall ID is passed explicitly to distinct sibling replay', async () => {
  reset();
  let passed;
  const result = await runCaptureRecallReplay({}, {
    officialRecall: fakeRecall,
    replayProcedure: input => { passed = input; return replay(input); }
  });
  assert.deepEqual(passed, { procedureId: result.selection.returnedProcedureId, actorId: 'people/ben-alvarez' });
  assert.equal(result.replay.captureTraceId, result.capture.traceId);
  assert.equal(result.manualSerialization, true);
  assert.equal(result.officialLearning, false);
  assert.equal(result.liveServiceMutated, false);
  assert.equal(result.loopbackRequests, 0);
});

test('a missing or different recall result cannot silently fall back to capture ID', async () => {
  for (const recalledProcedureId of [undefined, 'procedures/prior-auth-00000000000000000000']) {
    reset();
    let replayCalled = false;
    await assert.rejects(runCaptureRecallReplay({}, {
      officialRecall: captured => ({ ...fakeRecall(captured), recalledProcedureId }),
      replayProcedure: () => { replayCalled = true; }
    }));
    assert.equal(replayCalled, false);
  }
});

test('recall parser requires one bounded lexical procedure ID and refuses ambiguous output', () => {
  const id = 'procedures/prior-auth-' + 'a'.repeat(20);
  assert.equal(parseRecalledProcedureId(`1.000  ${id}  [lexical]  (semantic not needed)\n`), id);
  for (const output of ['', 'no matching procedures.', `1.000  ${id}  [semantic]\n`, `1.000  ${id}  [lexical]\n1.000  ${id}  [lexical]\n`, 'x'.repeat(65537)]) {
    assert.throws(() => parseRecalledProcedureId(output));
  }
});

test('serialization is explicitly derived from the actual capture and rejects non-synthetic traces', () => {
  reset();
  const captured = capture();
  const row = serializeCapturedProcedure(captured);
  assert.equal(row.slug, captured.procedureId);
  assert.equal(row.session_id, captured.evidence.traceId);
  assert.deepEqual(row.payload.steps.map(step => step.action), captured.steps.map(step => step.tool));
  assert.throws(() => serializeCapturedProcedure({ ...captured, mode: 'real' }));
  assert.throws(() => serializeCapturedProcedure({ ...captured, evidence: { ...captured.evidence, synthetic: false } }));
});

test('live mode refuses before any local POST when no runtime window is supplied', async () => {
  let requests = 0;
  await assert.rejects(runCaptureRecallReplay({ live: true }, { transport: async () => { requests += 1; } }));
  assert.equal(requests, 0);
});

test('optional live bridge uses only existing fixed loopback routes with fake transport', async () => {
  reset();
  const requests = [];
  const transport = async (url, request) => {
    requests.push({ url, request });
    const input = JSON.parse(request.body);
    const output = url.endsWith('/capture') ? capture(input) : replay(input);
    return new Response(JSON.stringify(output), { headers: { 'content-type': 'application/json' } });
  };
  const result = await runCaptureRecallReplay({ live: true, runtimeWindowReference: 'unit-test-fake-transport-only' }, { transport, officialRecall: fakeRecall });
  assert.deepEqual(requests.map(item => item.url), ['http://127.0.0.1:4705/v1/procedure/capture', 'http://127.0.0.1:4705/v1/procedure/replay']);
  assert.deepEqual(JSON.parse(requests[0].request.body), {});
  assert.equal(JSON.parse(requests[1].request.body).procedureId, result.selection.returnedProcedureId);
  assert.ok(requests.every(item => item.request.method === 'POST' && item.request.redirect === 'error' && item.request.signal.aborted));
  assert.equal(result.loopbackRequests, 2);
});

test('local transport refuses other routes and aborts oversized or failed responses', async () => {
  let calls = 0;
  await assert.rejects(postLocalProcedure('/v1/reset', {}, async () => { calls += 1; }));
  assert.equal(calls, 0);
  for (const response of [() => new Response('', { status: 503 }), () => new Response('x'.repeat(131073), { headers: { 'content-type': 'application/json' } })]) {
    let signal;
    await assert.rejects(postLocalProcedure('/v1/procedure/capture', {}, async (url, request) => { signal = request.signal; return response(); }));
    assert.equal(signal.aborted, true);
  }
});

test('committed offline bridge receipt proves actual official selection and trace-linked Ben replay', () => {
  reset();
  const captured = capture();
  const replayed = replay({ procedureId: captured.procedureId, actorId: 'people/ben-alvarez' });
  const report = JSON.parse(readFileSync(new URL('./assets/memorable-bridge-proof.json', import.meta.url), 'utf8'));
  assert.equal(report.mode, 'in-process-capture-official-recall-simulated-replay');
  assert.equal(report.capture.responseSha256, sha256(JSON.stringify(captured)));
  assert.equal(report.replay.responseSha256, sha256(JSON.stringify(replayed)));
  assert.equal(report.selection.returnedProcedureId, parseRecalledProcedureId(report.commands[0].stdout));
  assert.equal(report.selection.replayInput.procedureId, report.selection.returnedProcedureId);
  assert.equal(report.replay.captureTraceId, report.capture.traceId);
  assert.equal(report.replay.actorId, 'people/ben-alvarez');
  assert.equal(report.captureTraceLinkVerified, true);
  assert.equal(report.isolation.networkDenied, true);
  assert.equal(report.isolation.allWritesDenied, true);
  assert.equal(report.officialLearning, false);
  assert.equal(report.manualSerialization, true);
  assert.equal(report.liveServiceMutated, false);
  assert.equal(report.externalRequests, 0);
});

test('promoted parent live receipt preserves exact source bytes and the released local-only window', () => {
  const body = readFileSync(new URL('./assets/memorable-live-bridge-proof.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(new URL('./assets/memorable-live-bridge-manifest.json', import.meta.url), 'utf8'));
  const receipt = JSON.parse(body);
  assert.equal(body.byteLength, manifest.sourceBytes);
  assert.equal(sha256(body), manifest.sourceSha256);
  assert.equal(manifest.promotedBytesIdentical, true);
  assert.equal(manifest.promotionPerformedNoLiveRequests, true);
  assert.equal(manifest.remoteMemorableAuthorization, 'denied');
  assert.equal(receipt.runtimeWindowReference, 'cc-runtime-local-proofs-20260927-1535');
  assert.equal(receipt.loopbackRequests, 2);
  assert.equal(receipt.externalRequests, 0);
  assert.equal(receipt.manualSerialization, true);
  assert.equal(receipt.officialLearning, false);
  assert.equal(receipt.capture.traceId, receipt.replay.captureTraceId);
  assert.equal(receipt.selection.returnedProcedureId, parseRecalledProcedureId(receipt.commands[0].stdout));
  assert.equal(receipt.selection.replayInput.procedureId, receipt.selection.returnedProcedureId);
});
