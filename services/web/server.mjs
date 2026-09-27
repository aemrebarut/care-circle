import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { HOST, PORTS } from '../../contract/index.mjs';

export const LIMITS = Object.freeze({
  requestBytes: 64 * 1024,
  responseBytes: 4 * 1024 * 1024,
  bodyTimeoutMs: 15_000,
  upstreamTimeoutMs: 120_000,
});

const PUBLIC = new URL('./public/', import.meta.url);
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);
const ROUTES = new Map();
for (const [service, endpoints] of Object.entries({
  brain: { state: 'GET', medications: 'GET', graph: 'GET', reset: 'POST', ingest: 'POST' },
  ingest: { extract: 'POST', ingest: 'POST' },
  brief: { contradictions: 'GET', previsit: 'POST', 'answer/medications': 'GET' },
  river: { status: 'GET', extract: 'POST' },
  sponsors: { status: 'GET', reset: 'POST', 'procedure/capture': 'POST', 'procedure/replay': 'POST', 'procedure/memorable-payload': 'GET', 'clinic/fetch': 'POST' },
})) {
  for (const [endpoint, method] of Object.entries(endpoints)) {
    ROUTES.set(`/api/${service}/${endpoint}`, { service, method, port: PORTS[service], path: `/v1/${endpoint}` });
  }
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, value, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, ...headers });
  res.end(body);
}

function sendError(res, error) {
  const known = error instanceof HttpError;
  sendJson(res, known ? error.status : 500, {
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'The web service could not complete this request.',
    },
  });
}

function upstreamError(route, error) {
  const safe = { code: error.code, message: error.message };
  if (route.service === 'ingest' && route.path === '/v1/ingest') {
    if (typeof error.idempotencyKey === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(error.idempotencyKey)) safe.idempotencyKey = error.idempotencyKey;
    if (error.outcome === 'unknown' || error.outcome === 'rejected') safe.outcome = error.outcome;
    if (typeof error.retryable === 'boolean') safe.retryable = error.retryable;
    if (Number.isInteger(error.upstreamStatus) && error.upstreamStatus >= 400 && error.upstreamStatus <= 599) safe.upstreamStatus = error.upstreamStatus;
  }
  return safe;
}

function routeFor(pathname) {
  const exact = ROUTES.get(pathname);
  if (exact) return exact;
  if (!pathname.startsWith('/api/brain/pages/')) return null;
  let id;
  try { id = decodeURIComponent(pathname.slice('/api/brain/pages/'.length)); }
  catch { throw new HttpError(400, 'INVALID_PAGE_ID', 'The page ID is not valid URL encoding.'); }
  if (id.length > 240 || !/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(id)) {
    throw new HttpError(400, 'INVALID_PAGE_ID', 'The page ID must contain safe slug segments.');
  }
  return { service: 'brain', method: 'GET', port: PORTS.brain, path: `/v1/pages/${encodeURIComponent(id)}` };
}

function readJson(req, limits) {
  const type = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'JSON_REQUIRED', 'Send an application/json request body.');
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    throw new HttpError(415, 'ENCODING_UNSUPPORTED', 'Compressed request bodies are not supported.');
  }
  if (Number(req.headers['content-length'] || 0) > limits.requestBytes) {
    throw new HttpError(413, 'BODY_TOO_LARGE', 'The JSON request body exceeds the size limit.');
  }
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('aborted', onAborted);
      req.off('error', onError);
      if (error) reject(error);
      else resolveBody(value);
    };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > limits.requestBytes) finish(new HttpError(413, 'BODY_TOO_LARGE', 'The JSON request body exceeds the size limit.'));
      else chunks.push(chunk);
    };
    const onEnd = () => {
      try {
        const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Object required');
        finish(null, Buffer.from(JSON.stringify(body)));
      } catch {
        finish(new HttpError(400, 'INVALID_JSON', 'The request body must be a valid JSON object.'));
      }
    };
    const onAborted = () => finish(new HttpError(400, 'REQUEST_ABORTED', 'The request body was interrupted.'));
    const onError = () => finish(new HttpError(400, 'REQUEST_ERROR', 'The request body could not be read.'));
    const timer = setTimeout(() => finish(new HttpError(408, 'BODY_TIMEOUT', 'The request body took too long to arrive.')), limits.bodyTimeoutMs);
    timer.unref();
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('aborted', onAborted);
    req.once('error', onError);
  });
}

function requestJson(route, body, requestImpl, limits, signal) {
  return new Promise((resolveReply, reject) => {
    let settled = false;
    let outgoing;
    let incoming;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      if (error) {
        incoming?.destroy();
        outgoing?.destroy();
        reject(error);
      } else resolveReply(result);
    };
    const onAbort = () => finish(new HttpError(499, 'CLIENT_CLOSED', 'The browser closed this request.'));
    const timer = setTimeout(() => finish(new HttpError(504, 'UPSTREAM_TIMEOUT', `The ${route.service} service took too long to respond.`)), limits.upstreamTimeoutMs);
    timer.unref();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) { onAbort(); return; }
    try {
      outgoing = requestImpl({
        hostname: HOST,
        port: route.port,
        method: route.method,
        path: route.path,
        agent: false,
        maxHeaderSize: 16 * 1024,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {}) },
      }, (upstream) => {
        incoming = upstream;
        const type = String(upstream.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        if (type !== 'application/json') {
          finish(new HttpError(502, 'UPSTREAM_INVALID_RESPONSE', `The ${route.service} service did not return JSON.`));
          return;
        }
        if (Number(upstream.headers['content-length'] || 0) > limits.responseBytes) {
          finish(new HttpError(502, 'UPSTREAM_TOO_LARGE', `The ${route.service} response exceeded the size limit.`));
          return;
        }
        const chunks = [];
        let size = 0;
        upstream.on('data', (chunk) => {
          size += chunk.length;
          if (size > limits.responseBytes) finish(new HttpError(502, 'UPSTREAM_TOO_LARGE', `The ${route.service} response exceeded the size limit.`));
          else chunks.push(chunk);
        });
        upstream.once('error', () => finish(new HttpError(502, 'UPSTREAM_UNAVAILABLE', `The ${route.service} response was interrupted.`)));
        upstream.once('aborted', () => finish(new HttpError(502, 'UPSTREAM_UNAVAILABLE', `The ${route.service} response was interrupted.`)));
        upstream.once('end', () => {
          if (settled) return;
          try {
            const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Object required');
            const status = upstream.statusCode;
            if (status < 200 || status >= 300) {
              if (status < 400 || status > 599 || typeof value.error?.code !== 'string' || typeof value.error?.message !== 'string') {
                throw new Error('Invalid error shape');
              }
              finish(null, { status, value: { error: upstreamError(route, value.error) } });
            } else finish(null, { status: status === 204 ? 200 : status, value });
          } catch {
            finish(new HttpError(502, 'UPSTREAM_INVALID_RESPONSE', `The ${route.service} service returned an invalid JSON response.`));
          }
        });
      });
      outgoing.once('error', () => finish(new HttpError(502, 'UPSTREAM_UNAVAILABLE', `The ${route.service} service is unavailable. Start the local Care Circle services and retry.`)));
      outgoing.end(body);
    } catch {
      finish(new HttpError(502, 'UPSTREAM_UNAVAILABLE', `The ${route.service} service is unavailable.`));
    }
  });
}

// requestImpl is a trusted test seam. Browser inputs never choose a target host or port.
export function createServer({ requestImpl = httpRequest, limits: overrides = {} } = {}) {
  const limits = { ...LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!(name in LIMITS) || !Number.isSafeInteger(value) || value <= 0 || value > LIMITS[name]) throw new Error(`Invalid ${name} limit`);
  }
  const server = createHttpServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const controller = new AbortController();
    res.once('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const url = req.url || '';
      if (!url.startsWith('/') || url.startsWith('//') || /[\\#\u0000-\u001f]/.test(url) || url.length > 2048) {
        throw new HttpError(400, 'INVALID_PATH', 'Use a local Care Circle path.');
      }
      const [pathname, query] = url.split('?', 2);
      if (req.headers.origin && req.headers.origin !== `http://${HOST}:${PORTS.web}`) {
        throw new HttpError(403, 'ORIGIN_FORBIDDEN', 'This endpoint accepts requests from the local Care Circle app only.');
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && (Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'])) {
        throw new HttpError(400, 'BODY_UNEXPECTED', 'GET and HEAD requests must not include a body.');
      }
      if (pathname === '/health') {
        if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint.'); }
        sendJson(res, 200, { ok: true, service: 'web', syntheticData: true });
        return;
      }
      if (pathname.startsWith('/api/')) {
        if (query !== undefined) throw new HttpError(400, 'QUERY_UNSUPPORTED', 'API query parameters are not supported.');
        const route = routeFor(pathname);
        if (!route) throw new HttpError(404, 'NOT_FOUND', 'This API endpoint does not exist.');
        if (req.method !== route.method) { res.setHeader('Allow', route.method); throw new HttpError(405, 'METHOD_NOT_ALLOWED', `Use ${route.method} for this endpoint.`); }
        const body = req.method === 'POST' ? await readJson(req, limits) : undefined;
        const reply = await requestJson(route, body, requestImpl, limits, controller.signal);
        sendJson(res, reply.status, reply.value);
        return;
      }
      const asset = STATIC.get(pathname);
      if (!asset) throw new HttpError(404, 'NOT_FOUND', 'This page does not exist.');
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use GET or HEAD for this file.'); }
      const bytes = await readFile(new URL(asset[0], PUBLIC));
      res.writeHead(200, { 'Content-Type': asset[1], 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (!req.complete) res.setHeader('Connection', 'close');
      req.resume();
      if (error?.code === 'ENOENT') sendError(res, new HttpError(503, 'ASSET_UNAVAILABLE', 'The web assets are not ready yet.'));
      else sendError(res, error);
    }
  });
  server.requestTimeout = limits.upstreamTimeoutMs + limits.bodyTimeoutMs;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? 'Care Circle web port 4700 is already in use.' : 'Care Circle web could not start.');
    process.exitCode = 1;
  });
  server.listen(PORTS.web, HOST, () => console.log(`Care Circle web listening at http://${HOST}:${PORTS.web}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close();
    server.closeIdleConnections();
    const timer = setTimeout(() => { server.closeAllConnections(); }, 2_000);
    timer.unref();
  });
}
