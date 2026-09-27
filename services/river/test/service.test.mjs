import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, getStatus} from '../server.mjs';
import {DEMO_NOTE, DEMO_DATE, IDS} from '../../../contract/index.mjs';

test('status is explicitly local and does not claim live River extraction', async () => {
  const status = await getStatus();
  assert.equal(status.mode, 'deterministic');
  assert.equal(status.extractionAvailable, false);
  assert.equal(status.extractionMode, 'unavailable');
  assert.equal(status.replay, null);
  assert.equal(status.externalSubmissionAuthorized, true);
  assert.ok(status.limitations.length > 0);
  assert.ok(status.metrics === null || status.metrics.paired === true);
});

test('future visit input fails with 422 before unavailable extractor fallback', async () => {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4714, '127.0.0.1', resolve); });
  try {
    for (const [date, status, code] of [['2026-10-01', 422, 'FUTURE_VISIT_DATE'], ['2026-02-30', 422, 'INVALID_DATE'], ['2026-09-27', 503, 'RIVER_UNAVAILABLE']]) {
      const result = await fetch('http://127.0.0.1:4714/v1/extract', {method: 'POST', headers: {'content-type': 'application/json', connection: 'close'}, body: JSON.stringify({note: DEMO_NOTE, date, authorId: IDS.ana}), signal: AbortSignal.timeout(3000)});
      assert.equal(result.status, status);
      assert.equal((await result.json()).error.code, code);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
