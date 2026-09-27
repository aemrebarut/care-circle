import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const maxBodyBytes = 32 * 1024;

async function readArtifact(name) {
  try { return JSON.parse(await readFile(resolve(root, name), 'utf8')); }
  catch { return null; }
}

export async function getStatus() {
  const [manifest, evaluation, local, run] = await Promise.all([
    readArtifact('dataset/manifest.json'),
    readArtifact('results/comparison.json'),
    readArtifact('results/local-baseline.json'),
    readArtifact('training/artifacts/run-status.json'),
  ]);
  return {
    mode: 'deterministic',
    trainingStatus: run?.status || (manifest ? 'prepared' : 'preparing'),
    externalSubmissionAuthorized: true,
    extractionAvailable: false,
    corpus: manifest,
    metrics: evaluation?.paired === true ? evaluation : null,
    localBaseline: local,
    experiment: run,
    limitations: [
      'The local HTTP service does not call external endpoints or load credentials.',
      'Live River extraction is unavailable; ingest uses its conservative deterministic fallback.',
      'Training and evaluation use synthetic examples only. These are not clinical accuracy measurements.',
      'Null model metrics mean no verified paired base and trained evaluation has completed.',
    ],
  };
}

function json(res, status, value) {
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  res.end(JSON.stringify(value));
}

function fail(res, status, code, message) { json(res, status, {error: {code, message}}); }

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error('Request exceeds 32768 bytes.'), {status: 413, code: 'BODY_TOO_LARGE'});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), {status: 400, code: 'INVALID_JSON'}); }
}

export function createServer() {
  const server = http.createServer(async (req, res) => {
    const pathname = (req.url || '').split('?')[0];
    try {
      if (req.method === 'GET' && pathname === '/health') return json(res, 200, {ok: true, service: 'river', mode: 'deterministic'});
      if (req.method === 'GET' && pathname === '/v1/status') return json(res, 200, await getStatus());
      if (req.method === 'POST' && pathname === '/v1/extract') {
        if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return fail(res, 415, 'CONTENT_TYPE', 'Use application/json.');
        const input = await body(req);
        if (!input || typeof input.note !== 'string' || !input.note.trim() || input.note.length > 16000) return fail(res, 400, 'INVALID_NOTE', 'Provide a nonempty note of at most 16000 characters.');
        if (input.date !== undefined && (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date))) return fail(res, 400, 'INVALID_DATE', 'date must use YYYY-MM-DD.');
        if (input.date !== undefined && (!Number.isFinite(Date.parse(`${input.date}T00:00:00Z`)) || new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) !== input.date)) return fail(res, 422, 'INVALID_DATE', 'date must identify a real calendar date.');
        if (input.date > '2026-09-27') return fail(res, 422, 'FUTURE_VISIT_DATE', 'Visit dates cannot be later than the demo date 2026-09-27.');
        if (input.authorId !== undefined && !['people/ana-alvarez', 'people/ben-alvarez', 'people/celia-alvarez'].includes(input.authorId)) return fail(res, 400, 'INVALID_AUTHOR', 'authorId must identify a supported synthetic sibling.');
        return fail(res, 503, 'RIVER_UNAVAILABLE', 'Live River extraction is unavailable. Use the deterministic ingest fallback.');
      }
      return fail(res, 404, 'NOT_FOUND', 'Unknown route.');
    } catch (error) {
      if (!res.headersSent) fail(res, error.status || 500, error.code || 'INTERNAL_ERROR', error.status ? error.message : 'Request failed.');
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.setTimeout(10000, socket => socket.destroy());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(4704, '127.0.0.1', () => console.log('River status service listening on http://127.0.0.1:4704'));
}
