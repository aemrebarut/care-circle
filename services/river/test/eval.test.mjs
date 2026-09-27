import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical, sha256, score, compare, renderPrompt, validExtraction} from '../eval.mjs';

const input = {note: 'Cardiology with Ana. No medication change.', authorId: 'people/ana-alvarez', date: '2026-09-27'};
const extraction = {visit: {date: input.date, doctorId: 'doctors/cardiologist', attendeeIds: [input.authorId], summary: input.note}, medicationChanges: [], questions: [], followUps: []};
const record = {id: 'unit-fixture', input, gold: {extraction, warnings: []}};
const template = 'Synthetic unit fixture';
const generation = {temperature: 0};
const prediction = {id: record.id, inputSha256: sha256(canonical(input)), promptSha256: sha256(renderPrompt(template, input)), output: JSON.stringify(record.gold), arm: 'base', model: 'unit-fixture', checkpoint: null, generation, generationSha256: sha256(canonical(generation)), seed: 1, promptTokenIdsSha256: 'fixture'};
const trained = {...prediction, arm: 'trained', checkpoint: 'unit-fixture'};
const protocol = {baseModel: 'unit-fixture', generation, testSha256: 'fixture', promptSha256: sha256(template), trainedCheckpoint: 'unit-fixture'};

test('scoring counts missing and invalid predictions in the denominator', () => {
  const report = score([record, {...record, id: 'missing'}], [{...prediction, output: '{invalid'}]);
  assert.equal(report.counts.examples, 2);
  assert.equal(report.counts.predictions, 1);
  assert.equal(report.rates.taskExact, 0);
  assert.deepEqual(report.failures.map(f => f.reason), ['invalid_json', 'missing_prediction']);
});

test('unsupported medication claims fail the exactness metric', () => {
  const output = structuredClone(record.gold);
  output.extraction.medicationChanges.push({medicationId: 'medications/lisinopril', name: 'Lisinopril', dose: '20 mg', frequency: 'daily'});
  const report = score([record], [{...prediction, output}]);
  assert.equal(report.counts.unsupportedMedicationClaims, 1);
  assert.equal(report.rates.medicationExact, 0);
  assert.equal(report.rates.schemaValid, 1);
});

test('paired scoring rejects changed inputs, changed prompts and partial runs', () => {
  assert.equal(compare([record], [prediction], [trained], protocol, template).paired, true);
  assert.throws(() => compare([record], [prediction], [], protocol, template), /complete/);
  assert.throws(() => compare([record], [prediction], [{...trained, promptSha256: 'changed'}], protocol, template), /provenance/);
  assert.throws(() => compare([record], [prediction], [{...trained, inputSha256: 'changed'}], protocol, template), /provenance/);
});

test('duplicate prediction IDs cannot inflate the measured denominator', () => {
  assert.throws(() => score([record], [prediction, prediction]), /unique/);
});

test('future visits fail schema while explicit future follow-up dates remain valid', () => {
  const futureVisit = structuredClone(extraction);
  futureVisit.visit.date = '2026-10-01';
  assert.equal(validExtraction(futureVisit), false);
  const futureFollowUp = structuredClone(extraction);
  futureFollowUp.followUps = [{text: 'Call the clinic on 2026-10-01.', dueDate: '2026-10-01'}];
  assert.equal(validExtraction(futureFollowUp), true);
});
