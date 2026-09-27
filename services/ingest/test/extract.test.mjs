import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_NOTE, IDS } from '../../../contract/index.mjs';
import { extractDeterministic, normalizeInput, defaultIdempotencyKey } from '../extract.mjs';

test('demo extraction preserves source, attribution and exact contract', () => {
  const result = extractDeterministic({ note: DEMO_NOTE, authorId: IDS.ben, date: '2026-09-27' });
  assert.equal(result.method, 'deterministic');
  assert.deepEqual(result.extraction, {
    visit: { date: '2026-09-27', doctorId: IDS.cardiologist, attendeeIds: [IDS.ana], summary: DEMO_NOTE },
    medicationChanges: [{ medicationId: IDS.lisinopril, name: 'lisinopril', dose: '20 mg', frequency: 'daily' }],
    questions: [{ doctorId: IDS.nephrologist, text: 'Ask the nephrologist about the potassium recheck.' }],
    followUps: [{ text: 'Wants potassium rechecked before nephrology Tuesday.' }],
  });
});

test('source-only visit has no invented changes or attendance', () => {
  const result = extractDeterministic({ note: 'Cardiology today. A source-only update.', authorId: IDS.ben });
  assert.deepEqual(result.extraction.visit.attendeeIds, []);
  assert.deepEqual(result.extraction.medicationChanges, []);
  assert.ok(result.warnings.some(value => value.includes('defaults')));
});

test('explicit visit date is recognized and source whitespace retained', () => {
  const note = '  Cardiology 2026-09-26 with Celia.\nLisinopril up to 20 mg daily.  ';
  const result = extractDeterministic({ note });
  assert.equal(result.extraction.visit.date, '2026-09-26');
  assert.equal(result.extraction.visit.summary, note);
  assert.deepEqual(result.extraction.visit.attendeeIds, [IDS.celia]);
});

for (const note of [
  '', 'Cardiology.', 'Cardiology with Ana.', 'What did the doctor say?', 'Dermatology today with Ana.',
  'Cardiology and nephrology today with Ana.', 'Cardiology tomorrow with Ana.',
  'Cardiology yesterday with Ana.', 'Cardiology 2026-02-30 with Ana.',
  'Cardiology today. Dr. Chen did not increase lisinopril to 20 mg daily.',
  'Cardiology today. Dr. Chen might increase lisinopril to 20 mg daily.',
  'Cardiology today. Dr. Chen plans to increase lisinopril to 20 mg daily.',
  'Cardiology today. Dr. Chen declined to increase lisinopril to 20 mg daily.',
  'Cardiology today. Dr. Chen proposed increasing lisinopril to 20 mg daily.',
  'Cardiology today. Dr. Chen increased lisinopril to 20 mg daily as needed.',
  'Cardiology today. Dr. Chen increased lisinopril to 20 mg daily for three days.',
  'Cardiology today. Dr. Chen increased lisinopril to 20 mg daily or every other day.',
  'Cardiology today. On 2026-09-01 Dr. Chen increased lisinopril to 20 mg daily.',
  'Cardiology today. Last week the nephrologist increased lisinopril to 20 mg daily.',
  'Cardiology appointment cancelled today with Ana.',
  'Cardiology referral requested today with Ana.',
  'Cardiology today. Wants potassium rechecked; if needed.',
  'Cardiology today. If needed:\nWants potassium rechecked.',
  'Cardiology today. Ask the nephrologist about potassium. Unless already resolved.',
  'Cardiology today. Ask Ana what the nephrologist said.',
  'Cardiology today. Ask the insurer to cover cardiology.',
  'Cardiology today. Lisinopril up to 20 mg daily; if potassium is normal.',
  'Cardiology today. If tolerated:\nLisinopril up to 20 mg daily.',
  'Cardiology today. Last week:\nDr. Chen increased lisinopril to 20 mg daily.',
  'Cardiology today. Dr. Chen increased lisinopril to 20 mg daily. Correction: that was not done.',
  'Cardiology today. Dr. Chen increased lisinopril to 20 mg daily. She still takes 10 mg daily.',
  'Nephrology today. The cardiologist increased lisinopril to 20 mg daily.',
  'Cardiology today. If potassium is normal, increase lisinopril to 20 mg daily.',
  'Cardiology today. Ask whether to increase lisinopril to 20 mg daily.',
  'Cardiology today. Lisinopril up to 20 mg.',
  'Cardiology today. Lisinopril up to 10 mg or 20 mg daily.',
  'Cardiology today. Lisinopril up to 0 mg daily.',
  'Cardiology today. Increased warfarin to 5 mg daily.',
  'Cardiology today. Lisinopril up to 20 mg daily. Lisinopril down to 10 mg daily.',
]) test(`rejects unsupported or ambiguous note: ${note}`, () => {
  assert.throws(() => extractDeterministic({ note }), error => [400, 422].includes(error.status));
});

test('invalid input and conflicting dates reject', () => {
  for (const input of [{ note: DEMO_NOTE, authorId: 'people/unknown' }, { note: DEMO_NOTE, date: '2026-02-30' }, { note: DEMO_NOTE, date: null }, { note: DEMO_NOTE, idempotencyKey: '' }]) assert.throws(() => normalizeInput(input, { commit: true }), { status: 400 });
  assert.throws(() => extractDeterministic({ note: 'Cardiology 2026-09-26.', date: '2026-09-27' }), { status: 422 });
});

test('default key is stable and bound to exact source and author', () => {
  const input = normalizeInput({ note: DEMO_NOTE }, { commit: true });
  const extraction = extractDeterministic(input).extraction;
  const key = defaultIdempotencyKey(input, extraction);
  assert.equal(key, defaultIdempotencyKey({ ...input }, structuredClone(extraction)));
  assert.notEqual(key, defaultIdempotencyKey({ ...input, authorId: IDS.ben }, extraction));
  assert.notEqual(key, defaultIdempotencyKey({ ...input, note: ` ${input.note}` }, extraction));
});


test('attendance stays within encounter and followups require request evidence', () => {
  for (const note of ['Cardiology today with Ana. Nephrology next Tuesday with Ben.', 'Cardiology today with Ana. I spoke with Celia afterward.']) {
    assert.deepEqual(extractDeterministic({ note }).extraction.visit.attendeeIds, [IDS.ana]);
  }
  for (const note of ['Cardiology today. Potassium rechecked on 2026-09-20.', 'Cardiology today. Potassium recheck already completed.', 'Cardiology today. Potassium rechecked after 2026-09-20.']) {
    assert.deepEqual(extractDeterministic({ note }).extraction.followUps, []);
  }
  assert.deepEqual(extractDeterministic({ note: 'Cardiology today with Ana and Ben.' }).extraction.visit.attendeeIds, [IDS.ana, IDS.ben]);
});


test('fixed as-of date rejects future visits but preserves future followups', () => {
  assert.throws(() => extractDeterministic({ note: DEMO_NOTE, date: '2026-10-01' }), { status: 422 });
  assert.throws(() => extractDeterministic({ note: 'Cardiology 2026-10-01 with Ana. Lisinopril up to 20 mg daily.' }), { status: 422 });
  const result = extractDeterministic({ note: 'Cardiology today with Ana. Wants potassium rechecked by 2026-10-01.' });
  assert.equal(result.extraction.visit.date, '2026-09-27');
  assert.equal(result.extraction.followUps[0].dueDate, '2026-10-01');
});
