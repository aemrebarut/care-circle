import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { capture } from './index.mjs';

const component = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(component, '.runtime/package');
const cli = resolve(packageRoot, 'dist/cli.js');
const expectedCliSha256 = 'db8a5082b3619fb8c982f67819701a2064b7592bbf652548f9bf8cd4d277934a';
const sha256 = value => createHash('sha256').update(value).digest('hex');
assert.equal(realpathSync(packageRoot), packageRoot, 'The inspected package must not be a symlink.');
assert.equal(realpathSync(cli), cli, 'The inspected CLI must not be a symlink.');
assert.equal(sha256(readFileSync(cli)), expectedCliSha256, 'Use the inspected, unmodified memorable-cli 0.5.30 package.');
assert.equal(JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')).version, '0.5.30');

const probe = `
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {connect} from 'node:net';
for (const permission of ['net','child','fs.read','fs.write']) assert.equal(process.permission.has(permission),false);
assert.throws(()=>readFileSync('/permission-probe-does-not-exist'),{code:'ERR_ACCESS_DENIED'});
assert.throws(()=>writeFileSync('/permission-probe-does-not-exist','x'),{code:'ERR_ACCESS_DENIED'});
assert.throws(()=>spawnSync(process.execPath,['--version']),{code:'ERR_ACCESS_DENIED'});
let denied=false;
try { const socket=connect({host:'127.0.0.1',port:4705}); socket.on('error',error=>{assert.equal(error.code,'ERR_ACCESS_DENIED');denied=true;}); }
catch(error) {assert.equal(error.code,'ERR_ACCESS_DENIED');denied=true;}
await new Promise(resolve=>setTimeout(resolve,50));
assert.equal(denied,true);
console.log(JSON.stringify({nodeVersion:process.version,filesystemReadDenied:true,filesystemWriteDenied:true,networkDenied:true,childProcessDenied:true}));
`;
const probeResult = spawnSync(process.execPath, ['--permission', '--input-type=module', '--eval', probe], {
  env: {}, encoding: 'utf8', timeout: 5000, maxBuffer: 65536
});
assert.equal(probeResult.status, 0, 'Permission enforcement probe must succeed before any package execution.');
const isolation = JSON.parse(probeResult.stdout);

const root = resolve(component, '.runtime/offline-proof');
mkdirSync(resolve(root, '.memorable'), { recursive: true });
assert.equal(realpathSync(root), root, 'Proof storage must not be a symlink.');
const captured = capture();
const title = 'Synthetic prior authorization rehearsal';
const row = {
  slug: captured.procedureId,
  title,
  session_id: captured.evidence.traceId,
  workflow_id: captured.evidence.traceId,
  embedding_model: '',
  payload: {
    trigger_signature: {
      summary_text: title,
      entities: { file_paths: [], commands: [], tool_names: captured.steps.map(step => step.tool) },
      search_text: title
    },
    steps: captured.steps.map(step => ({ seq: step.index, action: step.tool, activity_class: step.index < 4 ? 'read' : 'execute', repeat_count: 1 })),
    preconditions: ['Synthetic data only. Local simulation only.'],
    postconditions: ['Local simulation complete. No insurer contacted. No coverage decision.'],
    embedding: []
  }
};
const storeBody = `${JSON.stringify(row)}\n`;
writeFileSync(resolve(root, '.memorable/config.json'), JSON.stringify({ backend: 'local', consent: 'read-only' }));
writeFileSync(resolve(root, '.memorable/procedures.jsonl'), storeBody);
const commands = [];
for (const args of [['recall', title, '--single'], ['show', row.slug], ['list', '--json']]) {
  const result = spawnSync(process.execPath, [
    '--permission', `--allow-fs-read=${packageRoot}`, `--allow-fs-read=${root}`, cli, ...args
  ], {
    cwd: root,
    env: { MEMORABLE_HOME: root, MEMORABLE_BACKEND: 'local', MEMORABLE_NO_KEYCHAIN: '1', NO_COLOR: '1' },
    encoding: 'utf8', timeout: 5000, maxBuffer: 65536
  });
  assert.equal(result.status, 0, `Official ${args[0]} command must succeed.`);
  assert.equal(result.stderr, '', 'The official command must produce no warnings.');
  if (args[0] === 'recall') {
    assert.ok(result.stdout.includes(row.slug));
    assert.ok(result.stdout.includes('[lexical]'));
  } else if (args[0] === 'show') {
    assert.ok(result.stdout.includes('simulate_prior_auth_submission'));
    assert.ok(result.stdout.includes('No insurer contacted.'));
  } else {
    assert.equal(JSON.parse(result.stdout)[0].preferred, row.slug);
  }
  commands.push({
    command: args[0], arguments: args.slice(1), exitCode: result.status,
    stdout: result.stdout.replace(/[\u2013\u2014]/g, '-'),
    stdoutPunctuationNormalized: true, originalStdoutSha256: sha256(result.stdout), stderr: ''
  });
}
assert.equal(readFileSync(resolve(root, '.memorable/procedures.jsonl'), 'utf8'), storeBody);
const report = {
  schemaVersion: '1.0.0', checkedAt: new Date().toISOString(),
  mode: 'official-local-recall-of-manual-fixture',
  package: { name: 'memorable-cli', version: '0.5.30', cliSha256: expectedCliSha256, unmodified: true, redistributed: false },
  procedureId: row.slug, captureTraceId: captured.evidence.traceId,
  manualStoreSha256: sha256(storeBody), synthetic: true,
  memorableExtractionExecuted: false, memorableTraceLearningExecuted: false,
  remoteSubmitted: false, externalRequests: 0,
  isolation: { ...isolation, allowedReadLocations: ['.runtime/package', '.runtime/offline-proof'], allWritesDenied: true, inheritedEnvironment: false, credentialsProvided: false, homeRepurposed: false },
  commands,
  limitations: [
    'Care Circle manually seeded the local procedure fixture; Memorable did not extract or learn it.',
    'Only official CLI local lexical recall, guarded rendering and listing were tested.',
    'CLI ingest and record require hosted extraction and remain unexecuted.',
    'This proof does not change the service capture or replay mode from local-simulation.'
  ]
};
writeFileSync(resolve(component, 'assets/memorable-local-procedure.json'), `${JSON.stringify(row, null, 2)}\n`);
const receipt = resolve(component, 'assets/memorable-local-proof.json');
writeFileSync(receipt, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, mode: report.mode, receipt: relative(component, receipt), isolation, commands: commands.map(item => item.command) })}\n`);
