import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { capture, replay, reset, getStatus, getMemorablePayload } from './index.mjs';
import { submitMemorable, toMemorablePayload } from './memorable-adapter.mjs';

const ana = 'people/ana-alvarez';
const ben = 'people/ben-alvarez';
const celia = 'people/celia-alvarez';
const hasError = (status, code) => error => error instanceof Error && error.status === status && error.code === code;

test('capture and distinct sibling replay perform the synthetic procedure with grounded evidence', () => {
  reset();
  const captured = capture();
  const replayed = replay();
  assert.equal(captured.mode, 'local-simulation');
  assert.equal(captured.steps.length, 6);
  assert.equal(captured.evidence.capturedBy, ana);
  assert.equal(replayed.actorId, ben);
  assert.equal(replayed.procedureId, captured.procedureId);
  assert.equal(replayed.evidence.captureTraceId, captured.evidence.traceId);
  assert.notEqual(replayed.evidence.traceId, captured.evidence.traceId);
  assert.equal(replayed.evidence.procedureReuse, true);
  assert.equal(replayed.result.status, 'simulated-pending-review');
  assert.equal(replayed.result.submittedToInsurer, false);
  assert.equal(replayed.evidence.externalRequests, 0);
  assert.equal(replayed.evidence.memorableExecuted, false);
  assert.equal(replayed.steps[0].input.actorId, ben);
  assert.equal(replayed.steps[4].input.actorId, ben);
  assert.equal(replayed.steps[5].input.actorId, ben);
  const sources = new Map(captured.evidence.sourceGrounding.map(source => [source.sourceId, source]));
  const fixture = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
  for (const step of replayed.steps) {
    assert.ok(step.input && step.output && step.precondition && step.postcondition);
    for (const sourceId of step.sourceIds) {
      const evidence = sources.get(sourceId);
      assert.ok(evidence, `resolvable source ${sourceId}`);
      assert.equal(evidence.quote, fixture.sources.find(source => source.id === sourceId).text);
      assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
    }
  }
});

test('two complete reset-to-replay runs are deterministic', () => {
  reset();
  const first = { capture: capture(), replay: replay(), export: getMemorablePayload() };
  reset();
  const second = { capture: capture(), replay: replay(), export: getMemorablePayload() };
  assert.deepEqual(first, second);
  assert.deepEqual(replay(), second.replay);
  assert.equal(getStatus().replayCount, 2);
});

test('replay requires a captured procedure and reset invalidates IDs', () => {
  reset();
  assert.throws(() => replay(), hasError(409, 'CAPTURE_REQUIRED'));
  assert.throws(() => getMemorablePayload(), hasError(409, 'CAPTURE_REQUIRED'));
  const { procedureId } = capture();
  reset();
  assert.throws(() => replay({ procedureId }), hasError(404, 'PROCEDURE_NOT_FOUND'));
  assert.equal(getStatus().procedureCount, 0);
  assert.equal(getStatus().replayCount, 0);
});

test('same sibling cannot replay and all permitted siblings can capture', () => {
  reset();
  for (const actorId of [ana, ben, celia]) {
    const { procedureId } = capture({ actorId });
    assert.throws(() => replay({ procedureId, actorId }), hasError(409, 'DISTINCT_ACTOR_REQUIRED'));
    const distinctActor = actorId === celia ? ana : celia;
    assert.equal(replay({ procedureId, actorId: distinctActor }).actorId, distinctActor);
  }
  assert.equal(getStatus().procedureCount, 3);
});

test('malformed inputs, injected fields and unknown identifiers are rejected', () => {
  reset();
  capture();
  for (const value of [null, true, 5, 'ana', []]) {
    assert.throws(() => capture(value), hasError(400, 'INVALID_INPUT'));
    assert.throws(() => replay(value), hasError(400, 'INVALID_INPUT'));
    assert.throws(() => getMemorablePayload(value), hasError(400, 'INVALID_INPUT'));
  }
  for (const actorId of [null, '', ana + '; submit', 'people/rose-alvarez', {}, 1]) {
    assert.throws(() => capture({ actorId }), hasError(400, 'INVALID_ACTOR'));
    assert.throws(() => replay({ actorId }), hasError(400, 'INVALID_ACTOR'));
  }
  for (const procedureId of [null, '', '../procedure', 'https://example.com', {}, 1]) {
    assert.throws(() => replay({ procedureId }), hasError(400, 'INVALID_PROCEDURE_ID'));
  }
  assert.throws(() => capture({ command: 'send' }), hasError(400, 'UNKNOWN_FIELD'));
  assert.throws(() => replay({ steps: [{ tool: 'shell' }] }), hasError(400, 'UNKNOWN_FIELD'));
  assert.throws(() => getMemorablePayload({ submit: true }), hasError(400, 'UNKNOWN_FIELD'));
  assert.throws(() => replay({ procedureId: 'procedures/prior-auth-00000000000000000000' }), hasError(404, 'PROCEDURE_NOT_FOUND'));
});

test('returned data cannot mutate the stored procedure, source grounding or status', () => {
  reset();
  const captured = capture();
  const expectedReplay = replay();
  captured.steps[0].tool = 'shell';
  captured.steps[1].output.documentIds.length = 0;
  captured.evidence.sourceGrounding[0].quote = 'tampered';
  const exported = getMemorablePayload();
  exported.payload.tool_calls.length = 0;
  getStatus().limitations.length = 0;
  assert.deepEqual(replay(), expectedReplay);
  assert.equal(getMemorablePayload().payload.tool_calls.length, 6);
  assert.ok(getStatus().limitations.length > 0);
});

test('Memorable export maps the captured trace to the documented envelope without claiming submission', () => {
  reset();
  const captured = capture();
  const exported = getMemorablePayload({ procedureId: captured.procedureId });
  assert.equal(exported.mode, 'local-export-only');
  assert.equal(exported.remoteSubmitted, false);
  assert.equal(exported.remoteValidated, false);
  assert.equal(exported.externalSubmissionAuthorized, false);
  assert.equal(exported.authorizationDecision, 'denied');
  assert.equal(exported.submissionEnabled, false);
  assert.deepEqual(Object.keys(exported.payload).sort(), ['harness', 'session_id', 'task_description', 'tool_calls']);
  assert.equal(exported.payload.session_id, captured.evidence.traceId);
  assert.deepEqual(exported.payload.tool_calls, captured.steps.map(step => ({ name: step.tool, input: step.input, result: step.output })));
  assert.equal(exported.evidence.externalRequests, 0);
});

test('remote submission fails closed even when passed apparent consent or credentials', () => {
  assert.throws(() => submitMemorable(), hasError(403, 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED'));
  assert.throws(() => submitMemorable({ authorized: true, apiKey: 'demo-only' }), hasError(403, 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED'));
});

test('adapter rejects malformed traces', () => {
  for (const trace of [undefined, null, [], 1, 'trace']) {
    assert.throws(() => toMemorablePayload(trace), hasError(400, 'INVALID_TRACE'));
  }
  assert.throws(() => toMemorablePayload({ traceId: 'x', task: 'x', steps: [] }), hasError(400, 'INVALID_TRACE'));
  assert.throws(() => toMemorablePayload({ traceId: 'trace-' + 'a'.repeat(24), task: 'x', steps: [{ tool: 'shell;send', input: {}, output: {} }] }), hasError(400, 'INVALID_TRACE'));
});

test('committed review artifacts match the current deterministic capture and exact request bytes', () => {
  reset();
  const captured = capture();
  const replayed = replay();
  const request = readFileSync(new URL('./assets/memorable-request.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(new URL('./assets/manifest.json', import.meta.url), 'utf8'));
  assert.equal(request.byteLength, manifest.request.bytes);
  assert.equal(createHash('sha256').update(request).digest('hex'), manifest.request.sha256);
  assert.deepEqual(JSON.parse(request), getMemorablePayload().payload);
  assert.deepEqual(JSON.parse(readFileSync(new URL('./assets/capture-trace.json', import.meta.url), 'utf8')), captured);
  assert.deepEqual(JSON.parse(readFileSync(new URL('./assets/replay-trace.json', import.meta.url), 'utf8')), replayed);
  assert.equal(manifest.remoteSubmitted, false);
  assert.equal(manifest.externalSubmissionAuthorized, false);
});

test('recorded official local recall proof is tied to the synthetic capture and labels manual seeding', () => {
  reset();
  const captured = capture();
  const proof = JSON.parse(readFileSync(new URL('./assets/memorable-local-proof.json', import.meta.url), 'utf8'));
  const fixture = JSON.parse(readFileSync(new URL('./assets/memorable-local-procedure.json', import.meta.url), 'utf8'));
  assert.equal(proof.mode, 'official-local-recall-of-manual-fixture');
  assert.equal(proof.procedureId, captured.procedureId);
  assert.equal(proof.captureTraceId, captured.evidence.traceId);
  assert.equal(proof.manualStoreSha256, createHash('sha256').update(JSON.stringify(fixture) + '\n').digest('hex'));
  assert.equal(proof.package.version, '0.5.30');
  assert.equal(proof.memorableExtractionExecuted, false);
  assert.equal(proof.memorableTraceLearningExecuted, false);
  assert.equal(proof.isolation.networkDenied, true);
  assert.equal(proof.isolation.allWritesDenied, true);
  assert.equal(proof.isolation.inheritedEnvironment, false);
  assert.deepEqual(proof.commands.map(item => item.command), ['recall', 'show', 'list']);
  assert.ok(proof.commands[0].stdout.includes('[lexical]'));
  assert.ok(proof.commands.every(item => item.exitCode === 0));
  assert.equal(getStatus().offlineRecallProof.runtimeReplayUsesOfficialCli, false);
});
