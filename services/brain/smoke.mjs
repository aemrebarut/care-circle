import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const base = 'http://127.0.0.1:4701';
async function get(path) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    let response;
    try { response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) }); } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(500);
      continue;
    }
    if (response.status === 503) {
      await response.arrayBuffer();
      await delay(500);
      continue;
    }
    assert.equal(response.status, 200, `GET ${path} returned ${response.status}`);
    return response.json();
  }
  assert.fail(`GET ${path} did not become ready within 180 seconds`);
}
const health = await get('/health');
assert.equal(health.service, 'brain');
assert.equal(health.storage, 'gbrain');
const state = await get('/v1/state');
const index = new Map(state.pages.map(page => [page.id, page]));
assert.ok(index.has(state.patientId));
assert.ok(state.pages.length >= 30);
for (const edge of state.graph.edges) {
  assert.ok(index.has(edge.source));
  assert.ok(index.has(edge.target));
}
const meds = await get('/v1/medications');
assert.equal(meds.medications.length, 7);
for (const medication of meds.medications) {
  assert.ok(medication.citations.length);
  for (const citation of medication.citations) assert.ok(index.get(citation.pageId)?.body.includes(citation.quote));
}
const page = await get('/v1/pages/medications%2Flisinopril');
assert.equal(page.page.type, 'medication');
console.log(JSON.stringify({ ok: true, service: 'brain', pages: state.pages.length, medications: meds.medications.length, graphEdges: state.graph.edges.length, revision: state.revision, mode: 'read-only-http' }));
