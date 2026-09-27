import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { health } from './http.mjs';

const exec = promisify(execFile);
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const defaultStateDir = join(root, '.runtime', 'managed');

export async function processIdentity(pid) {
  if (!Number.isSafeInteger(pid) || pid < 2) return null;
  try {
    const { stdout } = await exec('ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'command='], { timeout: 3000 });
    const raw = stdout.trim();
    // Node changes the OS command from its argv to --title during startup.
    // Normalize both representations to the same birth-time plus unique title.
    const marker = raw.match(/^(\S+\s+\S+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+.*?\b(carecircle-[a-z]+-[a-f0-9-]{36})(?:\s|$)/);
    return marker ? `${marker[1]} ${marker[2]}` : raw || null;
  } catch (error) {
    if (error.code === 1) return null;
    throw new Error('Cannot verify exact process identity; refusing process action');
  }
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error(`Cannot read runtime receipt ${path}`); }
}

async function atomicJson(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function recoverDeadLock(directory) {
  const ownerFile = join(directory, 'owner.json');
  const previous = await readJson(ownerFile);
  if (!previous || !Number.isSafeInteger(previous.pid) || previous.pid < 2 || typeof previous.identity !== 'string' || !previous.identity || !previous.token) return false;
  // A live PID with an unknown or changed identity is not proof of death.
  // Reused live PIDs also fail closed, even if the saved birth time differs.
  if (await processIdentity(previous.pid) !== null) return false;
  // Only one recovery claimant may rename this directory. Re-read after claiming
  // because another command may already have recovered and acquired a new lock.
  const claim = join(directory, 'recovery');
  try { await mkdir(claim); } catch (error) { if (['EEXIST', 'ENOENT'].includes(error.code)) return false; throw error; }
  let moved = false;
  try {
    const owner = await readJson(ownerFile);
    if (owner?.token !== previous.token || owner?.identity !== previous.identity) return false;
    if (await processIdentity(owner.pid) !== null) return false;
    const quarantine = `${directory}.stale-${randomUUID()}`;
    await rename(directory, quarantine);
    moved = true;
    await rm(join(quarantine, 'owner.json'));
    await rmdir(join(quarantine, 'recovery'));
    await rmdir(quarantine);
    return true;
  } finally {
    if (!moved) await rmdir(claim).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function withLock(fn, { stateDir = defaultStateDir, waitMs = 10000, signal } = {}) {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const directory = join(stateDir, 'operation.lock');
  const token = randomUUID();
  const deadline = Date.now() + waitMs;
  while (true) {
    signal?.throwIfAborted();
    try { await mkdir(directory, { mode: 0o700 }); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (await recoverDeadLock(directory)) continue;
      if (Date.now() >= deadline) throw new Error('Runtime operation lock busy. Wait for the active start, stop, or reset. Never remove a live lock.');
      await delay(200);
    }
  }
  const ownerFile = join(directory, 'owner.json');
  let ownerWritten = false;
  try {
    await writeFile(ownerFile, JSON.stringify({ pid: process.pid, identity: await processIdentity(process.pid), token }), { mode: 0o600 });
    ownerWritten = true;
    signal?.throwIfAborted();
    return await fn();
  } finally {
    const owner = ownerWritten ? await readJson(ownerFile) : null;
    if (!ownerWritten || owner?.token === token) {
      await rm(ownerFile, { force: true });
      for (let attempt = 0; ; attempt++) {
        try { await rmdir(directory); break; }
        catch (error) {
          if (error.code !== 'ENOTEMPTY' || attempt >= 50) throw error;
          await delay(20);
        }
      }
    }
  }
}

export async function portOccupied(port) {
  return new Promise((resolvePromise, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolvePromise(true); });
    socket.once('timeout', () => { socket.destroy(); reject(new Error(`Cannot establish port state on ${port}`)); });
    socket.once('error', error => {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') resolvePromise(false);
      else reject(new Error(`Cannot establish port state on ${port}`));
    });
  });
}

export function validReceipt(receipt, service) {
  return receipt?.version === 1 && receipt.name === service.name && receipt.entry === service.entry &&
    Number.isSafeInteger(receipt.pid) && receipt.pid > 1 && typeof receipt.nonce === 'string' &&
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(receipt.nonce) && typeof receipt.identity === 'string' && receipt.identity.includes(receipt.nonce);
}

async function isOwned(receipt, service) {
  return validReceipt(receipt, service) && await processIdentity(receipt.pid) === receipt.identity;
}

async function groupHealthy(service) {
  const results = await Promise.all(service.endpoints.map(endpoint => health(endpoint)));
  return results.every(result => result.ok);
}

async function waitHealthy(service, receipt, { timeoutMs, log, signal }) {
  const deadline = Date.now() + timeoutMs;
  let nextNotice = Date.now() + 10000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (receipt && !await isOwned(receipt, service)) throw new Error(`${service.name} process exited or changed identity during startup; inspect its runtime log`);
    if (await groupHealthy(service)) {
      if (receipt && !await isOwned(receipt, service)) throw new Error(`${service.name} lost process ownership during startup`);
      return;
    }
    if (Date.now() >= nextNotice) { log(`${service.name}: waiting for health`); nextNotice = Date.now() + 10000; }
    await delay(300);
  }
  throw new Error(`${service.name} health timed out after ${timeoutMs} ms. Receipt retained; no unknown process was stopped.`);
}

export async function startServices(selected, { stateDir = defaultStateDir, timeoutMs = 180000, log = console.log, signal } = {}) {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const results = [];
  for (const service of selected) {
    signal?.throwIfAborted();
    const receiptFile = join(stateDir, `${service.name}.json`);
    let receipt = await readJson(receiptFile);
    const owned = receipt && await isOwned(receipt, service);
    if (await groupHealthy(service)) {
      log(`${service.name}: healthy (${owned ? 'runtime owned' : 'external, not owned'})`);
      results.push({ service: service.name, owned: Boolean(owned), started: false });
      continue;
    }
    if (owned) {
      await waitHealthy(service, receipt, { timeoutMs, log, signal });
      log(`${service.name}: healthy (runtime owned)`);
      results.push({ service: service.name, owned: true, started: false });
      continue;
    }
    const occupied = await Promise.all(service.endpoints.map(endpoint => portOccupied(endpoint.port)));
    if (occupied.some(Boolean)) throw new Error(`${service.name}: expected health missing but port occupied. Ask its owner; runtime will not replace or kill the listener.`);
    const entry = resolve(root, service.entry);
    await stat(entry).catch(() => { throw new Error(`${service.name}: entry not ready: ${service.entry}`); });
    const nonce = randomUUID();
    const logfile = await open(join(stateDir, `${service.name}.log`), 'a', 0o600);
    let child;
    try {
      child = spawn(process.execPath, [`--title=carecircle-${service.name}-${nonce}`, entry], {
        cwd: root, detached: true, stdio: ['ignore', logfile.fd, logfile.fd],
      });
      await new Promise((resolvePromise, reject) => { child.once('spawn', resolvePromise); child.once('error', reject); });
      receipt = { version: 1, name: service.name, entry: service.entry, pid: child.pid, nonce, identity: '', startedAt: new Date().toISOString() };
      // Save the exact spawned PID even if identity capture or readiness later fails.
      await atomicJson(receiptFile, receipt);
      for (let attempt = 0; attempt < 30; attempt++) {
        const identity = await processIdentity(child.pid);
        if (identity?.includes(nonce)) { receipt.identity = identity; break; }
        if (child.exitCode !== null || child.signalCode !== null) break;
        await delay(20);
      }
      if (!receipt.identity) throw new Error(`${service.name}: spawned process identity could not be verified; receipt retained`);
      await atomicJson(receiptFile, receipt);
    } finally { child?.unref(); await logfile.close(); }
    log(`${service.name}: started PID ${receipt.pid}`);
    await waitHealthy(service, receipt, { timeoutMs, log, signal });
    log(`${service.name}: healthy`);
    results.push({ service: service.name, owned: true, started: true, pid: receipt.pid });
  }
  return results;
}

export async function stopServices(selected, { stateDir = defaultStateDir, timeoutMs = 30000, log = console.log, signal } = {}) {
  const results = [];
  for (const service of [...selected].reverse()) {
    signal?.throwIfAborted();
    const receiptFile = join(stateDir, `${service.name}.json`);
    const receipt = await readJson(receiptFile);
    if (!receipt) { log(`${service.name}: no runtime receipt, left untouched`); continue; }
    if (!await isOwned(receipt, service)) { log(`${service.name}: stale or unverifiable receipt, no signal sent`); results.push({ service: service.name, stopped: false }); continue; }
    // Identity is checked directly before each exact-PID signal. No process groups or patterns.
    if (await isOwned(receipt, service)) {
      try { process.kill(receipt.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && await isOwned(receipt, service)) { signal?.throwIfAborted(); await delay(200); }
    if (await isOwned(receipt, service)) throw new Error(`${service.name}: still shutting down. Receipt retained; no forced kill during possible brain writes.`);
    const history = join(stateDir, 'history');
    await mkdir(history, { recursive: true, mode: 0o700 });
    await atomicJson(join(history, `${service.name}-${receipt.pid}-${receipt.nonce}.json`), { ...receipt, stoppedAt: new Date().toISOString() });
    await rm(receiptFile);
    log(`${service.name}: stopped runtime PID ${receipt.pid}`);
    results.push({ service: service.name, stopped: true });
  }
  return results;
}
