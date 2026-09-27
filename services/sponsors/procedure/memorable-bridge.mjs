import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { capture, replay } from './index.mjs';
import { OFFICIAL_CLI_SHA256, runOfficialLocalRecall, sha256 } from './memorable-local-runner.mjs';

const ANA = 'people/ana-alvarez';
const BEN = 'people/ben-alvarez';

export async function postLocalProcedure(path, body, transport = fetch) {
  assert.ok(['/v1/procedure/capture', '/v1/procedure/replay'].includes(path), 'Only the existing sponsor capture and replay endpoints are allowed.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await transport(`http://127.0.0.1:4705${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), redirect: 'error', signal: controller.signal
    });
    assert.ok(response.ok, `Local sponsor request failed with HTTP ${response.status}.`);
    assert.ok(response.headers.get('content-type')?.startsWith('application/json'));
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        assert.ok(bytes <= 131072, 'Local sponsor response exceeds the bridge limit.');
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

export async function runCaptureRecallReplay({ live = false, runtimeWindowReference } = {}, dependencies = {}) {
  assert.equal(typeof live, 'boolean');
  if (live) assert.ok(typeof runtimeWindowReference === 'string' && /^[A-Za-z0-9/:._ -]{1,160}$/.test(runtimeWindowReference), 'Live POSTs require an actual parent-granted runtime-safe window reference.');
  const captureProcedure = dependencies.captureProcedure ?? (live
    ? () => postLocalProcedure('/v1/procedure/capture', {}, dependencies.transport)
    : capture);
  const replayProcedure = dependencies.replayProcedure ?? (live
    ? input => postLocalProcedure('/v1/procedure/replay', input, dependencies.transport)
    : replay);
  const officialRecall = dependencies.officialRecall ?? runOfficialLocalRecall;
  const captured = await captureProcedure({ actorId: ANA });
  assert.equal(captured.mode, 'local-simulation');
  assert.equal(captured.evidence.capturedBy, ANA);
  const recalled = officialRecall(captured, { storageName: live ? 'live-bridge' : 'offline-bridge' });
  const selectedId = recalled.recalledProcedureId;
  assert.match(selectedId, /^procedures\/prior-auth-[a-f0-9]{20}$/);
  assert.equal(selectedId, captured.procedureId, 'Only the procedure returned by official recall may be replayed.');
  // This ID is parsed from official CLI output, not filled from the capture as a fallback.
  const replayInput = { procedureId: selectedId, actorId: BEN };
  const replayed = await replayProcedure(replayInput);
  assert.equal(replayed.procedureId, selectedId);
  assert.equal(replayed.actorId, BEN);
  assert.equal(replayed.mode, 'local-simulation');
  assert.equal(replayed.evidence.captureTraceId, captured.evidence.traceId);
  assert.equal(replayed.evidence.capturedBy, ANA);
  assert.equal(replayed.result.simulation, true);
  assert.equal(replayed.result.submittedToInsurer, false);
  return {
    schemaVersion: '1.0.0', checkedAt: new Date().toISOString(),
    mode: live ? 'loopback-capture-official-recall-simulated-replay' : 'in-process-capture-official-recall-simulated-replay',
    synthetic: true, manualSerialization: true, officialLearning: false,
    officialLocalRecallExecuted: true, officialRecallSelectedReplay: true,
    remoteSubmitted: false, externalRequests: 0, loopbackRequests: live ? 2 : 0,
    liveServiceMutated: live, ...(live ? { runtimeWindowReference } : {}),
    package: { name: 'memorable-cli', version: '0.5.30', cliSha256: OFFICIAL_CLI_SHA256, unmodified: true, redistributed: false },
    capture: {
      procedureId: captured.procedureId, actorId: captured.evidence.capturedBy,
      traceId: captured.evidence.traceId, traceSha256: captured.evidence.traceSha256,
      responseSha256: sha256(JSON.stringify(captured))
    },
    localStore: { serialization: 'authored-from-this-capture', sha256: sha256(recalled.storeBody), procedure: recalled.row },
    selection: { source: 'official-cli-lexical-recall', returnedProcedureId: selectedId, replayInput },
    replay: {
      procedureId: replayed.procedureId, actorId: replayed.actorId, mode: replayed.mode,
      traceId: replayed.evidence.traceId, captureTraceId: replayed.evidence.captureTraceId,
      responseSha256: sha256(JSON.stringify(replayed)), result: replayed.result
    },
    captureTraceLinkVerified: true,
    isolation: recalled.isolation, commands: recalled.commands,
    limitations: [
      'Care Circle serialized its captured trace into local storage; Memorable did not learn or extract it.',
      'Official Memorable lexical recall selected the ID; Care Circle performed the local simulated replay.',
      'This standalone bridge adds no service endpoint or automatic capture/replay behavior.',
      'No insurer contact, hosted Memorable extraction or treatment recommendation occurred.'
    ]
  };
}

async function main(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--live' && !options.live) options.live = true;
    else if (args[index] === '--runtime-window-reference' && !options.runtimeWindowReference && args[index + 1] && !args[index + 1].startsWith('--')) options.runtimeWindowReference = args[++index];
    else throw new Error('Use no flags for offline mode, or --live --runtime-window-reference after the parent grants a safe window.');
  }
  if (!options.live && options.runtimeWindowReference) throw new Error('A runtime window reference applies only to explicit --live mode.');
  const report = await runCaptureRecallReplay(options);
  const target = options.live ? new URL('./.runtime/live-bridge/receipt.json', import.meta.url) : new URL('./assets/memorable-bridge-proof.json', import.meta.url);
  mkdirSync(new URL('.', target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: true, mode: report.mode, returnedProcedureId: report.selection.returnedProcedureId, replayActorId: report.replay.actorId, captureTraceLinkVerified: true, liveServiceMutated: report.liveServiceMutated, receipt: fileURLToPath(target) })}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${JSON.stringify({ error: { code: 'BRIDGE_FAILED', message: error.message } })}\n`);
    process.exitCode = 1;
  });
}
