import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { BrainStore } from './store.mjs';
import { HttpError } from './domain.mjs';
import { HOST, PORTS } from '../../contract/index.mjs';

const MAX_BODY = 64 * 1024;

function send(response, status, value) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  if (!(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'content_type', 'Send application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'body_too_large', 'Request body exceeds 64 KiB.');
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid_body', 'Request body must be a JSON object.');
  return value;
}

export function createServer(store) {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.headers.origin && request.headers.origin !== 'http://127.0.0.1:4700') {
        throw new HttpError(403, 'origin_denied', 'Use the local Care Circle application.');
      }
      const url = new URL(request.url, `http://${HOST}:${PORTS.brain}`);
      const route = `${request.method} ${url.pathname}`;
      if (route === 'GET /health') return send(response, store.ready ? 200 : 503, store.health());
      if (route === 'GET /v1/state') return send(response, 200, store.view());
      if (route === 'GET /v1/graph') return send(response, 200, store.view().graph);
      if (route === 'GET /v1/medications') return send(response, 200, store.medicationList());
      if (request.method === 'GET' && url.pathname.startsWith('/v1/pages/')) {
        let id;
        try { id = decodeURIComponent(url.pathname.slice('/v1/pages/'.length)); } catch { throw new HttpError(400, 'invalid_id', 'Page ID has invalid URL encoding.'); }
        return send(response, 200, store.getPage(id));
      }
      if (route === 'POST /v1/ingest') return send(response, 200, await store.ingest(await body(request)));
      if (route === 'POST /v1/reset') {
        const value = await body(request);
        if (Object.keys(value).length) throw new HttpError(400, 'invalid_reset', 'Reset accepts an empty JSON object.');
        return send(response, 200, await store.reset());
      }
      throw new HttpError(404, 'not_found', 'This endpoint does not exist.');
    } catch (error) {
      send(response, error instanceof HttpError ? error.status : 500, { error: { code: error instanceof HttpError ? error.code : 'internal_error', message: error instanceof HttpError ? error.message : 'The family brain could not complete this request.' } });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.setTimeout(180_000, socket => socket.destroy());
  return server;
}

export async function main() {
  const store = new BrainStore();
  const server = createServer(store);
  // Bind first. A second owner fails before accessing any GBrain storage.
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORTS.brain, HOST, resolve);
  });
  console.log(`Care Circle brain listening on http://${HOST}:${PORTS.brain}`);
  let stopping = false;
  let initialization;
  async function startStorage() {
    store.status = 'initializing';
    try { await store.initialize(); } catch (error) {
      store.status = error.name === 'BrainCommandError' || error.code?.startsWith('gbrain_') || error.code === 'write_pending' ? 'startup-retry' : 'startup-failed';
      console.error(`Family brain initialization failed (${error.code || 'invalid_state'}, stage=${error.stage || 'state-validation'}, exit=${error.exitCode ?? 'none'}). No state was silently reset.`);
    }
  }
  const retry = setInterval(() => {
    if (!stopping && store.status === 'recovery-needed' && !store.recovery) store.recover().catch(() => {});
    if (!stopping && store.status === 'startup-retry') initialization = startStorage();
  }, 10_000);
  retry.unref();
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    store.stopping = true;
    store.ready = false;
    store.status = 'stopping';
    clearInterval(retry);
    // The wrapper must retain its lock until its GBrain child exits. Drain all
    // owned storage operations, including initialization, before releasing the
    // port ownership lock. A replacement cannot start while we are draining.
    await initialization?.catch(() => {});
    await store.tail;
    await store.recovery?.catch(() => {});
    const closed = new Promise(resolve => server.close(resolve));
    server.closeIdleConnections();
    await closed;
  });
  initialization = startStorage();
  await initialization;
  return { server, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error('Family brain could not bind its loopback port. Another owner may already be running.');
  process.exitCode = 1;
});
