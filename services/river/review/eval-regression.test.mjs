import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical, compare, parsePrediction, renderPrompt, score, sha256, validExtraction} from '../eval.mjs';

// Fabricated regression fixtures. These are not corpus rows or model measurements.
const gold = {
  extraction: {
    visit: {
      date: '2026-09-27',
      doctorId: 'doctors/cardiologist',
      attendeeIds: ['people/ana-alvarez'],
      summary: 'Synthetic review fixture: lisinopril increased to 20 mg daily.',
    },
    medicationChanges: [{medicationId: 'medications/lisinopril', name: 'lisinopril', dose: '20 mg', frequency: 'daily'}],
    questions: [],
    followUps: [],
  },
  warnings: [],
};
const row = {
  id: 'review-only-001',
  input: {note: gold.extraction.visit.summary, date: '2026-09-27', authorId: 'people/ana-alvarez'},
  gold,
};

function pairedFixture() {
  const template = 'Review-only fixed instructions.\n';
  const generation = {temperature: 0, max_tokens: 1000, num_samples: 1};
  const protocol = {
    baseModel: 'review-only-base',
    trainedCheckpoint: 'review-only-checkpoint',
    generation,
    testSha256: sha256('review-only-file'),
    promptSha256: sha256(template),
    evaluation: {seeds: [20260927]},
  };
  const prediction = {
    id: row.id,
    output: JSON.stringify(gold),
    inputSha256: sha256(canonical(row.input)),
    promptSha256: sha256(renderPrompt(template, row.input)),
    promptTokenIdsSha256: sha256(canonical([11, 22, 33])),
    generation: structuredClone(generation),
    generationSha256: sha256(canonical(generation)),
    seed: 20260927,
    model: protocol.baseModel,
  };
  return {
    template,
    protocol,
    base: {...structuredClone(prediction), arm: 'base', checkpoint: null},
    trained: {...structuredClone(prediction), arm: 'trained', checkpoint: protocol.trainedCheckpoint},
  };
}

test('absent predictions receive no validity or exactness credit', () => {
  const result = score([row], []);
  assert.equal(result.counts.predictions, 0);
  for (const rate of Object.values(result.rates)) assert.equal(rate, 0);
  assert.equal(result.failures[0].reason, 'missing_prediction');
});

test('transport-null output receives no JSON-valid credit', () => {
  const result = score([row], [{id: row.id, status: 503, output: null}]);
  assert.equal(result.counts.jsonValid, 0);
  assert.equal(result.counts.schemaValid, 0);
  assert.equal(result.counts.taskExact, 0);
});

test('literal null model text is JSON valid but schema invalid', () => {
  const result = parsePrediction({output: 'null'});
  assert.equal(result.jsonValid, true);
  assert.equal(result.schemaValid, false);
});

test('malformed JSON fails and exact synthetic output passes', () => {
  assert.equal(score([row], [{id: row.id, output: '{bad'}]).counts.jsonValid, 0);
  const exact = score([row], [{id: row.id, output: JSON.stringify(gold)}]);
  assert.equal(exact.counts.taskExact, 1);
  assert.equal(exact.counts.unsupportedMedicationClaims, 0);
});

test('wrong dose is an unsupported medication claim', () => {
  const wrong = structuredClone(gold);
  wrong.extraction.medicationChanges[0].dose = '10 mg';
  const result = score([row], [{id: row.id, output: JSON.stringify(wrong)}]);
  assert.equal(result.counts.taskExact, 0);
  assert.equal(result.counts.medicationExact, 0);
  assert.equal(result.counts.unsupportedMedicationClaims, 1);
});

test('warning mismatches appear in failures and extra response claims fail schema', () => {
  const warnings = structuredClone(gold);
  warnings.warnings = ['Review-only unsupported warning.'];
  const result = score([row], [{id: row.id, output: JSON.stringify(warnings)}]);
  assert.equal(result.counts.extractionExact, 1);
  assert.equal(result.counts.taskExact, 0);
  assert.equal(result.failures[0].reason, 'warnings_mismatch');
  assert.equal(parsePrediction({output: {...gold, clinicalAdvice: 'Unrequested fabricated advice.'}}).schemaValid, false);
});

test('invalid clinical domain IDs fail extraction validation', () => {
  for (const mutate of [
    extraction => { extraction.visit.doctorId = 'doctors/unknown'; },
    extraction => { extraction.visit.attendeeIds = ['not-a-person']; },
    extraction => { extraction.medicationChanges[0].medicationId = 'arbitrary/id'; },
    extraction => { extraction.questions = [{doctorId: 'doctors/unknown', text: 'Synthetic question.'}]; },
  ]) {
    const extraction = structuredClone(gold.extraction);
    mutate(extraction);
    assert.equal(validExtraction(extraction), false);
  }
});

test('impossible calendar dates fail visit and follow-up validation', () => {
  for (const date of ['2026-99-99', '2026-02-29', '2026-02-30', '2026-04-31']) {
    const visit = structuredClone(gold.extraction);
    visit.visit.date = date;
    assert.equal(validExtraction(visit), false, `visit accepted ${date}`);
    const followUp = structuredClone(gold.extraction);
    followUp.followUps = [{text: 'Synthetic scheduled follow-up.', dueDate: date}];
    assert.equal(validExtraction(followUp), false, `follow-up accepted ${date}`);
  }
  const leapDay = structuredClone(gold.extraction);
  leapDay.visit.date = '2024-02-29';
  assert.equal(validExtraction(leapDay), true);
});

test('paired comparison rejects different input or prompt provenance', () => {
  const {template, protocol, base, trained} = pairedFixture();
  assert.equal(compare([row], [base], [trained], protocol, template).paired, true);
  assert.throws(() => compare([row], [base], [{...trained, inputSha256: sha256('tampered-input')}], protocol, template));
  assert.throws(() => compare([row], [base], [{...trained, promptSha256: sha256('tampered-prompt')}], protocol, template));
  assert.throws(() => compare([row], [base], [], protocol, template));
});

test('paired comparison independently recomputes prompt hashes', () => {
  const {template, protocol, base, trained} = pairedFixture();
  const forgedHash = sha256('the same forged prompt in both arms');
  assert.throws(() => compare([row], [{...base, promptSha256: forgedHash}], [{...trained, promptSha256: forgedHash}], protocol, template));
  assert.throws(() => compare([row], [base], [trained], protocol, `${template}Changed instructions.`));
  assert.throws(() => compare([row], [base], [trained], protocol));
});

test('paired comparison rejects altered generation settings and hashes', () => {
  const {template, protocol, base, trained} = pairedFixture();
  const differentGeneration = {...trained.generation, temperature: 0.7};
  const changed = {...trained, generation: differentGeneration, generationSha256: sha256(canonical(differentGeneration))};
  assert.throws(() => compare([row], [base], [changed], protocol, template));
  assert.throws(() => compare([row], [{...base, generation: differentGeneration, generationSha256: changed.generationSha256}], [changed], protocol, template));
  assert.throws(() => compare([row], [base], [{...trained, generationSha256: sha256('forged-settings')}], protocol, template));
});

test('paired comparison preserves authoritative Python float-formatted digest', () => {
  const {template, protocol, base, trained} = pairedFixture();
  const authoritative = sha256('{"max_tokens":1000,"num_samples":1,"temperature":0.0}');
  assert.notEqual(authoritative, sha256(canonical(protocol.generation)));
  protocol.generationSha256 = authoritative;
  base.generationSha256 = authoritative;
  trained.generationSha256 = authoritative;
  assert.equal(compare([row], [base], [trained], protocol, template).paired, true);
  assert.throws(() => compare([row], [base], [{...trained, generationSha256: sha256(canonical(protocol.generation))}], protocol, template));
});

test('paired comparison rejects seed, token, model, arm, and checkpoint mismatches', () => {
  const {template, protocol, base, trained} = pairedFixture();
  for (const change of [
    {seed: trained.seed + 1},
    {seed: null},
    {promptTokenIdsSha256: sha256('different-tokens')},
    {model: 'review-only-other-base'},
    {arm: 'base'},
    {checkpoint: 'review-only-other-checkpoint'},
  ]) assert.throws(() => compare([row], [base], [{...trained, ...change}], protocol, template));
  assert.throws(() => compare([row], [{...base, checkpoint: protocol.trainedCheckpoint}], [trained], protocol, template));
});
