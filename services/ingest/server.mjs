import http from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { HOST, PORTS, DEMO_NOTE, DEMO_DATE, IDS } from '../../contract/index.mjs';
import { IngestError, normalizeInput, extractDeterministic, defaultIdempotencyKey } from './extract.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_UPSTREAM_BYTES = 1024 * 1024;
const BRAIN_URL = `http://${HOST}:${PORTS.brain}/v1/ingest`;
const RIVER_URL = `http://${HOST}:${PORTS.river}/v1/extract`;

function json(response, status, body) {
  const bytes = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(bytes),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(bytes);
}

async function bodyJson(request, timeoutMs) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) throw new IngestError(415, 'unsupported_media_type', 'Use application/json.');
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') throw new IngestError(415, 'unsupported_encoding', 'Compressed request bodies are not supported.');
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) throw new IngestError(413, 'body_too_large', 'Request body exceeds 64 KiB.');
  const bytes = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
      if (error) { request.resume(); reject(error); }
      else resolve(Buffer.concat(chunks));
    };
    const onData = chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) finish(new IngestError(413, 'body_too_large', 'Request body exceeds 64 KiB.'));
      else chunks.push(chunk);
    };
    const onEnd = () => finish();
    const onError = () => finish(new IngestError(400, 'request_interrupted', 'Request body could not be read.'));
    const onAborted = () => finish(new IngestError(400, 'request_interrupted', 'Request body was interrupted.'));
    const timer = setTimeout(() => finish(new IngestError(408, 'request_timeout', 'Request body was not completed within the allowed time.')), timeoutMs);
    timer.unref();
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('error', onError);
    request.once('aborted', onAborted);
  });
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new IngestError(400, 'invalid_json', 'Request body must be valid UTF-8 JSON.'); }
}

async function boundedJson(response) {
  if (!response.body) throw new Error('Missing upstream body');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPSTREAM_BYTES) throw new Error('Oversized upstream response');
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function post(fetchImpl, url, payload, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    signal,
    redirect: 'error',
  });
  return { status: response.status, ok: response.ok, data: await boundedJson(response) };
}

function validApplied(value) {
  const slug = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+$/;
  return value && value.ok === true && typeof value.visitId === 'string' && /^visits\/[a-z0-9][a-z0-9-]*$/.test(value.visitId) &&
    Array.isArray(value.changedPageIds) && value.changedPageIds.includes(value.visitId) && value.changedPageIds.every(id => typeof id === 'string' && slug.test(id)) &&
    ((typeof value.revision === 'string' && value.revision.trim().length > 0) || (Number.isSafeInteger(value.revision) && value.revision > 0));
}

function validatedProvenance(value, input) {
  if (input.note !== DEMO_NOTE || input.authorId !== IDS.ana || input.date !== DEMO_DATE) throw new Error('Cached replay is limited to the exact synthetic demo input');
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.mode !== 'cached-replay' || value.liveInference !== false) throw new Error('Invalid River replay provenance');
  const textKeys = ['model', 'checkpoint', 'requestId', 'sampledAt'];
  const hashKeys = ['inputSha256', 'promptSha256', 'outputSha256'];
  if (textKeys.some(key => typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 256 || /[\u0000-\u001f]/.test(value[key]))) throw new Error('Invalid River provenance field');
  if (hashKeys.some(key => typeof value[key] !== 'string' || !/^[a-f0-9]{64}$/.test(value[key]))) throw new Error('Invalid River provenance digest');
  if (!Number.isFinite(Date.parse(value.sampledAt)) || !value.checkpoint.startsWith('river://')) throw new Error('Invalid River model provenance');
  // River's provenance uses sorted keys for this flat canonical input object.
  const expectedInput = createHash('sha256').update(JSON.stringify({ authorId: input.authorId, date: input.date, note: input.note })).digest('hex');
  if (value.inputSha256 !== expectedInput) throw new Error('River provenance belongs to another source input');
  return Object.fromEntries(['mode', 'liveInference', ...textKeys, ...hashKeys].map(key => [key, value[key]]));
}

export function createIngestServer({ fetchImpl = fetch, useRiver = false, upstreamTimeoutMs = 90000, riverTimeoutMs = 2500, requestBodyTimeoutMs = 10000 } = {}) {
  const server = http.createServer(async (request, response) => {
    // A client may disconnect before or after validation. Never let a later
    // IncomingMessage error turn a bounded request failure into a process crash.
    request.on('error', () => {});
    try {
      const url = new URL(request.url, `http://${HOST}:${PORTS.ingest}`);
      if (request.method === 'GET' && url.pathname === '/health') {
        json(response, 200, { ok: true, service: 'ingest', mode: 'deterministic', riverEnabled: useRiver });
        return;
      }
      if (!['/v1/extract', '/v1/ingest'].includes(url.pathname)) throw new IngestError(404, 'not_found', 'Route not found.');
      if (request.method !== 'POST') throw new IngestError(405, 'method_not_allowed', 'This route requires POST.');
      const input = await bodyJson(request, requestBodyTimeoutMs);
      const commit = url.pathname === '/v1/ingest';
      const normalized = normalizeInput(input, { commit });
      let result = extractDeterministic(input);
      if (useRiver) {
        try {
          const riverInput = { note: normalized.note, authorId: normalized.authorId, date: result.extraction.visit.date };
          const river = await post(fetchImpl, RIVER_URL, riverInput, riverTimeoutMs);
          // The local baseline is deliberately the acceptance boundary until a
          // broader source-evidence validator is reviewed. A model cannot expand
          // the set of supported facts by returning well-formed JSON alone.
          if (!river.ok || river.data.method !== 'river' || !isDeepStrictEqual(river.data.extraction, result.extraction) || !Array.isArray(river.data.warnings) || !river.data.warnings.every(warning => typeof warning === 'string')) throw new Error('Unverified River extraction');
          const provenance = validatedProvenance(river.data.provenance, riverInput);
          const warnings = [...result.warnings, ...river.data.warnings];
          warnings.push('This is a saved River prediction for the exact synthetic input. No live inference occurred.');
          result = { extraction: result.extraction, method: 'river', warnings, provenance };
        } catch {
          result.warnings.push('River was unavailable or its output could not be verified against the source. Used deterministic extraction.');
        }
      }
      if (!commit) { json(response, 200, result); return; }
      const idempotencyKey = normalized.idempotencyKey ?? defaultIdempotencyKey(normalized, result.extraction);
      let brain;
      try {
        brain = await post(fetchImpl, BRAIN_URL, {
          extraction: result.extraction,
          note: normalized.note,
          authorId: normalized.authorId,
          idempotencyKey,
        }, upstreamTimeoutMs);
      } catch (error) {
        const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
        throw new IngestError(timeout ? 504 : 502, timeout ? 'brain_timeout' : 'brain_unavailable',
          'Brain did not return a verified commit result. The outcome may be unknown; retry the same note with this idempotency key.',
          { idempotencyKey, outcome: 'unknown', retryable: true });
      }
      if (!brain.ok) {
        const status = [400, 409, 413, 422, 429, 503, 504].includes(brain.status) ? brain.status : 502;
        const code = brain.status === 409 ? 'idempotency_conflict' : 'brain_rejected';
        throw new IngestError(status, code, brain.status === 409 ? 'Brain rejected an idempotency key reused with different content.' : 'Brain rejected the ingest request. No successful commit was confirmed.',
          { idempotencyKey, upstreamStatus: brain.status, outcome: brain.status >= 500 ? 'unknown' : 'rejected', retryable: brain.status >= 500 || brain.status === 429 });
      }
      if (!validApplied(brain.data)) throw new IngestError(502, 'invalid_brain_response', 'Brain returned an invalid commit receipt. Retry with the same idempotency key to recover its outcome.', { idempotencyKey, outcome: 'unknown', retryable: true });
      json(response, 200, { ...result, applied: brain.data, idempotencyKey });
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      const known = error instanceof IngestError;
      if (!request.complete) response.setHeader('connection', 'close');
      json(response, known ? error.status : 500, {
        error: { code: known ? error.code : 'internal_error', message: known ? error.message : 'Ingest could not complete this request.', ...(known ? error.details : {}) },
      });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createIngestServer({ useRiver: process.env.INGEST_USE_RIVER === '1' });
  server.listen(PORTS.ingest, HOST, () => console.log(`Care Circle ingest listening on http://${HOST}:${PORTS.ingest}`));
  server.on('error', error => { console.error(`Ingest server failed: ${error.code ?? 'server_error'}`); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { process.exitCode = 0; }));
}
