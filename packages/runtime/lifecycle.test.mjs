import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { before, describe, test } from 'node:test';
import { health, request } from './http.mjs';
import { portOccupied, processIdentity, root, startServices, stopServices, withLock } from './lifecycle.mjs';

const quiet = () => {};
const endpoint = { name: 'runtime-fixture', port: 4715 };
const single = { name: 'fixture', entry: 'packages/runtime/fixtures/single.mjs', endpoints: [endpoint] };
const group = {
  name: 'fixturegroup', entry: 'packages/runtime/fixtures/group.mjs',
  endpoints: [endpoint, { name: 'runtime-fixture-clinic', port: 4716 }],
};

async function readReceipt(stateDir, service = single) {
  try { return JSON.parse(await readFile(join(stateDir, `${service.name}.json`), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function until(check, message, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(25);
  }
  throw new Error(message);
}

async function context(t) {
  const stateDir = await mkdtemp(join(tmpdir(), 'carecircle-runtime-test-'));
  const owned = new Map();
  t.after(async () => {
    for (const [pid, identity] of owned) {
      if (await processIdentity(pid) !== identity) continue;
      try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline && await processIdentity(pid) === identity) await delay(25);
      if (await processIdentity(pid) === identity) process.kill(pid, 'SIGKILL');
      await until(async () => await processIdentity(pid) !== identity, 'Owned fixture did not exit');
    }
    await rm(stateDir, { recursive: true, force: true });
  });
  const remember = async service => {
    const receipt = await readReceipt(stateDir, service);
    if (!receipt?.pid || !receipt.nonce) return;
    const identity = await processIdentity(receipt.pid);
    if (identity?.includes(receipt.nonce)) owned.set(receipt.pid, identity);
  };
  return {
    stateDir,
    options: { stateDir, timeoutMs: 3000, log: quiet },
    async start(service = single, options = {}) {
      try { return await startServices([service], { stateDir, timeoutMs: 3000, log: quiet, ...options }); }
      finally { await remember(service); }
    },
    async external(entry = single.entry) {
      const nonce = randomUUID();
      const child = spawn(process.execPath, [`--title=carecircle-test-${nonce}`, join(root, entry)], {
        cwd: root, stdio: 'ignore',
      });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      await until(async () => {
        const identity = await processIdentity(child.pid);
        if (!identity?.includes(nonce)) return false;
        owned.set(child.pid, identity);
        return true;
      }, 'Fixture process identity missing');
      await until(() => portOccupied(4715), 'Fixture did not listen');
      return { child, identity: owned.get(child.pid) };
    },
  };
}

describe('runtime lifecycle safety', { concurrency: false }, () => {
  before(async () => {
    for (const port of [4715, 4716]) assert.equal(await portOccupied(port), false, `Reserved test port ${port} must be free; no existing listener will be stopped`);
  });

  test('owned start is idempotent and stop removes only its exact process receipt', async t => {
    const ctx = await context(t);
    const first = await withLock(() => ctx.start(), ctx.options);
    assert.equal(first[0].started, true);
    assert.equal(first[0].owned, true);
    const receipt = await readReceipt(ctx.stateDir);
    assert.equal(receipt.pid, first[0].pid);
    assert.equal(await processIdentity(receipt.pid), receipt.identity);
    const second = await withLock(() => ctx.start(), ctx.options);
    assert.deepEqual(second, [{ service: single.name, owned: true, started: false }]);
    assert.equal((await readReceipt(ctx.stateDir)).pid, receipt.pid);
    const stopped = await withLock(() => stopServices([single], ctx.options), ctx.options);
    assert.equal(stopped[0].stopped, true);
    assert.equal(await readReceipt(ctx.stateDir), null);
    assert.equal(await portOccupied(4715), false);
  });

  test('healthy external listener is reused without ownership and survives stop', async t => {
    const ctx = await context(t);
    const external = await ctx.external();
    const results = await ctx.start();
    assert.deepEqual(results, [{ service: single.name, owned: false, started: false }]);
    assert.equal(await readReceipt(ctx.stateDir), null);
    await stopServices([single], ctx.options);
    assert.equal(await processIdentity(external.child.pid), external.identity);
    assert.equal((await health(endpoint)).ok, true);
  });

  test('unhealthy external listener is refused and left alive', async t => {
    const ctx = await context(t);
    const external = await ctx.external('packages/runtime/fixtures/unhealthy.mjs');
    await assert.rejects(() => ctx.start(), /port occupied/);
    assert.equal(await readReceipt(ctx.stateDir), null);
    assert.equal(await processIdentity(external.child.pid), external.identity);
  });

  test('a mismatched healthy listener is refused and left alive', async t => {
    const ctx = await context(t);
    const external = await ctx.external();
    const mismatched = { ...single, endpoints: [{ name: 'not-the-fixture', port: 4715 }] };
    await assert.rejects(() => ctx.start(mismatched), /port occupied/);
    assert.equal(await processIdentity(external.child.pid), external.identity);
  });

  test('partial sponsor-style group never starts a competing process', async t => {
    const ctx = await context(t);
    const external = await ctx.external();
    await assert.rejects(() => ctx.start(group), /port occupied/);
    assert.equal(await readReceipt(ctx.stateDir, group), null);
    assert.equal(await portOccupied(4716), false);
    assert.equal(await processIdentity(external.child.pid), external.identity);
  });

  test('one receipt owns both endpoints of a sponsor-style process group', async t => {
    const ctx = await context(t);
    const results = await ctx.start(group);
    assert.equal(results[0].started, true);
    assert.deepEqual((await readdir(ctx.stateDir)).filter(name => name.endsWith('.json')), [`${group.name}.json`]);
    for (const item of group.endpoints) assert.equal((await health(item)).ok, true);
    await stopServices([group], ctx.options);
    for (const item of group.endpoints) assert.equal(await portOccupied(item.port), false);
  });

  test('stale process identity never sends a signal to the recorded PID', async t => {
    const ctx = await context(t);
    await ctx.start();
    const receipt = await readReceipt(ctx.stateDir);
    await writeFile(join(ctx.stateDir, `${single.name}.json`), JSON.stringify({ ...receipt, identity: `${receipt.identity} stale` }));
    const result = await stopServices([single], ctx.options);
    assert.deepEqual(result, [{ service: single.name, stopped: false }]);
    assert.equal(await processIdentity(receipt.pid), receipt.identity);
    assert.equal((await health(endpoint)).ok, true);
  });

  test('readiness timeout retains a verifiable receipt so later stop can clean up', async t => {
    const ctx = await context(t);
    const unhealthy = { ...single, entry: 'packages/runtime/fixtures/unhealthy.mjs' };
    await assert.rejects(() => ctx.start(unhealthy, { timeoutMs: 350 }), /health timed out/);
    const receipt = await readReceipt(ctx.stateDir, unhealthy);
    assert.ok(receipt.identity.includes(receipt.nonce));
    assert.equal(await processIdentity(receipt.pid), receipt.identity);
    await stopServices([unhealthy], ctx.options);
    assert.equal(await portOccupied(4715), false);
  });

  test('early process exit is reported without claiming successful startup', async t => {
    const ctx = await context(t);
    const exiting = { ...single, entry: 'packages/runtime/fixtures/exit.mjs' };
    await assert.rejects(() => ctx.start(exiting), /identity could not be verified|process exited|lost process ownership/);
    assert.equal(await portOccupied(4715), false);
  });

  test('HTTP redirects are rejected without visiting their target', async t => {
    const ctx = await context(t);
    await ctx.external();
    await assert.rejects(() => request(4715, '/redirect'), /fetch failed|redirect/i);
    assert.equal((await request(4715, '/stats')).redirectHits, 0);
  });

  test('HTTP response size and elapsed time are bounded', async t => {
    const ctx = await context(t);
    await ctx.external();
    await assert.rejects(() => request(4715, '/large', { maxBytes: 1024 }), /Response exceeded limit/);
    const start = Date.now();
    await assert.rejects(() => request(4715, '/slow', { timeoutMs: 100 }), /timeout|aborted/i);
    assert.ok(Date.now() - start < 1500, 'Request did not honor bounded elapsed time');
    await assert.rejects(() => request(4720, '/health'), /outside Care Circle range/);
    await assert.rejects(() => request(4715, '//example.invalid/'), /fixed local path/);
  });

  test('concurrent operations cannot enter a live lock and release restores access', async t => {
    const ctx = await context(t);
    let release;
    let entered;
    const gate = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { entered = resolve; });
    const holding = withLock(async () => { entered(); await gate; }, ctx.options);
    await ready;
    try {
      await assert.rejects(() => withLock(() => assert.fail('Busy lock admitted a second operation'), { ...ctx.options, waitMs: 10 }), /lock busy/);
    } finally { release(); await holding; }
    assert.equal(await withLock(() => 'next operation', ctx.options), 'next operation');
    await assert.rejects(() => withLock(() => { throw new Error('fixture operation failed'); }, ctx.options), /fixture operation failed/);
    assert.equal(await withLock(() => 'after failure', ctx.options), 'after failure');
  });

  test('a verified dead lock owner can be recovered without signaling a listener', async t => {
    const ctx = await context(t);
    const external = await ctx.external();
    assert.equal(await processIdentity(external.child.pid), external.identity);
    process.kill(external.child.pid, 'SIGTERM');
    await until(async () => await processIdentity(external.child.pid) === null, 'Fixture lock owner did not exit');
    const directory = join(ctx.stateDir, 'operation.lock');
    await mkdir(directory);
    await writeFile(join(directory, 'owner.json'), JSON.stringify({
      pid: external.child.pid, identity: external.identity, token: randomUUID(),
    }));
    assert.equal(await withLock(() => 'recovered dead owner', { ...ctx.options, waitMs: 1500 }), 'recovered dead owner');
    assert.equal(await portOccupied(4715), false);
  });

  test('recovery contenders recheck ownership and serialize after a stale PID identity', async t => {
    const ctx = await context(t);
    const directory = join(ctx.stateDir, 'operation.lock');
    const ownerFile = join(directory, 'owner.json');
    await mkdir(directory);
    await writeFile(ownerFile, JSON.stringify({
      pid: process.pid, identity: 'a previous process identity for this reused PID', token: randomUUID(),
    }));
    let active = 0;
    let maximum = 0;
    const completed = await Promise.all(Array.from({ length: 8 }, (_, index) => withLock(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      const before = JSON.parse(await readFile(ownerFile, 'utf8'));
      await delay(40);
      const after = JSON.parse(await readFile(ownerFile, 'utf8'));
      assert.equal(before.token, after.token, 'Recovery contender replaced a live owner');
      active -= 1;
      return index;
    }, { ...ctx.options, waitMs: 4000 })));
    assert.equal(completed.length, 8);
    assert.equal(maximum, 1);
  });

  test('aborted lock operation releases ownership and permits the next command', async t => {
    const ctx = await context(t);
    const controller = new AbortController();
    let entered;
    const ready = new Promise(resolve => { entered = resolve; });
    const running = withLock(async () => {
      entered();
      await delay(10000, undefined, { signal: controller.signal });
    }, { ...ctx.options, signal: controller.signal });
    await ready;
    const rejection = assert.rejects(running, /abort/i);
    controller.abort();
    await rejection;
    assert.equal(await withLock(() => 'after abort', ctx.options), 'after abort');
  });

  test('missing and malformed lock owner receipts fail closed', async t => {
    for (const value of [undefined, '{invalid JSON', JSON.stringify({ pid: process.pid })]) {
      const ctx = await context(t);
      const directory = join(ctx.stateDir, 'operation.lock');
      await mkdir(directory);
      if (value !== undefined) await writeFile(join(directory, 'owner.json'), value);
      await assert.rejects(() => withLock(() => assert.fail('Unverifiable lock was acquired'), { ...ctx.options, waitMs: 0 }), /lock busy|Cannot read runtime receipt/);
      assert.ok((await readdir(ctx.stateDir)).includes('operation.lock'), 'Unverifiable lock was removed');
    }
  });
});
