import http from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { HOST, PORTS } from '../../contract/index.mjs';
import * as procedure from './procedure/index.mjs';
import { createClinicServer, fetchClinic, getStatus as getClinicStatus } from './extension/index.mjs';

const MAX_BODY_BYTES = 32 * 1024;
const REQUEST_TIMEOUT_MS = 5000;
const BROWSER_ORIGIN = `http://${HOST}:${PORTS.web}`;
const API_HOST = `${HOST}:${PORTS.sponsors}`;
const browserObservation = JSON.parse(readFileSync(new URL('./evidence/clinic-browser-observation.json', import.meta.url), 'utf8'));

function problem(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function json(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  const length = request.headers['content-length'];
  if (length !== undefined && Number(length) > MAX_BODY_BYTES) {
    request.resume();
    throw problem(413, 'BODY_TOO_LARGE', 'Request body exceeds 32768 bytes.');
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    request.resume();
    throw problem(415, 'JSON_REQUIRED', 'Use Content-Type: application/json.');
  }
  const raw = await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    function cleanup() {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('aborted', onAborted);
      request.off('error', onError);
    }
    function onData(chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        cleanup();
        request.resume();
        reject(problem(413, 'BODY_TOO_LARGE', 'Request body exceeds 32768 bytes.'));
      } else chunks.push(chunk);
    }
    function onEnd() { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); }
    function onAborted() { cleanup(); reject(problem(400, 'REQUEST_ABORTED', 'Request was interrupted.')); }
    function onError() { cleanup(); reject(problem(400, 'REQUEST_ERROR', 'Request could not be read.')); }
    request.on('data', onData);
    request.on('end', onEnd);
    request.on('aborted', onAborted);
    request.on('error', onError);
  });
  let value;
  try { value = JSON.parse(raw); }
  catch { throw problem(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw problem(400, 'OBJECT_REQUIRED', 'Request body must be a JSON object.');
  }
  return value;
}

function requireEmpty(value) {
  if (Object.keys(value).length) throw problem(400, 'EMPTY_BODY_REQUIRED', 'This endpoint accepts an empty object only.');
}

export function createSponsorsServer() {
  const server = http.createServer({ maxHeaderSize: 8192, connectionsCheckingInterval: 500 }, async (request, response) => {
    const timeout = setTimeout(() => {
      if (!response.headersSent) {
        response.setHeader('connection', 'close');
        response.once('finish', () => request.destroy());
        json(response, 408, { error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out.' } });
      } else request.destroy();
    }, REQUEST_TIMEOUT_MS);
    timeout.unref();
    response.once('finish', () => clearTimeout(timeout));
    response.once('close', () => clearTimeout(timeout));
    try {
      if (request.headers.host !== API_HOST) throw problem(403, 'HOST_FORBIDDEN', 'Only the loopback sponsor address is accepted.');
      const origin = request.headers.origin;
      if (origin && origin !== BROWSER_ORIGIN && origin !== `http://${API_HOST}`) {
        throw problem(403, 'ORIGIN_FORBIDDEN', 'Only the local Care Circle browser origin is accepted.');
      }
      if (origin === BROWSER_ORIGIN) {
        response.setHeader('access-control-allow-origin', BROWSER_ORIGIN);
        response.setHeader('vary', 'Origin');
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type',
          'access-control-max-age': '600',
        });
        response.end();
        return;
      }
      const pathname = new URL(request.url, `http://${API_HOST}`).pathname;
      if (request.method === 'GET' && (request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) > 0)) {
        throw problem(400, 'UNEXPECTED_BODY', 'GET requests must not include a body.');
      }
      if (request.method === 'GET' && pathname === '/health') {
        json(response, 200, { ok: true, service: 'sponsors', synthetic: true });
        return;
      }
      if (request.method === 'GET' && pathname === '/v1/status') {
        json(response, 200, { memorable: procedure.getStatus(), ufo: { ...getClinicStatus(), browserObservation } });
        return;
      }
      if (request.method === 'GET' && pathname === '/v1/procedure/memorable-payload') {
        if (!procedure.getMemorablePayload) throw problem(503, 'ADAPTER_UNAVAILABLE', 'Local Memorable payload export is not ready.');
        json(response, 200, await procedure.getMemorablePayload());
        return;
      }
      const routes = new Map([
        ['/v1/procedure/capture', procedure.capture],
        ['/v1/procedure/replay', procedure.replay],
        ['/v1/clinic/fetch', fetchClinic],
        ['/v1/reset', (body) => { requireEmpty(body); return procedure.reset(); }],
      ]);
      if (routes.has(pathname)) {
        if (request.method !== 'POST') throw problem(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.');
        const body = await readBody(request);
        json(response, 200, await routes.get(pathname)(body));
        return;
      }
      throw problem(404, 'NOT_FOUND', 'Unknown sponsor endpoint.');
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      json(response, status, { error: {
        code: status === 500 ? 'INTERNAL_ERROR' : error.code ?? 'REQUEST_FAILED',
        message: status === 500 ? 'Sponsor service could not complete the local request.' : error.message,
      } });
    }
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 100;
  return server;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => { server.off('error', reject); resolve(); });
  });
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
  });
}

export async function startServices() {
  const sponsors = createSponsorsServer();
  const clinic = createClinicServer();
  try {
    await listen(clinic, PORTS.clinic);
    await listen(sponsors, PORTS.sponsors);
  } catch (error) {
    await Promise.all([close(sponsors), close(clinic)]);
    throw error;
  }
  return { sponsors, clinic, close: () => Promise.all([close(sponsors), close(clinic)]) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const services = await startServices();
    console.log(`Care Circle sponsors ready on http://${API_HOST}; synthetic clinic on http://${HOST}:${PORTS.clinic}`);
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      await services.close();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error(`Sponsor startup failed: ${error.code ?? 'STARTUP_ERROR'}`);
    process.exitCode = 1;
  }
}
