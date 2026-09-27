import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { HOST, PORTS } from '../../contract/index.mjs';
import { BriefError, buildContradictions, buildMedicationAnswer, buildPrevisit } from './domain.mjs';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

function loopbackUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Brain URL must be a loopback HTTP URL on ports 4700 through 4719.'); }
  if (url.protocol !== 'http:' || url.hostname !== HOST || Number(url.port) < 4700 || Number(url.port) > 4719 || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Brain URL must be a loopback HTTP URL on ports 4700 through 4719.');
  }
  return url;
}

async function brainState(brainUrl, timeoutMs) {
  try {
    const response = await fetch(new URL('/v1/state', brainUrl), { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (!response.ok) throw new BriefError(502, 'BRAIN_UNAVAILABLE', `Brain returned HTTP ${response.status}.`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_SNAPSHOT_BYTES) throw new BriefError(502, 'BRAIN_RESPONSE_TOO_LARGE', 'Brain snapshot exceeds the supported size.');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof BriefError) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new BriefError(504, 'BRAIN_TIMEOUT', 'Brain did not respond within the request deadline.');
    throw new BriefError(502, 'BRAIN_UNAVAILABLE', 'A valid brain snapshot is unavailable.');
  }
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw new BriefError(413, 'BODY_TOO_LARGE', 'Request body exceeds 16 KiB.');
  const timer = setTimeout(() => req.destroy(), REQUEST_TIMEOUT_MS);
  timer.unref();
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new BriefError(413, 'BODY_TOO_LARGE', 'Request body exceeds 16 KiB.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new BriefError(400, 'INVALID_JSON', 'Request body must be a JSON object.'); }
  } finally { clearTimeout(timer); }
}

export function createServer({ brainUrl = `http://${HOST}:${PORTS.brain}`, timeoutMs = 8_000 } = {}) {
  const upstream = loopbackUrl(brainUrl);
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      const path = new URL(req.url, `http://${HOST}:${PORTS.brief}`).pathname;
      if (req.method === 'GET' && path === '/health') return send(200, { ok: true, service: 'brief', synthetic: true });
      if (req.method === 'POST' && path === '/v1/previsit') {
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.doctorId !== 'string' || !/^doctors\/[a-z0-9][a-z0-9-]{0,127}$/.test(body.doctorId)) {
          throw new BriefError(400, 'INVALID_DOCTOR_ID', 'doctorId must be a doctor page slug.');
        }
        return send(200, buildPrevisit(await brainState(upstream, timeoutMs), body.doctorId));
      }
      if (req.method === 'GET' && path === '/v1/contradictions') return send(200, buildContradictions(await brainState(upstream, timeoutMs)));
      if (req.method === 'GET' && path === '/v1/answer/medications') return send(200, buildMedicationAnswer(await brainState(upstream, timeoutMs)));
      send(404, { error: { code: 'NOT_FOUND', message: 'Route not found.' } });
    } catch (error) {
      send(error.status || 500, { error: { code: error.code || 'INTERNAL_ERROR', message: error instanceof BriefError ? error.message : 'Brief generation failed.' } });
    }
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;
  server.timeout = REQUEST_TIMEOUT_MS + 1_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer();
  server.listen(PORTS.brief, HOST, () => console.log('Care Circle brief listening on http://127.0.0.1:4703'));
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
