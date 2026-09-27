#!/usr/bin/env node
import { selectServices } from './registry.mjs';
import { startServices, stopServices, withLock } from './lifecycle.mjs';
import { smoke, resetDemo } from './checks.mjs';

const usage = 'Usage: scripts/{start|stop|smoke|demo-reset} [service ...] [--timeout-ms N]\nServices: brain river ingest brief sponsors web. Selections apply only to start/stop.';
const controller = new AbortController();
const interrupt = () => controller.abort(new Error('Interrupted; spawned process receipts retained'));
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === '--help' || args.includes('--help')) { console.log(usage); return; }
  if (!['start', 'stop', 'smoke', 'demo-reset'].includes(command)) throw new Error(usage);
  let timeoutMs = command === 'stop' ? 30000 : 180000;
  const names = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--timeout-ms') {
      timeoutMs = Number(args[++index]);
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 900000) throw new Error('Timeout must be 1000 to 900000 milliseconds');
    } else names.push(args[index]);
  }
  if (names.length && !['start', 'stop'].includes(command)) throw new Error('Service selections apply only to start/stop');
  const selected = selectServices(names);
  const options = { timeoutMs, signal: controller.signal };
  if (command === 'smoke') { await smoke(options); return; }
  await withLock(async () => {
    if (command === 'stop') { await stopServices(selected, options); return; }
    await startServices(selected, options);
    if (command === 'demo-reset') await resetDemo(options);
  }, { signal: controller.signal });
}

main().catch(error => { console.error(`runtime: ${error.message}`); process.exitCode = 1; });
