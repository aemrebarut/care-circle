import test from 'node:test';
import assert from 'node:assert/strict';
import {getStatus} from '../server.mjs';

test('status is explicitly local and does not claim live River extraction', async () => {
  const status = await getStatus();
  assert.equal(status.mode, 'deterministic');
  assert.equal(status.extractionAvailable, false);
  assert.equal(status.externalSubmissionAuthorized, true);
  assert.ok(status.limitations.length > 0);
  assert.ok(status.metrics === null || status.metrics.paired === true);
});
