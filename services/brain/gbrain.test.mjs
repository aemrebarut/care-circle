import test from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { BrainCommandError, GBrain } from './gbrain.mjs';

const familyRoot = resolve(homedir(), 'Workspace/care-circle-brain');
const pathOnly = async path => resolve(path);
const writer = () => ({
  host_id: 'this-host',
  bindings: [{ source_id: 'default', worktree_id: 'owned-tree', local_path: `${familyRoot}/content`, relative_path: 'default', state: 'active', owner_host_id: 'this-host' }],
  worktrees: [{ id: 'owned-tree', queued: 0, running: 0, recovering: 0, recovering_effects: 0, recovery_bytes: '0' }],
});

test('preflight rejects remote or misplaced storage before opening a database', async () => {
  for (const engine of [
    { effective_engine: 'postgres', thin_client: false, database_path: null },
    { effective_engine: 'pglite', thin_client: true, database_path: `${familyRoot}/data` },
    { effective_engine: 'pglite', database_path: `${familyRoot}/data` },
    { effective_engine: 'pglite', thin_client: null, database_path: `${familyRoot}/data` },
    { effective_engine: 'pglite', thin_client: false, database_path: '/unrelated/synthetic/data' },
  ]) {
    const calls = [];
    const db = new GBrain({ resolvePath: pathOnly, run: async args => {
      calls.push(args);
      assert.deepEqual(args, ['engine', 'status', '--json']);
      return JSON.stringify(engine);
    } });
    await assert.rejects(db.preflight(), error => error.code === 'unsafe_brain_storage');
    assert.equal(calls.length, 1);
  }
});

test('preflight verifies local PGLite and disabled embeddings before database-only configuration', async () => {
  const calls = [];
  const db = new GBrain({ resolvePath: pathOnly, run: async args => {
    calls.push(args);
    if (args[0] === 'engine') return JSON.stringify({ effective_engine: 'pglite', thin_client: false, database_path: `${familyRoot}/data` });
    if (args[1] === 'get') return 'true\n';
    return 'Set sync.write_through = false';
  } });
  await db.preflight();
  assert.deepEqual(calls[2], ['config', 'set', 'sync.write_through', 'false']);
});

test('a pending CLI write replays exactly the same UUID, source, and content', async () => {
  const calls = [];
  const db = new GBrain({ run: async (args, content) => {
    calls.push({ args: [...args], content });
    if (calls.length === 1) throw new BrainCommandError('write_pending', 'Synthetic pending receipt');
    return JSON.stringify({ state: 'committed', revision: 'confirmed' });
  } });
  const receipt = await db.put('visits/synthetic', '# Synthetic source', { expectedRevision: 'before', requestId: 'same-request' });
  assert.equal(receipt.revision, 'confirmed');
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0].args, ['put', 'visits/synthetic', '--source-id', 'default', '--request-id', 'same-request', '--expected-revision', 'before']);
});

test('a committed database barrier refuses unfinished managed worktree imports', async () => {
  for (const counter of ['queued', 'running', 'recovering', 'recovering_effects', 'recovery_bytes']) {
    const status = writer();
    status.worktrees[0][counter] = '1';
    const calls = [];
    const db = new GBrain({ run: async args => {
      calls.push(args);
      return JSON.stringify(args[0] === 'put' ? { state: 'committed', revision: 'barrier' } : status);
    } });
    await assert.rejects(db.barrier(), error => error.code === 'gbrain_import_pending');
    assert.equal(calls[0][1], 'care-circle/storage-barrier');
    assert.deepEqual(calls[1], ['sources', 'writer', 'status', 'default', '--json']);
  }
});

test('native import validates effective relative root and local host ownership', async () => {
  for (const change of [
    binding => { binding.relative_path = '../../../unrelated'; },
    binding => { binding.owner_host_id = 'other-host'; },
  ]) {
    const status = writer();
    change(status.bindings[0]);
    const calls = [];
    const db = new GBrain({ resolvePath: pathOnly, run: async args => {
      calls.push(args);
      return JSON.stringify(status);
    } });
    await assert.rejects(db.importWorld('/synthetic/world'), error => error.code === 'unsafe_import_owner');
    assert.equal(calls.length, 1, 'must reject before changing configuration');
  }
});

test('missing or malformed worktree counters never establish quiescence', async () => {
  for (const value of [undefined, null, false, '', ' ', '00', '0.0', NaN, Infinity, [], {}]) {
    for (const key of ['queued', 'running', 'recovering', 'recovering_effects', 'recovery_bytes']) {
      const status = writer();
      status.worktrees[0][key] = value;
      const db = new GBrain({ run: async () => JSON.stringify(status) });
      await assert.rejects(db.requireImportQuiescence(), error => error.code === 'gbrain_import_pending');
    }
  }
  const missingIdentity = writer();
  delete missingIdentity.bindings[0].worktree_id;
  delete missingIdentity.worktrees[0].id;
  const db = new GBrain({ run: async () => JSON.stringify(missingIdentity) });
  await assert.rejects(db.requireImportQuiescence(), error => error.code === 'gbrain_import_pending');
});

test('missing or malformed matching host identities reject import before configuration', async () => {
  for (const value of [undefined, null, false, '', ' ', 0]) {
    const status = writer();
    status.host_id = value;
    status.bindings[0].owner_host_id = value;
    let writes = 0;
    const db = new GBrain({ resolvePath: pathOnly, run: async args => {
      if (args[0] !== 'sources') writes++;
      return JSON.stringify(status);
    } });
    await assert.rejects(db.importWorld('/synthetic/world'), error => error.code === 'unsafe_import_owner');
    assert.equal(writes, 0);
  }
});

test('uncertain write-through enable still restores false in finally', async () => {
  let enabled = false;
  const calls = [];
  const db = new GBrain({ resolvePath: pathOnly, run: async args => {
    calls.push(args);
    if (args[0] === 'sources') return JSON.stringify(writer());
    if (args[0] === 'config') {
      enabled = args[3] === 'true';
      if (enabled) throw new BrainCommandError('gbrain_timeout', 'Synthetic lost enable receipt');
      return 'restored';
    }
    assert.fail('import must not proceed after an uncertain enable');
  } });
  await assert.rejects(db.importWorld('/synthetic/world'), error => error.code === 'gbrain_timeout');
  assert.equal(enabled, false);
  assert.deepEqual(calls.at(-1), ['config', 'set', 'sync.write_through', 'false']);
});

test('native import checks worktree recovery after completion and restores database-only mode', async () => {
  let statusCalls = 0;
  const calls = [];
  const db = new GBrain({ resolvePath: pathOnly, run: async args => {
    calls.push(args);
    if (args[0] === 'sources') {
      const status = writer();
      if (++statusCalls === 2) status.worktrees[0].recovering = 1;
      return JSON.stringify(status);
    }
    if (args[0] === 'import') return JSON.stringify({ status: 'success', imported: 30, errors: 0 });
    return 'configuration updated';
  } });
  await assert.rejects(db.importWorld('/synthetic/world'), error => error.code === 'gbrain_import_pending');
  assert.deepEqual(calls.at(-1), ['config', 'set', 'sync.write_through', 'false']);
});
