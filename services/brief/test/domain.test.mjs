import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContradictions, buildMedicationAnswer, buildPrevisit, citation, validDate } from '../domain.mjs';
import { fixture, attach, doctorId, medicationId } from './fixture.mjs';

test('matching seed sources are not a contradiction or unchanged medication change', () => {
  const state = fixture({ changed: false });
  assert.deepEqual(buildContradictions(state).contradictions, []);
  const brief = buildPrevisit(state, doctorId);
  assert.equal(brief.since, '2026-09-15');
  assert.equal(brief.medicationChanges.length, 0);
  assert.equal(brief.otherVisits.length, 1);
  assert.equal(brief.openQuestions.length, 1);
  assert.match(brief.openQuestions[0].text, /notebook/);
});

test('visit-only dose change is history, not contradiction', () => {
  const state = fixture({ pharmacy: false });
  assert.deepEqual(buildContradictions(state).contradictions, []);
  const brief = buildPrevisit(state, doctorId);
  assert.equal(brief.medicationChanges.length, 1);
  assert.equal(brief.medicationChanges[0].citations[0].pageId, 'visits/increased');
});

test('pharmacy discrepancy cites both source records and preserves current visit dose', () => {
  const state = fixture();
  const [conflict] = buildContradictions(state).contradictions;
  assert.equal(conflict.status, 'unresolved');
  assert.equal(conflict.temporalStatus, 'current-disagreement');
  assert.deepEqual(new Set(conflict.claims.map((claim) => claim.sourceId)), new Set(['pharmacy/fill', 'visits/increased']));
  const answer = buildMedicationAnswer(state);
  assert.equal(answer.medications[0].dose, '20 mg');
  assert.equal(answer.medications[0].label, 'Recorded dose');
  assert.match(answer.answer, /actual use/);
  assert.equal(answer.citations.length, 2);
});

test('later matching visit does not reconcile an earlier pharmacy discrepancy', () => {
  const state = fixture({ reverted: true });
  const [conflict] = buildContradictions(state).contradictions;
  assert.equal(conflict.temporalStatus, 'past-discrepancy-unreconciled');
  assert.match(conflict.description, /Latest records agree/);
  assert.deepEqual(new Set(conflict.claims.map((claim) => claim.sourceId)), new Set(['pharmacy/fill', 'visits/increased', 'visits/reverted']));
  assert.equal(buildMedicationAnswer(state).medications[0].dose, '10 mg');
  assert.match(buildPrevisit(state, doctorId).markdown, /Earlier discrepancy unreconciled/);
});

test('superseded visit before pharmacy date is not an arbitrary historical discrepancy', () => {
  const state = fixture({ changed: false });
  const old = state.pages.find((page) => page.id === medicationId).fields.claims[0];
  old.dose = '5 mg';
  state.pages.find((page) => page.id === old.sourceId).body = 'Lisinopril recorded as 5 mg daily.';
  assert.deepEqual(buildContradictions(state).contradictions, []);
});

test('same-date incompatible visit sources remain ambiguous', () => {
  const state = fixture({ pharmacy: false });
  attach(state, { id: 'visits/same-date', type: 'visit', title: 'Conflicting record', body: 'Lisinopril 30 mg daily.', fields: { date: '2026-09-25' } });
  state.pages.find((page) => page.id === medicationId).fields.claims.push({ dose: '30 mg', frequency: 'daily', sourceId: 'visits/same-date', date: '2026-09-25', kind: 'visit' });
  assert.equal(buildContradictions(state).contradictions.length, 1);
  assert.equal(buildMedicationAnswer(state).medications[0].dose, null);
});

test('frequency disagreements count; dose whitespace and case do not', () => {
  const state = fixture({ changed: false });
  const claims = state.pages.find((page) => page.id === medicationId).fields.claims;
  claims.at(-1).dose = '10MG';
  claims.at(-1).frequency = ' Daily ';
  assert.equal(buildContradictions(state).contradictions.length, 0);
  claims.at(-1).frequency = 'twice daily';
  assert.equal(buildContradictions(state).contradictions.length, 1);
});

test('a shared dose never selects a different medication quote', () => {
  const source = { id: 'pharmacy/multiple', type: 'pharmacy', title: 'Pharmacy', body: 'Metformin: 500 mg twice daily.\nAcetaminophen: 500 mg once daily as needed for pain.\n```care-circle-page\n{"dose":"500 mg"}\n```', fields: {} };
  assert.equal(citation(source, ['Acetaminophen', '500 mg', 'once daily as needed for pain']).quote, 'Acetaminophen: 500 mg once daily as needed for pain.');
});

test('graph traversal follows reverse edges and cycles, excluding disconnected changes', () => {
  const state = fixture();
  state.graph.edges.push({ source: state.patientId, target: doctorId, type: 'mentions' });
  state.pages.push({ id: 'visits/disconnected', type: 'visit', title: 'Disconnected', body: 'Unreachable claim.', fields: { date: '2026-09-26', doctorId: 'doctors/cardiologist', medicationChanges: [{ medicationId, dose: '99 mg' }] } });
  const brief = buildPrevisit(state, doctorId);
  assert.equal(brief.medicationChanges.length, 1);
  assert.ok(!brief.traversal.visitedPageIds.includes('visits/disconnected'));
  for (const source of brief.traversal.sources) {
    if (source.pageId !== doctorId) assert.ok(source.path.length > 0);
    for (const step of source.path) assert.ok(state.graph.edges.some((edge) => edge.source === step.source && edge.target === step.target && edge.type === step.type));
  }
});

test('every quote is actual source text and every citation resolves', () => {
  const state = fixture();
  const brief = buildPrevisit(state, doctorId);
  const allCitations = [...brief.citations, ...buildMedicationAnswer(state).medications.flatMap((med) => med.citations)];
  for (const item of allCitations) {
    const page = state.pages.find((candidate) => candidate.id === item.pageId);
    assert.ok(page, item.pageId);
    assert.ok(page.body.includes(item.quote), item.quote);
  }
  assert.match(brief.markdown, /Not medical advice/);
  assert.ok(!/[\u2013\u2014]/u.test(brief.markdown));
});

test('future claims do not become a present dose or contradiction', () => {
  const state = fixture({ changed: false });
  attach(state, { id: 'visits/future', type: 'visit', title: 'Future', body: 'Lisinopril 30 mg daily.', fields: { date: '2026-09-29', doctorId: 'doctors/cardiologist', medicationChanges: [{ medicationId, dose: '30 mg', frequency: 'daily' }] } });
  state.pages.find((page) => page.id === medicationId).fields.claims.push({ dose: '30 mg', frequency: 'daily', sourceId: 'visits/future', date: '2026-09-29', kind: 'visit' });
  assert.equal(buildMedicationAnswer(state).medications[0].dose, '10 mg');
  assert.equal(buildPrevisit(state, doctorId).medicationChanges.length, 0);
  assert.equal(buildContradictions(state).contradictions.length, 0);
});

test('unknown doctor and invalid baseline have explicit errors', () => {
  assert.throws(() => buildPrevisit(fixture(), 'doctors/missing'), { code: 'DOCTOR_NOT_FOUND', status: 404 });
  const state = fixture();
  state.pages.find((page) => page.id === doctorId).fields.lastVisitDate = '2026-02-30';
  assert.equal(validDate('2026-02-30'), false);
  assert.throws(() => buildPrevisit(state, doctorId), { code: 'INVALID_BASELINE', status: 422 });
});

test('shared providers never admit explicitly foreign patient records', () => {
  const state = fixture();
  attach(state, { id: 'medications/foreign', type: 'medication', title: 'Foreign record', body: 'Another patient record.', fields: { patientId: 'people/another-patient', status: 'active', dose: '80 mg', name: 'Foreign record' } });
  assert.ok(!buildMedicationAnswer(state).medications.some((med) => med.id === 'medications/foreign'));
  assert.ok(!buildPrevisit(state, doctorId).traversal.visitedPageIds.includes('medications/foreign'));
});

test('future-only claims cannot leak through the medication field fallback', () => {
  const state = fixture();
  const medication = state.pages.find((page) => page.id === medicationId);
  medication.fields.claims = [{ dose: '30 mg', frequency: 'daily', sourceId: 'visits/increased', date: '2026-09-28', kind: 'visit' }];
  medication.fields.dose = '30 mg';
  const result = buildMedicationAnswer(state).medications[0];
  assert.equal(result.dose, null);
  assert.match(result.uncertainty, /reference date/);
});

test('questions exclude future evidence and never give disconnected origins empty paths', () => {
  const state = fixture();
  state.pages.push({ id: 'visits/disconnected-origin', type: 'visit', title: 'Unlinked origin', body: 'Question origin.', fields: { date: '2026-09-20' } });
  state.pages.find((page) => page.id === 'questions/old-open').fields.sourceId = 'visits/disconnected-origin';
  attach(state, { id: 'questions/future', type: 'question', title: 'Future question', body: 'Future question.', fields: { date: '2026-09-28', doctorId, status: 'open', text: 'Future question.' } });
  const brief = buildPrevisit(state, doctorId);
  assert.equal(brief.openQuestions.length, 1);
  assert.equal(brief.openQuestions[0].citations.length, 1);
  assert.ok(!brief.traversal.sources.some((source) => source.pageId === 'visits/disconnected-origin'));
  assert.match(brief.warnings.join(' '), /graph-unreachable origin/);
});

test('newer matching pharmacy labels an older unresolved discrepancy as past', () => {
  const state = fixture();
  attach(state, { id: 'pharmacy/newer', type: 'pharmacy', title: 'Newer pharmacy', body: 'Lisinopril 20 mg daily.', fields: { date: '2026-09-26' } });
  state.pages.find((page) => page.id === medicationId).fields.claims.push({ dose: '20 mg', frequency: 'daily', sourceId: 'pharmacy/newer', date: '2026-09-26', kind: 'pharmacy' });
  const [conflict] = buildContradictions(state).contradictions;
  assert.equal(conflict.temporalStatus, 'past-discrepancy-unreconciled');
  assert.ok(conflict.claims.some((claim) => claim.sourceId === 'pharmacy/fill'));
  assert.ok(conflict.claims.some((claim) => claim.sourceId === 'visits/increased'));
});
