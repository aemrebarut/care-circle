// Explicit integration check. This writes the canonical synthetic demo note to
// the shared brain through ingest. Coordinate the mutation window with runtime.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { DEMO_NOTE, DEMO_DATE, IDS, HOST, PORTS } from '../../contract/index.mjs';

async function request(port, path, body) {
  const response = await fetch(`http://${HOST}:${port}${path}`, {
    ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(100000),
    redirect: 'error',
  });
  const result = await response.json();
  assert.equal(response.status, 200, `${path} expected 200; got ${response.status} (${result.error?.code ?? 'no error code'})`);
  return result;
}

const input = { note: DEMO_NOTE, authorId: IDS.ana, date: DEMO_DATE };
const preview = await request(PORTS.ingest, '/v1/extract', input);
const first = await request(PORTS.ingest, '/v1/ingest', input);
const retry = await request(PORTS.ingest, '/v1/ingest', input);
assert.equal(first.applied.ok, true);
assert.deepEqual(first.extraction, preview.extraction);
assert.deepEqual(retry.extraction, first.extraction);
assert.deepEqual(retry.applied, first.applied);
assert.equal(retry.idempotencyKey, first.idempotencyKey);

const state = await request(PORTS.brain, '/v1/state');
const visits = state.pages.filter(page => page.id === first.applied.visitId);
assert.equal(visits.length, 1, 'repeat must create exactly one source visit');
const visit = visits[0];
assert.equal(visit.fields.note, DEMO_NOTE);
assert.equal(visit.fields.summary, DEMO_NOTE);
assert.equal(visit.fields.authorId, IDS.ana);
assert.equal(visit.fields.date, DEMO_DATE);
assert.deepEqual(visit.fields.attendeeIds, [IDS.ana]);
assert.equal(visit.fields.doctorId, IDS.cardiologist);
assert.equal(visit.fields.followUps[0].text, 'Wants potassium rechecked before nephrology Tuesday.');
assert.equal(visit.fields.followUps[0].dueDate, undefined);
const questions = state.pages.filter(page => page.type === 'question' && page.fields.sourceId === visit.id);
assert.equal(questions.length, 1);
assert.equal(questions[0].fields.doctorId, IDS.nephrologist);
assert.equal(questions[0].fields.text, 'Ask the nephrologist about the potassium recheck.');
assert.ok(state.graph.edges.some(edge => edge.source === visit.id && edge.target === IDS.lisinopril));

const { medications } = await request(PORTS.brain, '/v1/medications');
const medication = medications.find(page => page.id === IDS.lisinopril);
assert.ok(medication);
assert.equal(medication.claims.filter(claim => claim.sourceId === visit.id && claim.dose === '20 mg' && claim.frequency === 'daily').length, 1);
assert.ok(medication.claims.some(claim => claim.dose === '10 mg'), 'older source claim must survive');
assert.ok(medication.citations.some(citation => citation.pageId === visit.id), 'new claim must resolve to a source citation');
await writeFile(new URL('./evidence/latest-commit.json', import.meta.url), `${JSON.stringify({ input, first, retry }, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  check: 'canonical committed ingest plus exact retry',
  visitId: visit.id,
  revision: first.applied.revision,
  method: first.method,
  sourcePreserved: true,
  duplicateVisits: 0,
  duplicateClaims: 0,
  earlierDosePreserved: true,
  questionSourcePreserved: true,
  noResetPerformed: true,
}, null, 2));
