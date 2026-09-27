import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const component = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(component, '.runtime/package');
const cli = resolve(packageRoot, 'dist/cli.js');
export const OFFICIAL_CLI_SHA256 = 'db8a5082b3619fb8c982f67819701a2064b7592bbf652548f9bf8cd4d277934a';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function serializeCapturedProcedure(captured) {
  assert.equal(captured?.mode, 'local-simulation');
  assert.match(captured.procedureId, /^procedures\/prior-auth-[a-f0-9]{20}$/);
  assert.match(captured.evidence?.traceId, /^trace-[a-f0-9]{24}$/);
  assert.equal(captured.evidence.synthetic, true);
  assert.equal(captured.evidence.phase, 'capture');
  assert.ok(Array.isArray(captured.steps) && captured.steps.length > 0 && captured.steps.length <= 32);
  for (const [index, step] of captured.steps.entries()) {
    assert.equal(step.index, index + 1);
    assert.match(step.tool, /^[a-z][a-z0-9_]{1,63}$/);
    assert.equal(step.status, 'completed-in-simulation');
  }
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
  return row;
}

export function parseRecalledProcedureId(output) {
  assert.equal(typeof output, 'string');
  assert.ok(output.length <= 65536, 'Recall output must be bounded.');
  const matches = [...output.matchAll(/^\d+\.\d+\s+(procedures\/prior-auth-[a-f0-9]{20})\s+\[(?:exact,)?lexical\]/gm)];
  assert.equal(matches.length, 1, 'Exactly one local lexical recall result is required.');
  return matches[0][1];
}

export function runOfficialLocalRecall(captured, { storageName = 'offline-proof' } = {}) {
  assert.ok(['offline-proof', 'offline-bridge', 'live-bridge'].includes(storageName));
  const row = serializeCapturedProcedure(captured);
  assert.equal(realpathSync(packageRoot), packageRoot, 'The inspected package must not be a symlink.');
  assert.equal(realpathSync(cli), cli, 'The inspected CLI must not be a symlink.');
  assert.equal(sha256(readFileSync(cli)), OFFICIAL_CLI_SHA256, 'Use the inspected, unmodified memorable-cli 0.5.30 package.');
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

  const root = resolve(component, '.runtime', storageName);
  mkdirSync(resolve(root, '.memorable'), { recursive: true });
  assert.equal(realpathSync(root), root, 'Proof storage must not be a symlink.');
  assert.equal(realpathSync(resolve(root, '.memorable')), resolve(root, '.memorable'));
  const storeBody = `${JSON.stringify(row)}\n`;
  writeFileSync(resolve(root, '.memorable/config.json'), JSON.stringify({ backend: 'local', consent: 'read-only' }));
  writeFileSync(resolve(root, '.memorable/procedures.jsonl'), storeBody);
  const commands = [];
  let recalledProcedureId;
  for (const args of [['recall', row.title, '--single'], ['show', row.slug], ['list', '--json']]) {
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
      recalledProcedureId = parseRecalledProcedureId(result.stdout);
      assert.equal(recalledProcedureId, captured.procedureId, 'Official recall must select the captured procedure.');
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
  return {
    row, storeBody, commands, recalledProcedureId,
    isolation: { ...isolation, allowedReadLocations: ['.runtime/package', `.runtime/${storageName}`], allWritesDenied: true, inheritedEnvironment: false, credentialsProvided: false, homeRepurposed: false }
  };
}
