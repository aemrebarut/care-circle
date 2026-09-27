import http from 'node:http';
import { createHash } from 'node:crypto';
import { siteHtml } from './site.mjs';

const SOURCE_URL = 'http://127.0.0.1:4706/';
const MAX_BYTES = 32_768;
const TIMEOUT_MS = 3_000;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const expectedHash = digest(siteHtml);
let lastFetchedAt = null;

function fail(code, message, status = 502) {
  return Object.assign(new Error(message), { code, status, statusCode: status });
}

function emptyInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 0) {
    throw fail('INVALID_INPUT', 'Clinic fetch accepts only an empty object. URLs and other inputs are not permitted.', 400);
  }
}

export async function fetchClinic(input = {}) {
  emptyInput(input);
  const startedAt = new Date().toISOString();
  const response = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const req = http.get({ hostname: '127.0.0.1', port: 4706, path: '/', agent: false,
      headers: { Accept: 'text/html', 'Accept-Encoding': 'identity' }, maxHeaderSize: 8_192 }, (res) => {
      const abort = (error) => { finish(error); res.destroy(); req.destroy(); };
      if (res.statusCode >= 300 && res.statusCode < 400) return abort(fail('REDIRECT_REJECTED', 'Clinic redirects are not permitted.'));
      if (res.statusCode !== 200) return abort(fail('CLINIC_UNAVAILABLE', 'The synthetic clinic did not return HTTP 200.'));
      if (!/^text\/html(?:;|$)/i.test(res.headers['content-type'] ?? '')) return abort(fail('INVALID_CONTENT', 'Expected synthetic clinic HTML.'));
      if (Number(res.headers['content-length'] || 0) > MAX_BYTES) return abort(fail('RESPONSE_TOO_LARGE', 'Clinic response exceeded the size limit.'));
      const parts = [];
      let bytes = 0;
      res.on('data', (part) => {
        bytes += part.length;
        if (bytes > MAX_BYTES) return abort(fail('RESPONSE_TOO_LARGE', 'Clinic response exceeded the size limit.'));
        parts.push(part);
      });
      res.on('error', () => finish(fail('CLINIC_UNAVAILABLE', 'The synthetic clinic response was interrupted.')));
      res.on('end', () => finish(null, { body: Buffer.concat(parts), bytes, status: res.statusCode }));
    });
    const timer = setTimeout(() => { finish(fail('CLINIC_TIMEOUT', 'The synthetic clinic did not respond within 3 seconds.', 504)); req.destroy(); }, TIMEOUT_MS);
    req.on('error', () => finish(fail('CLINIC_UNAVAILABLE', 'Start the local synthetic clinic at 127.0.0.1:4706.')));
  });
  const sha256 = digest(response.body);
  if (sha256 !== expectedHash) throw fail('UNTRUSTED_CONTENT', 'The response does not match the Care Circle synthetic fixture.');
  const html = response.body.toString('utf8');
  const match = html.match(/<script id="care-circle-directory" type="application\/json">([^<]+)<\/script>/);
  if (!match) throw fail('MISSING_DIRECTORY', 'The synthetic clinic directory is missing.');
  const directory = JSON.parse(match[1]);
  const fetchedAt = new Date().toISOString();
  lastFetchedAt = fetchedAt;
  return {
    clinic: directory.clinic, sourceUrl: SOURCE_URL, fetchedAt, mode: 'local-http-fetch',
    evidence: {
      synthetic: true, officialUfoExecution: false, browserExecuted: false,
      request: { method: 'GET', url: SOURCE_URL, startedAt, redirectsAllowed: false, timeoutMs: TIMEOUT_MS },
      response: { status: response.status, bytes: response.bytes, sha256, fixtureMatched: true, fixtureId: directory.fixtureId },
      extraction: { method: 'embedded-json', selector: '#care-circle-directory', fields: Object.entries(directory.clinic).map(([field, value]) => ({ field, selector: `#clinic-${field}`, value })) },
      pharmacy: directory.pharmacy,
    },
  };
}

export function getStatus() {
  return { mode: 'local-http-fetch', status: 'ready', sourceUrl: SOURCE_URL, lastFetchedAt,
    officialUfoExecution: false,
    extensionAssets: { browserActions: 'extension/browser-actions.json', mcpEndpoint: `${SOURCE_URL}mcp`, protocol: '2025-06-18' },
    limitations: [
      'Only the synthetic clinic at 127.0.0.1:4706 is fetched.',
      'This is a local HTTP fetch, not browser execution or an official UFO run.',
      'The local MCP adapter is prepared; hosted UFO cannot reach this loopback address.',
      'No UFO account, remote connection, publication or telemetry submission has occurred.',
    ] };
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(payload);
}

async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail('INVALID_CONTENT_TYPE', 'Use application/json.', 415);
  if (Number(req.headers['content-length'] || 0) > 8_192) throw fail('BODY_TOO_LARGE', 'Request body exceeds 8192 bytes.', 413);
  const body = await new Promise((resolve, reject) => {
    const parts = [];
    let bytes = 0;
    const onError = () => reject(fail('INVALID_BODY', 'Request body was interrupted.', 400));
    req.once('error', onError);
    req.on('data', (part) => {
      bytes += part.length;
      if (bytes > 8_192) {
        req.pause();
        reject(fail('BODY_TOO_LARGE', 'Request body exceeds 8192 bytes.', 413));
      } else parts.push(part);
    });
    req.once('end', () => { req.removeListener('error', onError); resolve(Buffer.concat(parts).toString('utf8')); });
  });
  try { return JSON.parse(body); }
  catch { throw fail('INVALID_JSON', 'Request body must be JSON.', 400); }
}

async function mcp(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this stateless MCP endpoint.' } }, { Allow: 'POST' });
  const protocol = req.headers['mcp-protocol-version'];
  if (protocol && !['2025-03-26', '2025-06-18'].includes(protocol)) throw fail('UNSUPPORTED_PROTOCOL', 'Supported MCP versions: 2025-03-26, 2025-06-18.', 400);
  const accept = req.headers.accept || '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) throw fail('INVALID_ACCEPT', 'Accept both application/json and text/event-stream.', 406);
  const message = await readJson(req);
  if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid JSON-RPC request.' } });
  }
  if (!Object.hasOwn(message, 'id')) return send(res, 202);
  const reply = (result) => send(res, 200, { jsonrpc: '2.0', id: message.id, result });
  if (message.method === 'initialize') return reply({ protocolVersion: ['2025-03-26', '2025-06-18'].includes(message.params?.protocolVersion) ? message.params.protocolVersion : '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'care-circle-synthetic-clinic', version: '0.1.0' }, instructions: 'Synthetic local source only. This server does not provide medical advice or perform official UFO execution.' });
  if (message.method === 'ping') return reply({});
  if (message.method === 'tools/list') return reply({ tools: [{ name: 'care_circle_fetch_clinic', description: 'Read fictional clinic details from the fixed local synthetic website, with source hash and provenance.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }] });
  if (message.method === 'tools/call' && message.params?.name === 'care_circle_fetch_clinic') {
    try { const result = await fetchClinic(message.params.arguments ?? {}); return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false }); }
    catch (error) { return reply({ content: [{ type: 'text', text: error.message }], isError: true }); }
  }
  return send(res, 200, { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Unknown method or tool.' } });
}

export function createClinicServer() {
  const server = http.createServer({ maxHeaderSize: 8_192, requestTimeout: 5_000, headersTimeout: 5_000 }, (req, res) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.once('finish', () => req.destroy());
        send(res, 408, { error: { code: 'REQUEST_TIMEOUT', message: 'Request exceeded 5 seconds.' } }, { Connection: 'close' });
      } else req.destroy();
    }, 5_000);
    res.once('close', () => clearTimeout(timer));
    (async () => {
      if (req.headers.host !== '127.0.0.1:4706') throw fail('INVALID_HOST', 'Only the local synthetic clinic host is allowed.', 403);
      const origin = req.headers.origin;
      if (origin && !['http://127.0.0.1:4700', 'http://127.0.0.1:4706'].includes(origin)) throw fail('INVALID_ORIGIN', 'Origin is not allowed.', 403);
      if (req.url === '/mcp') return mcp(req, res);
      if (req.method !== 'GET') throw fail('METHOD_NOT_ALLOWED', 'Only GET is allowed on this route.', 405);
      if (req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) > 0) throw fail('UNEXPECTED_BODY', 'GET requests must not include a body.', 400);
      if (req.url === '/health') return send(res, 200, { ok: true, service: 'sponsors-clinic', synthetic: true });
      if (req.url !== '/') throw fail('NOT_FOUND', 'Route not found.', 404);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(siteHtml), 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' });
      res.end(siteHtml);
    })().catch((error) => {
      if (!res.headersSent && !res.destroyed) {
        res.once('finish', () => req.destroy());
        send(res, error.status || 500, { error: { code: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : 'Request failed.' } }, { Connection: 'close' });
      }
    });
  });
  server.maxHeadersCount = 32;
  server.keepAliveTimeout = 1_000;
  return server;
}
