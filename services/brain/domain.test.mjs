import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { HttpError, applyIngest, canonicalJson, graph, medications, pageMarkdown, validateSeed } from './domain.mjs';

const ids = {
  patient: 'people/rose-alvarez', author: 'people/ana-alvarez', attendee: 'people/ben-alvarez',
  doctor: 'doctors/cardiologist', specialist: 'doctors/nephrologist',
  medication: 'medications/lisinopril', visit: 'visits/2026-09-23-cardiology', pharmacy: 'pharmacy/2026-09-24',
};

function page(id, type, fields = {}, body = `${type} source`, links = []) {
  return { id, type, title: id.split('/').at(-1), body, fields, links, updatedAt: '2026-09-27T12:00:00.000Z' };
}

function seed() {
  const claims = [
    { dose: '10 mg', frequency: 'daily', sourceId: ids.visit, date: '2026-09-23', attendeeIds: [ids.attendee], kind: 'visit' },
    { dose: '10 mg', frequency: 'daily', sourceId: ids.pharmacy, date: '2026-09-24', attendeeIds: [ids.author], kind: 'pharmacy' },
  ];
  return {
    patientId: ids.patient,
    pages: [
      page(ids.patient, 'patient'), page(ids.author, 'person'), page(ids.attendee, 'person'),
      page(ids.doctor, 'doctor', { lastVisitDate: '2026-09-23' }),
      page(ids.specialist, 'doctor', { lastVisitDate: '2026-09-15' }),
      page(ids.visit, 'visit', { date: '2026-09-23', doctorId: ids.doctor, attendeeIds: [ids.attendee] }, 'Lisinopril is recorded as 10 mg daily.'),
      page(ids.pharmacy, 'pharmacy', { date: '2026-09-24' }, 'Lisinopril: pharmacy records 10 mg daily.'),
      page(ids.medication, 'medication', { name: 'Lisinopril', dose: '10 mg', frequency: 'daily', status: 'active', claims }, 'Lisinopril source history.', [
        { target: ids.visit, type: 'mentions' }, { target: ids.pharmacy, type: 'mentions' },
      ]),
    ],
  };
}

function state() {
  const initial = validateSeed(seed());
  return { version: 1, ...initial, revision: 0, resetEpoch: 0, idempotency: {}, ownedIds: initial.pages.map(item => item.id) };
}

function payload() {
  return {
    idempotencyKey: 'synthetic-demo-note', authorId: ids.author,
    note: '  Cardiology today with Ben.\nLisinopril recorded as 20 mg daily.\nAsk nephrology about potassium.  ',
    extraction: {
      visit: { date: '2026-09-27', doctorId: ids.doctor, attendeeIds: [ids.attendee], summary: 'Lisinopril changed; potassium question remains open.' },
      medicationChanges: [{ medicationId: ids.medication, name: 'lisinopril', dose: '20 mg', frequency: 'daily' }],
      questions: [{ doctorId: ids.specialist, text: 'When is the potassium recheck?' }],
      followUps: [{ text: 'Ask the care team about the potassium record.', dueDate: '2026-09-29' }],
    },
  };
}

function expectBad(fn, status = 400, code = 'invalid_request') {
  assert.throws(fn, error => error instanceof HttpError && error.status === status && error.code === code);
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test('canonical JSON sorts object keys recursively and keeps array order', () => {
  assert.equal(canonicalJson({ z: [3, { b: 2, a: 1 }], a: true }), '{"a":true,"z":[3,{"a":1,"b":2}]}');
  assert.equal(canonicalJson(JSON.parse('{"__proto__":{"safe":true},"a":0}')), '{"__proto__":{"safe":true},"a":0}');
  expectBad(() => canonicalJson({ bad: undefined }));
  expectBad(() => canonicalJson({ bad: Number.NaN }));
  const circular = {};
  circular.self = circular;
  expectBad(() => canonicalJson(circular));
});

test('seed validation clones records and rejects bad IDs and references', () => {
  const original = seed();
  const checked = validateSeed(original);
  checked.pages[0].title = 'Changed clone';
  assert.notEqual(original.pages[0].title, checked.pages[0].title);
  for (const unsafe of ['../other', '/absolute', 'people/../../secret', 'people/name;touch', 'people/name%2fother', 'people/name\nother', '__proto__']) {
    const bad = seed();
    bad.pages[0].id = unsafe;
    expectBad(() => validateSeed(bad));
  }
  const dangling = seed();
  dangling.pages[0].links.push({ target: 'people/unknown', type: 'mentions' });
  expectBad(() => validateSeed(dangling));
  const duplicate = seed();
  duplicate.pages.push(structuredClone(duplicate.pages[0]));
  expectBad(() => validateSeed(duplicate));
});

test('the shared synthetic world validates with seven fully cited medications', async () => {
  const world = validateSeed(JSON.parse(await readFile(new URL('../../packages/world/seed.json', import.meta.url), 'utf8')));
  const view = medications({ ...world, revision: 1 });
  assert.equal(view.medications.length, 7);
  for (const medication of view.medications) {
    assert.ok(medication.citations.length > 0);
    for (const citation of medication.citations) {
      const source = world.pages.find(item => item.id === citation.pageId);
      assert.ok(source?.body.includes(citation.quote));
    }
  }
});

test('ingest retains the verbatim note, separates authorship from attendance, and preserves claims', () => {
  const initial = freeze(state());
  const input = freeze(payload());
  const original = canonicalJson(initial);
  const applied = applyIngest(initial, input);
  assert.equal(canonicalJson(initial), original);
  assert.equal(applied.state.revision, 1);
  assert.equal(applied.result.revision, 1);
  const visit = applied.state.pages.find(item => item.id === applied.result.visitId);
  assert.equal(visit.fields.note, input.note);
  assert.equal(visit.fields.authorId, ids.author);
  assert.deepEqual(visit.fields.attendeeIds, [ids.attendee]);
  assert.ok(visit.body.includes('>   Cardiology today with Ben.'));
  assert.ok(visit.links.some(link => link.target === ids.attendee && link.type === 'attended'));
  assert.ok(!visit.links.some(link => link.target === ids.author && link.type === 'attended'));
  const medication = applied.state.pages.find(item => item.id === ids.medication);
  assert.deepEqual(medication.fields.claims.slice(0, 2), initial.pages.find(item => item.id === ids.medication).fields.claims);
  assert.equal(medication.fields.claims[2].kind, 'visit');
  assert.deepEqual(medication.fields.claims[2].attendeeIds, [ids.attendee]);
  assert.equal(medication.fields.dose, '20 mg');
  assert.equal(medication.fields.recordedSourceId, visit.id);
  const question = applied.state.pages.find(item => item.type === 'question');
  assert.equal(question.fields.sourceId, visit.id);
  assert.equal(question.fields.doctorId, ids.specialist);
  assert.ok(applied.state.ownedIds.includes(question.id));
  assert.equal(applied.state.pages.find(item => item.id === ids.doctor).fields.lastVisitDate, '2026-09-27');
  assert.equal(applied.state.pages.find(item => item.id === ids.specialist).fields.lastVisitDate, '2026-09-15');
  validateSeed(applied.state);
});

test('canonical idempotency survives key order changes and response mutation', () => {
  const applied = applyIngest(state(), payload());
  const expected = structuredClone(applied.result);
  applied.result.changedPageIds.push('not/a-page');
  const reordered = payload();
  reordered.extraction.visit = { summary: reordered.extraction.visit.summary, attendeeIds: [ids.attendee], doctorId: ids.doctor, date: '2026-09-27' };
  const retry = applyIngest(freeze(applied.state), reordered);
  assert.equal(retry.state, applied.state);
  assert.deepEqual(retry.result, expected);
  assert.equal(retry.state.pages.filter(item => item.id.startsWith('visits/ingest-')).length, 1);
  const altered = payload();
  altered.note += ' Changed note.';
  expectBad(() => applyIngest(applied.state, altered), 409, 'idempotency_conflict');
  altered.note = payload().note;
  altered.authorId = ids.attendee;
  expectBad(() => applyIngest(applied.state, altered), 409, 'idempotency_conflict');
});

test('idempotency keys are required, bounded, and safe as dictionary keys', () => {
  for (const key of [undefined, '', ' ', 'x'.repeat(201), 123, 'bad\u0000key']) {
    const input = payload();
    input.idempotencyKey = key;
    expectBad(() => applyIngest(state(), input));
  }
  for (const key of ['__proto__', 'constructor', 'toString']) {
    const input = payload();
    input.idempotencyKey = key;
    const applied = applyIngest(state(), input);
    assert.equal(Object.getPrototypeOf(applied.state.idempotency), Object.prototype);
    assert.equal(applyIngest(applied.state, input).result.visitId, applied.result.visitId);
  }
});

test('reset epochs separate deterministic generated IDs and retain tombstone ownership', () => {
  const initial = state();
  initial.ownedIds.push('visits/obsolete-demo');
  const first = applyIngest(initial, payload());
  const expected = createHash('sha256').update(canonicalJson({ idempotencyKey: payload().idempotencyKey, resetEpoch: 0 })).digest('hex').slice(0, 24);
  assert.equal(first.result.visitId, `visits/ingest-${expected}`);
  const second = applyIngest({ ...state(), resetEpoch: 1 }, payload());
  assert.notEqual(first.result.visitId, second.result.visitId);
  assert.ok(first.state.ownedIds.includes('visits/obsolete-demo'));
});

test('backdated ingest retains the newest recorded dose and every pharmacy conflict', () => {
  const first = applyIngest(state(), payload());
  const older = payload();
  older.idempotencyKey = 'older-note';
  older.note = 'Historical note: lisinopril recorded as 5 mg daily.';
  older.extraction.visit.date = '2026-09-20';
  older.extraction.medicationChanges[0].dose = '5 mg';
  const second = applyIngest(first.state, older);
  const medication = second.state.pages.find(item => item.id === ids.medication);
  assert.equal(medication.fields.dose, '20 mg');
  assert.equal(medication.fields.recordedSourceId, first.result.visitId);
  assert.equal(medication.fields.claims.length, 4);
  assert.equal(medication.fields.claims[1].kind, 'pharmacy');
  assert.equal(medication.fields.claims[1].dose, '10 mg');
  assert.equal(medication.fields.claims[3].dose, '5 mg');
  assert.equal(second.state.pages.find(item => item.id === ids.doctor).fields.lastVisitDate, '2026-09-27');
  assert.equal(medications(second.state).medications[0].dose, '20 mg');
});

test('same-day later recorded claim becomes latest without removing earlier claims', () => {
  const first = applyIngest(state(), payload());
  const later = payload();
  later.idempotencyKey = 'same-day-later';
  later.note = 'Later same-day source records lisinopril 15 mg daily.';
  later.extraction.medicationChanges[0].dose = '15 mg';
  const second = applyIngest(first.state, later);
  const medication = medications(second.state).medications[0];
  assert.equal(medication.dose, '15 mg');
  assert.equal(medication.claims.length, 4);
});

test('empty attendance and medication changes remain valid without inventing attendees', () => {
  const input = payload();
  input.extraction.visit.attendeeIds = [];
  input.extraction.medicationChanges = [];
  input.extraction.questions = [];
  input.extraction.followUps = [];
  const applied = applyIngest(state(), input);
  const visit = applied.state.pages.find(item => item.id === applied.result.visitId);
  assert.deepEqual(visit.fields.attendeeIds, []);
  assert.ok(!visit.links.some(link => link.type === 'attended'));
  assert.equal(applied.state.pages.filter(item => item.type === 'question').length, 0);
  assert.equal(medications(applied.state).medications[0].dose, '10 mg');
});

test('visit and follow-up dates must be real calendar dates including leap years', () => {
  for (const badDate of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '0000-01-01', '2026-9-27', 'today', '2026-09-27T00:00:00Z']) {
    const input = payload();
    input.extraction.visit.date = badDate;
    expectBad(() => applyIngest(state(), input));
    input.extraction.visit.date = '2026-09-27';
    input.extraction.followUps[0].dueDate = badDate;
    expectBad(() => applyIngest(state(), input));
  }
  const leap = payload();
  leap.extraction.visit.date = '2024-02-29';
  leap.extraction.followUps[0].dueDate = '2028-02-29';
  assert.equal(applyIngest(state(), leap).result.ok, true);
});

test('future visit dates return 422 without changing state, while future follow-ups remain allowed', () => {
  const initial = freeze(state());
  const before = canonicalJson(initial);
  for (const futureDate of ['2026-09-28', '2027-01-01', '9999-12-31']) {
    const input = payload();
    input.extraction.visit.date = futureDate;
    expectBad(() => applyIngest(initial, input), 422, 'future_visit_date');
    assert.equal(canonicalJson(initial), before);
  }
  const boundary = payload();
  boundary.extraction.followUps[0].dueDate = '2027-01-01';
  const applied = applyIngest(initial, boundary);
  assert.equal(applied.result.ok, true);
  const visit = applied.state.pages.find(item => item.id === applied.result.visitId);
  assert.equal(visit.fields.date, '2026-09-27');
  assert.equal(visit.fields.followUps[0].dueDate, '2027-01-01');
});

test('doctor source text advances with a cited visit and does not regress on older ingest', async () => {
  const world = validateSeed(JSON.parse(await readFile(new URL('../../packages/world/seed.json', import.meta.url), 'utf8')));
  const initial = { ...world, version: 1, revision: 0, resetEpoch: 0, idempotency: {}, ownedIds: world.pages.map(item => item.id) };
  const input = payload();
  input.extraction.visit.date = '2026-09-25';
  const first = applyIngest(initial, input);
  const doctor = first.state.pages.find(item => item.id === ids.doctor);
  assert.equal(doctor.fields.lastVisitDate, '2026-09-25');
  assert.ok(doctor.body.includes(`Last recorded visit: 2026-09-25 (source: [[${first.result.visitId}]]).`));
  assert.ok(!doctor.body.includes('Last recorded visit: 2026-09-23'));
  assert.ok(doctor.body.includes('Next appointment on the family calendar: 2026-09-27.'));
  const newer = payload();
  newer.idempotencyKey = 'later-doctor-visit';
  const second = applyIngest(first.state, newer);
  const updatedDoctor = second.state.pages.find(item => item.id === ids.doctor);
  assert.ok(updatedDoctor.body.includes(`Last recorded visit: 2026-09-27 (source: [[${second.result.visitId}]]).`));
  assert.ok(!updatedDoctor.body.includes('Last recorded visit: 2026-09-25'));
  assert.equal(updatedDoctor.body.match(/Last recorded visit:/g).length, 1);
  const backdated = payload();
  backdated.idempotencyKey = 'earlier-doctor-visit';
  backdated.extraction.visit.date = '2026-09-24';
  const third = applyIngest(second.state, backdated);
  const finalDoctor = third.state.pages.find(item => item.id === ids.doctor);
  assert.equal(finalDoctor.fields.lastVisitDate, '2026-09-27');
  assert.equal(finalDoctor.body, updatedDoctor.body);
  assert.ok(finalDoctor.links.some(link => link.target === second.result.visitId));
});

test('all referenced IDs must resolve to their required page types', () => {
  const mutations = [
    input => { input.authorId = ids.doctor; },
    input => { input.authorId = 'people/missing'; },
    input => { input.extraction.visit.doctorId = 'doctors/missing'; },
    input => { input.extraction.visit.doctorId = 'doctors/../../escape'; },
    input => { input.extraction.visit.attendeeIds = [ids.medication]; },
    input => { input.extraction.visit.attendeeIds = [ids.attendee, ids.attendee]; },
    input => { input.extraction.medicationChanges[0].medicationId = ids.doctor; },
    input => { input.extraction.medicationChanges[0].name = 'Another medication'; },
    input => { input.extraction.questions[0].doctorId = ids.author; },
    input => { input.extraction.medicationChanges.push(structuredClone(input.extraction.medicationChanges[0])); },
  ];
  for (const mutate of mutations) {
    const input = payload();
    mutate(input);
    expectBad(() => applyIngest(state(), input));
  }
});

test('bounded extraction text and arrays reject malformed input before mutation', () => {
  const mutations = [
    input => { input.note = 'x'.repeat(20001); },
    input => { input.extraction.visit.summary = ''; },
    input => { input.extraction.questions = Array.from({ length: 51 }, () => ({ doctorId: ids.doctor, text: 'Question' })); },
    input => { input.extraction.questions = null; },
    input => { input.extraction.followUps = [{ text: 'Follow-up', run: 'not-allowed' }]; },
    input => { input.extraction.medicationChanges[0].dose = 'x'.repeat(201); },
    input => { input.extraction.command = 'not-allowed'; },
  ];
  for (const mutate of mutations) {
    const initial = state();
    const before = canonicalJson(initial);
    const input = payload();
    mutate(input);
    expectBad(() => applyIngest(initial, input));
    assert.equal(canonicalJson(initial), before);
  }
});

test('citations quote literal source text and returned claims cannot mutate state', () => {
  const applied = applyIngest(state(), payload());
  const view = medications(applied.state);
  assert.equal(view.revision, 1);
  for (const citation of view.medications[0].citations) {
    const source = applied.state.pages.find(item => item.id === citation.pageId);
    assert.equal(citation.title, source.title);
    assert.ok(source.body.includes(citation.quote));
  }
  const latest = view.medications[0].citations.at(-1);
  assert.equal(latest.quote, 'Lisinopril recorded as 20 mg daily.');
  assert.deepEqual(latest.attendeeIds, [ids.attendee]);
  view.medications[0].claims[0].dose = 'altered response';
  assert.equal(applied.state.pages.find(item => item.id === ids.medication).fields.claims[0].dose, '10 mg');
  const broken = seed();
  broken.pages.at(-1).fields.citations = [{ pageId: ids.visit, title: 'Title', quote: 'Fabricated quote.' }];
  expectBad(() => validateSeed(broken));
});

test('graph edges resolve, are deduplicated, and retain their built-in link types', () => {
  const applied = applyIngest(state(), payload());
  const result = graph(applied.state);
  const known = new Set(result.nodes.map(node => node.id));
  for (const edge of result.edges) {
    assert.ok(known.has(edge.source));
    assert.ok(known.has(edge.target));
    assert.ok(['mentions', 'attended'].includes(edge.type));
  }
  const visit = applied.state.pages.find(item => item.id === applied.result.visitId);
  visit.links.push(structuredClone(visit.links[0]));
  assert.equal(graph(applied.state).edges.length, result.edges.length);
  visit.links.push({ target: 'people/missing', type: 'mentions' });
  expectBad(() => graph(applied.state));
});

test('GBrain markdown preserves source fences and appends final metadata without a nested body', () => {
  const source = page('visits/test', 'visit', {}, '# Existing source\n\nLiteral content.\n\n```care-circle-page\n{"stale":true}\n```\n');
  source.links.push({ target: ids.doctor, type: 'mentions' });
  const rendered = pageMarkdown(source);
  assert.match(rendered, /^---\ntitle: .*\ntype: note\nembed_skip: true\n---\n/);
  assert.equal(rendered.match(/^```care-circle-page/gm)?.length, 2);
  assert.ok(rendered.includes(source.body));
  assert.ok(rendered.includes(`## Related records\n\n- [[${ids.doctor}]]`));
  const finalFence = rendered.slice(rendered.lastIndexOf('```care-circle-page\n'));
  const metadata = JSON.parse(finalFence.match(/^```care-circle-page\n([\s\S]*?)\n```$/m)[1]);
  assert.equal(metadata.type, 'visit');
  assert.equal(metadata.id, source.id);
  assert.equal(Object.hasOwn(metadata, 'body'), false);
});
