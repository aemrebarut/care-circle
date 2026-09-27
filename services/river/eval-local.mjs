import {writeFile, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readJsonl, score, sha256, canonical} from './eval.mjs';

const root = new URL('.', import.meta.url);
const file = new URL('dataset/test.jsonl', root);
const rows = await readJsonl(file);
const predictions = [];
for (const row of rows) {
  let output = null, status = null;
  try {
    const response = await fetch('http://127.0.0.1:4702/v1/extract', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify(row.input), signal: AbortSignal.timeout(10000),
    });
    status = response.status;
    const result = await response.json();
    if (response.ok && result.method !== 'deterministic') throw new Error('Expected deterministic local baseline.');
    output = response.ok ? result : null;
  } catch (error) {
    if (error.message === 'Expected deterministic local baseline.') throw error;
  }
  predictions.push({id: row.id, inputSha256: sha256(canonical(row.input)), status, output});
}
const result = {
  kind: 'local-deterministic', evaluatedAt: new Date().toISOString(),
  endpoint: 'http://127.0.0.1:4702/v1/extract',
  testSha256: sha256(await readFile(file)), ...score(rows, predictions),
  httpStatuses: predictions.reduce((counts, row) => { const key = row.status === null ? 'transport_unavailable' : String(row.status); counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
  scope: 'The conservative ingest baseline supports a narrower demo grammar than the River corpus. HTTP 422 means it rejected a note rather than fabricated an extraction.',
};
await writeFile(new URL('results/local-predictions.jsonl', root), predictions.map(p => JSON.stringify(p)).join('\n') + '\n');
await writeFile(new URL('results/local-baseline.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({output: fileURLToPath(new URL('results/local-baseline.json', root)), counts: result.counts, rates: result.rates}));
