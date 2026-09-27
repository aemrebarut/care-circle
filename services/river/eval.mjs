import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const equal = (a, b) => canonical(a) === canonical(b);
export const readJsonl = async path => (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
export const renderPrompt = (template, input) => `${template.trimEnd()}\n\nINPUT_JSON:\n${canonical(input)}\n\nOUTPUT_JSON:\n`;

const keysAre = (value, required, optional = []) => value && typeof value === 'object' && !Array.isArray(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key));
const string = value => typeof value === 'string';
const strings = value => Array.isArray(value) && value.every(string);
const doctors = new Set(['doctors/cardiologist', 'doctors/nephrologist', 'doctors/primary-care', 'doctors/endocrinologist']);
const people = new Set(['people/ana-alvarez', 'people/ben-alvarez', 'people/celia-alvarez']);
const medications = new Set(['medications/lisinopril', 'medications/amlodipine', 'medications/atorvastatin', 'medications/metformin', 'medications/levothyroxine', 'medications/vitamin-d3', 'medications/acetaminophen']);
const date = value => string(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function validExtraction(e) {
  if (!keysAre(e, ['visit', 'medicationChanges', 'questions', 'followUps'])) return false;
  const v = e.visit;
  if (!keysAre(v, ['date', 'doctorId', 'attendeeIds', 'summary']) || !date(v.date) || v.date > '2026-09-27' || !doctors.has(v.doctorId) || !strings(v.attendeeIds) || !v.attendeeIds.every(id => people.has(id)) || !string(v.summary)) return false;
  if (!Array.isArray(e.medicationChanges) || !e.medicationChanges.every(m => keysAre(m, ['medicationId', 'name', 'dose', 'frequency']) && medications.has(m.medicationId) && ['medicationId', 'name', 'dose', 'frequency'].every(k => string(m[k]) && m[k].length > 0))) return false;
  if (!Array.isArray(e.questions) || !e.questions.every(q => keysAre(q, ['doctorId', 'text']) && doctors.has(q.doctorId) && string(q.text))) return false;
  return Array.isArray(e.followUps) && e.followUps.every(f => keysAre(f, ['text'], ['dueDate']) && string(f.text) && (f.dueDate === undefined || date(f.dueDate)));
}

export function parsePrediction(prediction) {
  if (!prediction || prediction.output === undefined || prediction.output === null) return {jsonValid: false, schemaValid: false, unavailable: true};
  try {
    const output = typeof prediction.output === 'string' ? JSON.parse(prediction.output) : prediction.output;
    if (!output || typeof output !== 'object') return {jsonValid: true, schemaValid: false};
    return {jsonValid: true, schemaValid: keysAre(output, ['extraction', 'warnings'], ['method']) && (output.method === undefined || ['deterministic', 'river'].includes(output.method)) && validExtraction(output.extraction) && strings(output.warnings), output};
  } catch { return {jsonValid: false, schemaValid: false}; }
}

export function score(records, predictions) {
  const ids = new Set(records.map(row => row.id));
  if (ids.size !== records.length) throw new Error('Duplicate evaluation record IDs.');
  const byId = new Map();
  for (const row of predictions) {
    if (!ids.has(row.id) || byId.has(row.id)) throw new Error('Prediction IDs must be unique and belong to the fixed evaluation split.');
    byId.set(row.id, row);
  }
  const totals = {examples: records.length, predictions: predictions.length, jsonValid: 0, schemaValid: 0, extractionExact: 0, structuredExact: 0, warningsExact: 0, taskExact: 0, medicationExact: 0, unsupportedMedicationClaims: 0, predictedMedicationClaims: 0};
  const failures = [];
  for (const row of records) {
    const prediction = byId.get(row.id);
    const parsed = parsePrediction(prediction || {});
    totals.jsonValid += Number(parsed.jsonValid);
    totals.schemaValid += Number(parsed.schemaValid);
    let exact = false, taskExact = false;
    if (parsed.schemaValid) {
      const got = parsed.output;
      const want = row.gold;
      exact = equal(got.extraction, want.extraction);
      const {summary: a, ...gotVisit} = got.extraction.visit;
      const {summary: b, ...goldVisit} = want.extraction.visit;
      totals.extractionExact += Number(exact);
      totals.structuredExact += Number(equal({...got.extraction, visit: gotVisit}, {...want.extraction, visit: goldVisit}));
      const warningExact = equal(got.warnings, want.warnings);
      taskExact = exact && warningExact;
      totals.warningsExact += Number(warningExact);
      totals.taskExact += Number(exact && warningExact);
      totals.medicationExact += Number(equal(got.extraction.medicationChanges, want.extraction.medicationChanges));
      totals.predictedMedicationClaims += got.extraction.medicationChanges.length;
      totals.unsupportedMedicationClaims += got.extraction.medicationChanges.filter(m => !want.extraction.medicationChanges.some(gold => equal(m, gold))).length;
    }
    if (!taskExact) failures.push({id: row.id, reason: !prediction ? 'missing_prediction' : parsed.unavailable ? 'unavailable_output' : !parsed.jsonValid ? 'invalid_json' : !parsed.schemaValid ? 'invalid_schema' : !exact ? 'extraction_mismatch' : 'warnings_mismatch'});
  }
  const rates = Object.fromEntries(['jsonValid', 'schemaValid', 'extractionExact', 'structuredExact', 'warningsExact', 'taskExact', 'medicationExact'].map(key => [key, records.length ? totals[key] / records.length : null]));
  return {counts: totals, rates, failures, limitations: ['Synthetic template-family holdout only; not clinical validation.', 'Exact comparison includes array order and literal source text.', 'Unsupported medication claims are measured against gold only among schema-valid predictions.', 'Missing and invalid predictions count as failures in all exactness denominators.']};
}

export function compare(records, base, trained, protocol, promptTemplate) {
  if (!protocol || !protocol.baseModel || !protocol.generation || !protocol.testSha256 || !protocol.promptSha256 || !protocol.trainedCheckpoint) throw new Error('Comparison requires model, decoding, split, prompt, and trained-checkpoint provenance.');
  if (base.length !== records.length || trained.length !== records.length) throw new Error('Both model runs must cover the complete fixed evaluation split.');
  if (typeof promptTemplate !== 'string' || sha256(promptTemplate) !== protocol.promptSha256) throw new Error('Prompt template hash differs from the run protocol.');
  const baseMap = new Map(base.map(row => [row.id, row]));
  const trainedMap = new Map(trained.map(row => [row.id, row]));
  for (const row of records) {
    const a = baseMap.get(row.id), b = trainedMap.get(row.id);
    const inputHash = sha256(canonical(row.input));
    const expectedPromptHash = sha256(renderPrompt(promptTemplate, row.input));
    if (!a || !b || a.inputSha256 !== inputHash || b.inputSha256 !== inputHash || !a.promptSha256 || a.promptSha256 !== b.promptSha256 || a.promptSha256 !== expectedPromptHash) throw new Error(`Prompt or input provenance mismatch for ${row.id}.`);
    if (a.arm !== 'base' || b.arm !== 'trained' || a.model !== protocol.baseModel || b.model !== protocol.baseModel || a.checkpoint !== null || b.checkpoint !== protocol.trainedCheckpoint) throw new Error(`Model or checkpoint provenance mismatch for ${row.id}.`);
    // The Python runner preserves integral floats in its canonical JSON.
    // Verify settings structurally and retain its authoritative byte digest.
    const generationHash = protocol.generationSha256 || sha256(canonical(protocol.generation));
    if (!equal(a.generation, protocol.generation) || !equal(b.generation, protocol.generation) || a.generationSha256 !== generationHash || b.generationSha256 !== generationHash || !Number.isInteger(a.seed) || a.seed !== b.seed) throw new Error(`Decoding provenance mismatch for ${row.id}.`);
    if (!a.promptTokenIdsSha256 || a.promptTokenIdsSha256 !== b.promptTokenIdsSha256) throw new Error(`Tokenized prompt provenance mismatch for ${row.id}.`);
    const expectedSeed = protocol.evaluation?.seeds?.[records.indexOf(row)];
    if (expectedSeed !== undefined && a.seed !== expectedSeed) throw new Error(`Seed provenance mismatch for ${row.id}.`);
  }
  return {paired: true, evaluatedAt: new Date().toISOString(), protocol, base: score(records, base), trained: score(records, trained)};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [testPath, basePath, trainedPath, protocolPath, outputPath] = process.argv.slice(2);
  if (!outputPath) throw new Error('Usage: node eval.mjs TEST.jsonl BASE.jsonl TRAINED.jsonl PROTOCOL.json OUTPUT.json');
  const [records, base, trained, protocolText, testText] = await Promise.all([readJsonl(testPath), readJsonl(basePath), readJsonl(trainedPath), readFile(protocolPath, 'utf8'), readFile(testPath)]);
  const protocol = JSON.parse(protocolText);
  if (sha256(testText) !== protocol.testSha256) throw new Error('Held-out test file hash differs from the run protocol.');
  const promptTemplate = await readFile(new URL('dataset/prompt.txt', import.meta.url), 'utf8');
  const result = compare(records, base, trained, protocol, promptTemplate);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({paired: true, count: records.length, base: result.base.rates, trained: result.trained.rates}));
}
