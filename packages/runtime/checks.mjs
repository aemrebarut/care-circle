import assert from 'node:assert/strict';
import { PORTS, IDS } from '../../contract/index.mjs';
import { request, health } from './http.mjs';
import { services } from './registry.mjs';

export async function smoke({ log = console.log, timeoutMs = 180000, signal } = {}) {
  for (const service of services) {
    for (const endpoint of service.endpoints) {
      signal?.throwIfAborted();
      assert.equal((await health(endpoint, Math.min(timeoutMs, 10000), signal)).ok, true, `${endpoint.name} /health`);
      log(`PASS ${endpoint.name} /health`);
    }
  }
  const state = await request(PORTS.brain, '/v1/state', { timeoutMs, signal });
  assert.equal(state.patientId, IDS.patient);
  assert.ok(Array.isArray(state.pages) && state.pages.length > 0, 'brain has pages');
  const ids = new Set(state.pages.map(page => page.id));
  assert.ok(ids.has(IDS.patient) && ids.has(IDS.nephrologist) && ids.has(IDS.lisinopril), 'stable demo pages');
  assert.ok(state.graph.nodes.length > 0 && state.graph.edges.length > 0, 'brain graph');
  const medications = await request(PORTS.brain, '/v1/medications', { timeoutMs, signal });
  assert.ok(Array.isArray(medications.medications) && medications.medications.length > 0, 'medications available');
  for (const medication of medications.medications) {
    assert.ok(medication.citations?.length, `${medication.id} has citations`);
    for (const citation of medication.citations) assert.ok(ids.has(citation.pageId), 'medication citation resolves');
  }
  log(`PASS brain: ${state.pages.length} pages, ${medications.medications.length} cited medications`);
  const contradictions = await request(PORTS.brief, '/v1/contradictions', { timeoutMs, signal });
  assert.ok(Array.isArray(contradictions.contradictions));
  const answer = await request(PORTS.brief, '/v1/answer/medications', { timeoutMs, signal });
  assert.ok(Array.isArray(answer.medications) && answer.medications.length > 0);
  log('PASS brief: cited answer and contradiction response');
  const river = await request(PORTS.river, '/v1/status', { timeoutMs, signal });
  assert.ok(['river', 'deterministic'].includes(river.mode));
  const sponsors = await request(PORTS.sponsors, '/v1/status', { timeoutMs, signal });
  assert.ok(sponsors.memorable?.mode && sponsors.ufo?.mode);
  log(`PASS sponsor status: River ${river.mode}, Memorable ${sponsors.memorable.mode}, UFO ${sponsors.ufo.mode}`);
  const html = await request(PORTS.web, '/', { json: false, timeoutMs, signal });
  assert.ok(html.includes('Not medical advice'), 'web safety footer');
  const proxied = await request(PORTS.web, '/api/brain/state', { timeoutMs, signal });
  assert.equal(proxied.patientId, IDS.patient);
  log('PASS web UI and brain proxy');
  return { ok: true, pages: state.pages.length, medications: medications.medications.length };
}

export async function resetDemo({ timeoutMs = 180000, log = console.log, signal } = {}) {
  let reset;
  try { reset = await request(PORTS.brain, '/v1/reset', { method: 'POST', body: {}, timeoutMs, signal }); }
  catch (error) { throw new Error(`Brain reset did not return success. Its outcome may be unknown; do not retry while it may still be running. ${error.message}`); }
  assert.equal(reset.ok, true, 'brain reset acknowledgement');
  const sponsors = await request(PORTS.sponsors, '/v1/reset', { method: 'POST', body: {}, timeoutMs, signal });
  assert.equal(sponsors.ok, true, 'sponsor reset acknowledgement');
  const medications = await request(PORTS.brain, '/v1/medications', { timeoutMs, signal });
  const lisinopril = medications.medications.find(medication => medication.id === IDS.lisinopril);
  assert.ok(lisinopril && /^10\s*mg(?:\b|$)/i.test(lisinopril.dose), 'reset restored recorded 10 mg baseline');
  log('Demo reset complete through brain and sponsors HTTP APIs. Recorded synthetic lisinopril baseline: 10 mg.');
  return { ok: true, revision: reset.revision };
}
