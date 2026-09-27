#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DEMO_NOTE, IDS, PORTS } from '../../contract/index.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback) => has(flag) ? args[args.indexOf(flag) + 1] : fallback;
const full = has('--full');
const healthOnly = has('--health-only');
const direct = has('--direct');
const cycles = Number(value('--cycles', '1'));
const waitSeconds = Number(value('--wait-seconds', '0'));
const allowed = new Set(['--full', '--read-only', '--health-only', '--direct', '--cycles', '--wait-seconds']);
for (let i = 0; i < args.length; i++) {
  assert(allowed.has(args[i]), `Unknown option: ${args[i]}`);
  if (['--cycles', '--wait-seconds'].includes(args[i])) i++;
}
assert([full, healthOnly, has('--read-only')].filter(Boolean).length <= 1, 'Choose one run mode');
assert(Number.isInteger(cycles) && cycles >= 1 && cycles <= 3, '--cycles must be 1, 2 or 3');
assert(Number.isFinite(waitSeconds) && waitSeconds >= 0 && waitSeconds <= 600, '--wait-seconds must be 0 through 600');

const startedAt = new Date().toISOString();
const runId = startedAt.replaceAll(':', '-');
const checks = [];
let stage = 'readiness';
let mutationOutcomeUncertain = false;
const sourceCache = new Map();

async function check(name, fn, prerequisite = true) {
  if (!prerequisite) {
    checks.push({ stage, name, status: 'skipped', reason: 'Prerequisite failed' });
    console.log(`SKIP ${stage}: ${name}`);
    return false;
  }
  const start = Date.now();
  try {
    const evidence = await fn();
    checks.push({ stage, name, status: 'passed', durationMs: Date.now() - start, ...(evidence ? { evidence } : {}) });
    console.log(`PASS ${stage}: ${name}`);
    return true;
  } catch (error) {
    checks.push({ stage, name, status: 'failed', durationMs: Date.now() - start, error: error.message });
    console.error(`FAIL ${stage}: ${name}: ${error.message}`);
    return false;
  }
}

async function request(service, path, { method = 'GET', body, raw = false, timeoutMs = 120000, transport = direct ? 'direct' : 'proxy' } = {}) {
  const mutating = method === 'POST' && ['/v1/ingest', '/v1/reset', '/v1/procedure/capture', '/v1/procedure/replay'].includes(path);
  if (mutating) assert(!mutationOutcomeUncertain, 'A prior write outcome is uncertain; stop and coordinate recovery with cc-runtime');
  const url = transport === 'direct' || path === '/health' || service === 'clinic'
    ? `http://127.0.0.1:${PORTS[service]}${path}`
    : `http://127.0.0.1:${PORTS.web}/api/${service}${path.replace(/^\/v1/, '')}`;
  let response;
  let text;
  try {
    response = await fetch(url, {
      method, redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
    });
    text = await response.text();
  } catch (error) {
    if (mutating) mutationOutcomeUncertain = true;
    throw error;
  }
  if (mutating && response.status >= 500) mutationOutcomeUncertain = true;
  let data;
  try { data = JSON.parse(text); }
  catch { if (mutating) mutationOutcomeUncertain = true; throw new Error(`${method} ${url} returned non-JSON (${response.status}): ${text.slice(0, 180)}`); }
  if (raw) return { status: response.status, data };
  assert(response.ok, `${method} ${url} returned ${response.status}: ${JSON.stringify(data).slice(0, 600)}`);
  return data;
}

const post = (service, path, body, options = {}) => request(service, path, { method: 'POST', body, ...options });
const nonempty = (s, label) => assert(typeof s === 'string' && s.trim(), `${label} must be nonempty text`);
const array = (a, label) => assert(Array.isArray(a), `${label} must be an array`);
const dose = (value) => compact(value).toLowerCase().replace(/(\d)\s*(mg|mcg|g|ml)\b/g, '$1 $2');
const regimen = (claim, expectedDose, frequency = 'daily') => {
  assert.equal(dose(claim?.dose), expectedDose);
  assert.equal(compact(claim?.frequency).toLowerCase(), frequency);
};
const medication = (data) => data.medications.find((m) => m.id === IDS.lisinopril);
const state = () => request('brain', '/v1/state');
const citationsIn = (items) => items.flatMap((item) => item.citations ?? []);
const compact = (value) => String(value).replace(/\s+/g, ' ').trim();
const contains = (text, fragment) => compact(text).toLowerCase().includes(compact(fragment).toLowerCase());
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value;
const fingerprint = (s) => JSON.stringify(stable({
  patientId: s.patientId,
  pages: s.pages.map(({ updatedAt, ...page }) => page).sort((a, b) => a.id.localeCompare(b.id)),
  graph: {
    nodes: [...s.graph.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...s.graph.edges].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }
}));
const unchanged = (before, after, label) => assert.deepEqual(stable(after), stable(before), `${label}: state, revision and timestamps must remain unchanged`);

async function page(id) {
  if (!sourceCache.has(id)) {
    const result = await request('brain', `/v1/pages/${encodeURIComponent(id)}`);
    assert.equal(result.page?.id, id, `Page lookup must preserve encoded slug ${id}`);
    sourceCache.set(id, result.page);
  }
  return sourceCache.get(id);
}

async function validateCitations(citations, label, required = true) {
  array(citations, `${label} citations`);
  if (required) assert(citations.length, `${label} must cite a source`);
  for (const citation of citations) {
    nonempty(citation.pageId, `${label} pageId`);
    nonempty(citation.title, `${label} citation title`);
    nonempty(citation.quote, `${label} citation quote`);
    const source = await page(citation.pageId);
    assert.equal(citation.title, source.title, `${label} title must identify its source page`);
    assert(compact(source.body).includes(compact(citation.quote)), `${label} quote must be a literal source excerpt`);
    if (citation.date !== undefined && source.fields.date !== undefined) assert.equal(citation.date, source.fields.date, `${label} citation date must match source`);
    if (citation.attendeeIds) {
      array(citation.attendeeIds, `${label} attendeeIds`);
      for (const id of citation.attendeeIds) {
        await page(id);
        assert(source.fields.attendeeIds?.includes(id), `${label} citation attendee must be recorded in source`);
      }
    }
  }
}

async function validateState(s) {
  assert.equal(s.patientId, IDS.patient);
  assert(s.revision !== undefined, 'State must expose revision');
  array(s.pages, 'pages');
  const ids = new Set(s.pages.map((p) => p.id));
  assert.equal(ids.size, s.pages.length, 'Page IDs must be unique');
  for (const p of s.pages) {
    nonempty(p.id, 'page id'); nonempty(p.title, `${p.id} title`); nonempty(p.type, `${p.id} type`);
    nonempty(p.body, `${p.id} body`); nonempty(p.updatedAt, `${p.id} updatedAt`);
    assert(p.fields && typeof p.fields === 'object', `${p.id} needs fields`);
    array(p.links, `${p.id} links`);
    for (const link of p.links) assert(ids.has(link.target), `${p.id} links to missing ${link.target}`);
  }
  array(s.graph.nodes, 'graph nodes'); array(s.graph.edges, 'graph edges');
  const nodes = new Set(s.graph.nodes.map((node) => node.id));
  assert.equal(nodes.size, s.graph.nodes.length, 'Graph node IDs must be unique');
  for (const id of nodes) assert(ids.has(id), `Graph node ${id} must resolve`);
  for (const edge of s.graph.edges) {
    assert(nodes.has(edge.source), `Missing graph source ${edge.source}`);
    assert(nodes.has(edge.target), `Missing graph target ${edge.target}`);
    nonempty(edge.type, 'graph edge type');
  }
  const graph = await request('brain', '/v1/graph');
  const graphRecords = (g) => ({
    nodes: [...g.nodes].map(stable).sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...g.edges].map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  });
  assert.deepEqual(graphRecords(graph), graphRecords(s.graph), 'Graph endpoint must agree with current state');
  return { pages: s.pages.length, nodes: nodes.size, edges: s.graph.edges.length, revision: s.revision };
}

async function validateMedications() {
  const meds = await request('brain', '/v1/medications');
  array(meds.medications, 'medications');
  assert.equal(meds.medications.length, 7, 'Synthetic baseline must contain seven medications');
  for (const med of meds.medications) {
    nonempty(med.name, 'medication name'); nonempty(med.dose, `${med.id} dose`);
    nonempty(med.frequency, `${med.id} frequency`); nonempty(med.status, `${med.id} status`);
    array(med.claims, `${med.id} claims`);
    await validateCitations(med.citations, med.id);
    assert(med.citations.some((c) => contains(c.quote, med.name) && contains(c.quote, med.dose) && contains(c.quote, med.frequency)), `${med.id} needs source text for its named recorded regimen`);
    await page(med.id);
    for (const claim of med.claims) {
      nonempty(claim.sourceId, `${med.id} claim source`);
      await page(claim.sourceId);
    }
  }
  const answer = await request('brief', '/v1/answer/medications');
  nonempty(answer.question, 'answer question'); nonempty(answer.answer, 'medication answer');
  array(answer.medications, 'answer medications');
  assert.deepEqual(answer.medications.map((m) => m.id).sort(), meds.medications.map((m) => m.id).sort());
  await validateCitations(answer.citations, 'medication answer');
  for (const med of answer.medications) await validateCitations(med.citations, `answer ${med.id}`);
  return meds;
}

async function validateContradictions(expectedVisitId) {
  const data = await request('brief', '/v1/contradictions');
  array(data.contradictions, 'contradictions');
  for (const conflict of data.contradictions) {
    assert.equal(conflict.status, 'unresolved');
    nonempty(conflict.id, 'contradiction id'); nonempty(conflict.title, 'contradiction title');
    nonempty(conflict.description, 'contradiction description');
    array(conflict.claims, 'contradiction claims');
    assert(conflict.claims.length >= 2, 'A contradiction needs two source claims');
    for (const claim of conflict.claims) {
      assert.equal(claim.citation?.pageId, claim.sourceId, 'Contradiction citation must identify its claim source');
      await validateCitations([claim.citation], `contradiction ${conflict.id}`);
    }
  }
  if (expectedVisitId) {
    const conflict = data.contradictions.find((c) => c.medicationId === IDS.lisinopril);
    assert(conflict, 'Demo must expose unresolved lisinopril conflict');
    assert(conflict.claims.some((c) => dose(c.dose) === '20 mg' && c.sourceId === expectedVisitId), 'Conflict must cite demo 20 mg visit');
    const pharmacyClaims = await Promise.all(conflict.claims.filter((c) => dose(c.dose) === '10 mg').map(async (c) => ({ claim: c, source: await page(c.sourceId) })));
    assert(pharmacyClaims.some(({ source }) => source.type === 'pharmacy'), 'Conflict must preserve 10 mg pharmacy source, not only a historical visit');
  }
  return data;
}

async function validateBrief(s, expectedVisitId) {
  const brief = await post('brief', '/v1/previsit', { doctorId: IDS.nephrologist });
  assert.equal(brief.doctorId, IDS.nephrologist);
  assert.equal(brief.since, '2026-09-15');
  nonempty(brief.title, 'brief title'); nonempty(brief.generatedAt, 'brief generatedAt'); nonempty(brief.markdown, 'brief markdown');
  for (const section of ['medicationChanges', 'otherVisits', 'openQuestions']) {
    array(brief[section], `brief ${section}`);
    for (const item of brief[section]) {
      nonempty(item.text, `${section} text`);
      await validateCitations(item.citations, `${section}: ${item.text}`);
    }
  }
  const expectedVisits = s.pages.filter((p) => p.type === 'visit' && p.fields.date > brief.since && p.fields.date <= '2026-09-27' && p.fields.doctorId !== IDS.nephrologist);
  const changedVisits = s.pages.filter((p) => p.type === 'visit' && p.fields.date > brief.since && p.fields.date <= '2026-09-27');
  const expectedChanges = changedVisits.flatMap((visit) => (visit.fields.medicationChanges ?? []).map((change) => ({ visit, change })));
  assert.equal(brief.medicationChanges.length, expectedChanges.length, 'Brief must include actual changes only, excluding unchanged visit claims');
  for (const { visit, change } of expectedChanges) {
    const name = s.pages.find((p) => p.id === change.medicationId)?.fields.name ?? change.name;
    assert(brief.medicationChanges.some((item) => contains(item.text, name) && contains(item.text, change.dose) && item.citations.some((c) => c.pageId === visit.id)), `Missing actual medication change ${visit.id}/${change.medicationId}`);
  }
  const expectedQuestions = s.pages.filter((p) => p.type === 'question' && p.fields.doctorId === IDS.nephrologist && p.fields.status === 'open');
  assert.equal(brief.openQuestions.length, expectedQuestions.length, 'Brief must include all open nephrology questions');
  for (const question of expectedQuestions) assert(brief.openQuestions.some((item) => contains(item.text, question.fields.text) && item.citations.some((c) => c.pageId === question.id)), `Missing question ${question.id}`);
  const visitCitations = citationsIn(brief.otherVisits);
  for (const visit of expectedVisits) assert(visitCitations.some((c) => c.pageId === visit.id), `Missing visit since nephrology: ${visit.id}`);
  for (const citation of visitCitations) {
    const source = await page(citation.pageId);
    if (source.type === 'visit') {
      assert(source.fields.date > brief.since, `Brief includes visit on/before cutoff: ${source.id}`);
      assert.notEqual(source.fields.doctorId, IDS.nephrologist, 'otherVisits must exclude nephrology');
    }
  }
  if (expectedVisitId) {
    assert(citationsIn(brief.medicationChanges).some((c) => c.pageId === expectedVisitId), 'Brief must cite demo medication change');
    assert(brief.openQuestions.some((item) => /potassium/i.test(item.text)), 'Brief must include potassium question');
    assert(brief.contradictions.some((c) => c.medicationId === IDS.lisinopril && c.status === 'unresolved'), 'Brief must preserve unresolved lisinopril conflict');
  }
  for (const conflict of brief.contradictions ?? []) for (const claim of conflict.claims ?? []) await validateCitations([claim.citation], 'brief conflict');
  return { since: brief.since, otherVisits: brief.otherVisits.length, medicationChanges: brief.medicationChanges.length, openQuestions: brief.openQuestions.length };
}

async function statusChecks() {
  await check('River mode and metric provenance are explicit', async () => {
    const data = await request('river', '/v1/status');
    assert(['deterministic', 'river'].includes(data.mode), 'River mode must be deterministic or river');
    assert(data.trainingStatus !== undefined && data.trainingStatus !== null, 'River trainingStatus missing');
    assert.equal(data.externalSubmissionAuthorized, true);
    assert(Array.isArray(data.limitations) && data.limitations.length && data.limitations.every((item) => typeof item === 'string' && item), 'River limitations missing');
    assert.equal(data.corpus?.synthetic, true);
    const familySets = [];
    let count = 0;
    for (const split of ['train', 'dev', 'test']) {
      const manifest = data.corpus.splits[split];
      assert(Number.isSafeInteger(manifest.count) && manifest.count > 0, `${split} example count must be positive`);
      assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
      array(manifest.templateFamilies, `${split} template families`);
      familySets.push(new Set(manifest.templateFamilies)); count += manifest.count;
    }
    assert.equal(count, data.corpus.total);
    assert.equal(familySets.reduce((sum, set) => sum + set.size, 0), new Set(familySets.flatMap((set) => [...set])).size, 'Template families must be disjoint across splits');
    for (const key of ['familyOverlap', 'caseOverlap', 'entityGroupOverlap']) assert.equal(data.corpus.validation[key], 0, `Corpus ${key} must be zero`);
    if (data.extractionAvailable === false) {
      assert.equal(data.mode, 'deterministic');
      const extraction = await post('river', '/v1/extract', { note: DEMO_NOTE }, { raw: true });
      assert.equal(extraction.status, 503, 'Unavailable River extractor must report failure honestly');
      nonempty(extraction.data.error?.code, 'River unavailable error code');
    }
    const validateScore = (score, label) => {
      const counts = score?.counts;
      assert.equal(counts?.examples, data.corpus.splits.test.count, `${label} must cover held-out count`);
      assert.equal(counts.predictions, counts.examples, `${label} must record one result per held-out example`);
      for (const key of ['jsonValid', 'schemaValid', 'extractionExact', 'structuredExact', 'warningsExact', 'taskExact', 'medicationExact']) {
        assert(Number.isSafeInteger(counts[key]) && counts[key] >= 0 && counts[key] <= counts.examples, `${label}/${key} invalid count`);
        assert.equal(score.rates?.[key], counts[key] / counts.examples, `${label}/${key} denominator mismatch`);
      }
      assert(counts.schemaValid <= counts.jsonValid, 'Schema validity cannot exceed JSON validity');
      assert(counts.taskExact <= counts.extractionExact && counts.extractionExact <= counts.structuredExact, 'Exactness metrics must be nested');
      assert(counts.unsupportedMedicationClaims <= counts.predictedMedicationClaims, 'Unsupported claim count exceeds predictions');
      assert.equal(score.failures.length, counts.examples - counts.taskExact, 'Failure count must cover every failed example');
    };
    if (data.localBaseline !== null && data.localBaseline !== undefined) {
      assert.equal(data.localBaseline.kind, 'local-deterministic');
      assert.equal(data.localBaseline.testSha256, data.corpus.splits.test.sha256);
      validateScore(data.localBaseline, 'Local deterministic baseline');
    }
    if (data.metrics !== null && data.metrics !== undefined) {
      const metrics = data.metrics;
      assert.equal(metrics.paired, true, 'Model comparison must be paired');
      nonempty(metrics.evaluatedAt, 'evaluation date');
      for (const key of ['baseModel', 'testSha256', 'promptSha256', 'trainedCheckpoint']) nonempty(metrics.protocol?.[key], `metric protocol ${key}`);
      assert(metrics.protocol.generation, 'Model comparison needs common decoding settings');
      assert.equal(metrics.protocol.testSha256, data.corpus?.splits?.test?.sha256, 'Comparison must use frozen held-out test');
      assert.equal(metrics.protocol.promptSha256, data.corpus?.promptSha256, 'Comparison must use frozen prompt');
      for (const model of ['base', 'trained']) {
        validateScore(metrics[model], model);
      }
    }
    return { mode: data.mode, trainingStatus: data.trainingStatus, metrics: data.metrics ?? null, limitations: data.limitations };
  });
  await check('Sponsors disclose modes and limitations', async () => {
    const data = await request('sponsors', '/v1/status');
    for (const sponsor of ['memorable', 'ufo']) {
      nonempty(data[sponsor]?.mode, `${sponsor} mode`);
      nonempty(data[sponsor]?.status, `${sponsor} status`);
      assert(data[sponsor].limitations !== undefined, `${sponsor} limitations missing`);
      assert(!/^(live|official|production|connected|memorable|ufo)$/i.test(data[sponsor].mode), `${sponsor} remote execution has not been authorized`);
    }
    return data;
  });
}

async function reset() {
  assert(!mutationOutcomeUncertain, 'A prior write outcome is uncertain; do not retry reset without runtime recovery');
  let stdout;
  try { ({ stdout } = await exec(resolve(root, 'scripts/demo-reset'), [], { cwd: root, timeout: 300000, maxBuffer: 1024 * 1024 })); }
  catch (error) { mutationOutcomeUncertain = true; throw error; }
  sourceCache.clear();
  assert(stdout.length < 1024 * 1024, 'Reset output unexpectedly large');
}

async function readOnly() {
  let current;
  const ready = await check('State and graph satisfy contract', async () => { current = await state(); return validateState(current); });
  await check('Medication and answer citations resolve', validateMedications, ready);
  await check('Contradiction citations resolve', () => validateContradictions(), ready);
  await check('Nephrology brief uses correct date window and source visits', () => validateBrief(current), ready);
  await statusChecks();
}

async function fullCycle(cycle) {
  stage = `cycle ${cycle}`;
  let baseline;
  let latestTemporalVisit;
  const resetReady = await check('Runtime startup and first reset', async () => { await reset(); baseline = await state(); return validateState(baseline); });
  if (resetReady) await health();
  await check('Later agreeing visit cannot erase an earlier pharmacy discrepancy', async () => {
    const addVisit = async (date, recordedDose) => {
      const note = `Synthetic cardiology visit with Ana on ${date}. Dr. Chen recorded lisinopril ${recordedDose} daily.`;
      const response = await post('brain', '/v1/ingest', {
        note, authorId: IDS.ana, idempotencyKey: `qa-history-${runId}-${cycle}-${date}`,
        extraction: {
          visit: { date, doctorId: IDS.cardiologist, attendeeIds: [IDS.ana], summary: note },
          medicationChanges: [{ medicationId: IDS.lisinopril, name: 'Lisinopril', dose: recordedDose, frequency: 'daily' }],
          questions: [], followUps: []
        }
      });
      assert.equal(response.ok, true); sourceCache.clear(); return response.visitId;
    };
    const changedVisit = await addVisit('2026-09-25', '20 mg');
    await validateContradictions(changedVisit);
    latestTemporalVisit = await addVisit('2026-09-27', '10 mg');
    regimen(medication(await request('brain', '/v1/medications')), '10 mg');
    const result = await validateContradictions(changedVisit);
    const conflict = result.contradictions.find((c) => c.medicationId === IDS.lisinopril);
    if (conflict.temporalStatus !== undefined) assert.equal(conflict.temporalStatus, 'past-discrepancy-unreconciled');
    return { preservedVisitId: changedVisit, recordedDose: '10 mg', conflictStatus: conflict.status };
  }, resetReady);
  await check('Doctor latest-visit field, displayed body and source agree', async () => {
    sourceCache.clear();
    const doctor = await page(IDS.cardiologist);
    assert.equal(doctor.fields.lastVisitDate, '2026-09-27');
    assert(doctor.body.includes('2026-09-27'), 'Doctor body must display its updated last visit date');
    assert(doctor.body.includes(latestTemporalVisit) || doctor.body.includes(encodeURIComponent(latestTemporalVisit)), 'Doctor displayed body must cite the visit that updated its last visit date');
  }, Boolean(latestTemporalVisit));
  await check('Current visit accepts a future follow-up due date', async () => {
    const note = 'Cardiology today with Ana. Wants potassium rechecked by 2026-10-01.';
    const result = await post('ingest', '/v1/ingest', { note, authorId: IDS.ana, date: '2026-09-27', idempotencyKey: `qa-followup-${runId}-${cycle}` });
    assert.equal(result.applied?.ok, true);
    assert.equal(result.extraction.visit.date, '2026-09-27');
    assert(result.extraction.followUps.some((item) => item.dueDate === '2026-10-01'));
    sourceCache.clear();
    const visit = await page(result.applied.visitId);
    assert(visit.fields.followUps.some((item) => item.dueDate === '2026-10-01'), 'Future follow-up must persist as a request');
    assert.equal(visit.fields.medicationChanges.length, 0, 'Follow-up request must not become a medication change');
  }, resetReady);
  let second;
  const resetAgain = await check('Second reset preserves baseline', async () => {
    await reset(); second = await state();
    assert.deepEqual(second.pages.map((p) => p.id).sort(), baseline.pages.map((p) => p.id).sort(), 'Reset must restore the same page IDs');
    assert.equal(fingerprint(second), fingerprint(baseline), 'Reset must restore source content, claims, links and graph');
    const meds = await validateMedications();
    regimen(medication(meds), '10 mg');
    const conflicts = await validateContradictions();
    assert.equal(conflicts.contradictions.length, 0, 'Seed has no unresolved pharmacy discrepancies; older amlodipine dose is history');
    await validateBrief(second);
    return { pages: second.pages.length, revision: second.revision };
  }, resetReady);
  await check('Demo extraction is supported and nonmutating', async () => {
    const before = await state();
    const result = await post('ingest', '/v1/extract', { note: DEMO_NOTE, authorId: IDS.ana });
    assert(['river', 'deterministic'].includes(result.method));
    array(result.warnings, 'extraction warnings');
    assert.equal(result.extraction?.visit?.doctorId, IDS.cardiologist);
    assert.equal(result.extraction.visit.date, '2026-09-27');
    assert.deepEqual(result.extraction.visit.attendeeIds, [IDS.ana]);
    assert.equal(result.extraction.medicationChanges.length, 1);
    const change = result.extraction.medicationChanges[0];
    assert.equal(change.medicationId, IDS.lisinopril); assert.equal(change.name.toLowerCase(), 'lisinopril'); regimen(change, '20 mg');
    unchanged(before, await state(), 'Extraction');
    return { method: result.method, warnings: result.warnings };
  }, resetAgain);
  await check('Uploader is not invented as a visit attendee', async () => {
    const before = await state();
    const result = await post('ingest', '/v1/extract', { note: DEMO_NOTE, authorId: IDS.ben });
    assert.deepEqual(result.extraction.visit.attendeeIds, [IDS.ana]);
    regimen(result.extraction.medicationChanges[0], '20 mg');
    unchanged(before, await state(), 'Extraction by different uploader');
  }, resetAgain);
  await check('Future visit dates cannot change records beyond demo as-of date', async () => {
    const before = await state();
    for (const route of ['/v1/extract', '/v1/ingest']) {
      const result = await post('ingest', route, { note: DEMO_NOTE, date: '2026-10-01', authorId: IDS.ana }, { raw: true });
      assert.equal(result.status, 422, `${route} must reject future visit date`);
      nonempty(result.data.error?.code, 'future-date error code');
    }
    const result = await post('brain', '/v1/ingest', {
      note: DEMO_NOTE, authorId: IDS.ana, idempotencyKey: `qa-future-${runId}-${cycle}`,
      extraction: { visit: { date: '2026-10-01', doctorId: IDS.cardiologist, attendeeIds: [IDS.ana], summary: DEMO_NOTE }, medicationChanges: [{ medicationId: IDS.lisinopril, name: 'Lisinopril', dose: '20 mg', frequency: 'daily' }], questions: [], followUps: [] }
    }, { raw: true });
    assert.equal(result.status, 422, 'Brain must reject future visit date');
    unchanged(before, await state(), 'Future visit rejection');
  }, resetAgain);
  for (const frequency of ['daily as needed', 'daily for three days', 'daily or every other day']) {
    await check(`Frequency qualifier is preserved or rejected: ${frequency}`, async () => {
      const before = await state();
      const result = await post('ingest', '/v1/extract', { note: `Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg ${frequency}.` }, { raw: true });
      if (result.status >= 400) assert([400, 422].includes(result.status), '5xx cannot satisfy safe rejection');
      else {
        const change = result.data.extraction?.medicationChanges?.find((m) => m.medicationId === IDS.lisinopril);
        if (change) assert.equal(compact(change.frequency).toLowerCase(), frequency, 'A qualified frequency must not truncate to daily');
        else assert(result.data.warnings?.length, 'Omitted qualified regimen needs a warning');
      }
      unchanged(before, await state(), 'Qualified frequency extraction');
    }, resetAgain);
  }
  await check('Historical medication sentence is not relabeled as today', async () => {
    const before = await state();
    const result = await post('ingest', '/v1/extract', { note: 'Cardiology today with Ana. On 2026-09-01 Dr. Chen increased lisinopril to 20 mg daily.' }, { raw: true });
    if (result.status >= 400) assert([400, 422].includes(result.status), '5xx cannot satisfy safe rejection');
    else {
      const changes = result.data.extraction?.medicationChanges ?? [];
      assert(!changes.length || result.data.extraction.visit.date === '2026-09-01', 'September 1 claim was relabeled as September 27');
      assert(result.data.warnings?.length, 'Mixed event dates require explicit limitations');
    }
    unchanged(before, await state(), 'Historical extraction');
  }, resetAgain);
  for (const [name, note] of [
    ['unsupported', 'The picnic is at the park. Bring the blue blanket.'],
    ['negated', 'Cardiology today with Ana. Dr. Chen did not increase lisinopril to 20 mg daily.'],
    ['uncertain', 'Cardiology today with Ana. Maybe Dr. Chen increased lisinopril to 20 mg daily, but Ana is not sure and needs to confirm.']
  ]) {
    await check(`${name} note cannot produce confirmed 20 mg`, async () => {
      const before = await state();
      const result = await post('ingest', '/v1/extract', { note, authorId: IDS.ana }, { raw: true });
      if (result.status >= 400) { assert([400, 422].includes(result.status), 'Server/transport failure is not safe note rejection'); nonempty(result.data.error?.code, 'error code'); nonempty(result.data.error?.message, 'error message'); }
      else {
        assert(Array.isArray(result.data.warnings) && result.data.warnings.length, `${name} input must explain limitations`);
        const changes = result.data.extraction?.medicationChanges ?? [];
        assert(!changes.some((m) => m.medicationId === IDS.lisinopril && dose(m.dose) === '20 mg'), `${name} input fabricated confirmed 20 mg change`);
      }
      unchanged(before, await state(), 'Extraction');
    }, resetAgain);
  }
  await check('Unsupported ingest cannot create clinical records', async () => {
    const before = await state();
    const result = await post('ingest', '/v1/ingest', { note: 'The picnic is at the park. Bring the blue blanket.', authorId: IDS.ana, idempotencyKey: `qa-unsupported-${runId}-${cycle}` }, { raw: true });
    assert([400, 422].includes(result.status) || (result.status >= 200 && result.status < 300 && result.data.warnings?.length && !result.data.applied?.ok), 'Unsupported ingest must reject or warn without applying; 5xx is not acceptance');
    unchanged(before, await state(), 'Unsupported ingest');
  }, resetAgain);
  const payload = { note: DEMO_NOTE, authorId: IDS.ana, idempotencyKey: `qa-demo-${runId}-${cycle}` };
  let applied;
  let after;
  const ingested = await check('Ingest demo records 20 mg and retains 10 mg pharmacy source', async () => {
    const [result, concurrent] = await Promise.all([post('ingest', '/v1/ingest', payload), post('ingest', '/v1/ingest', payload)]);
    assert.equal(result.applied?.ok, true); applied = result.applied;
    assert.equal(concurrent.applied?.ok, true);
    assert.equal(concurrent.applied?.visitId, applied.visitId, 'Concurrent first writes must share one visit');
    nonempty(applied.visitId, 'applied visitId'); array(applied.changedPageIds, 'changedPageIds');
    assert(applied.changedPageIds.includes(IDS.lisinopril));
    sourceCache.clear();
    after = await state();
    assert.equal(after.pages.filter((p) => p.type === 'visit').length, second.pages.filter((p) => p.type === 'visit').length + 1, 'Concurrent first writes must create exactly one visit');
    const meds = await validateMedications();
    const lisinopril = medication(meds);
    regimen(lisinopril, '20 mg');
    assert(lisinopril.claims.some((c) => dose(c.dose) === '20 mg' && c.sourceId === applied.visitId));
    assert.equal(lisinopril.claims.length, second.pages.find((p) => p.id === IDS.lisinopril).fields.claims.length + 1, 'First-write race must add exactly one medication claim');
    const tens = await Promise.all(lisinopril.claims.filter((c) => dose(c.dose) === '10 mg').map((c) => page(c.sourceId)));
    assert(tens.some((p) => p.type === 'pharmacy'), 'Original pharmacy claim must survive ingest');
    const visit = await page(applied.visitId);
    assert.equal(visit.fields.doctorId, IDS.cardiologist);
    assert.equal(visit.fields.date, '2026-09-27');
    assert(visit.fields.attendeeIds.includes(IDS.ana));
    return { method: result.method, visitId: applied.visitId, changedPageIds: applied.changedPageIds };
  }, resetAgain);
  await check('Duplicate and concurrent same-key requests are idempotent', async () => {
    const before = await state();
    for (const result of await Promise.all([post('ingest', '/v1/ingest', payload), post('ingest', '/v1/ingest', payload)])) {
      assert.equal(result.applied?.visitId, applied.visitId);
      assert.equal(result.applied?.ok, true);
    }
    unchanged(before, await state(), 'Duplicate ingestion');
    await validateContradictions(applied.visitId);
  }, ingested);
  await check('Reused key with different note never partially applies', async () => {
    const before = await state();
    const result = await post('ingest', '/v1/ingest', { ...payload, note: 'Cardiology today with Ana. Dr. Chen increased lisinopril to 30 mg daily.' }, { raw: true });
    if (result.status < 400) assert.equal(result.data.applied?.visitId, applied.visitId, 'Key reuse must return original result or reject');
    else { assert([400, 409, 422].includes(result.status), 'Server failure is not idempotency acceptance'); nonempty(result.data.error?.code, 'key conflict error'); }
    unchanged(before, await state(), 'Conflicting key reuse');
  }, ingested);
  await check('10 vs 20 mg discrepancy cites visit and pharmacy', () => validateContradictions(applied.visitId), ingested);
  await check('Previsit includes all later visits, demo change, potassium and discrepancy', async () => validateBrief(await state(), applied.visitId), ingested);
  await check('Capture and distinct sibling replay are explicitly local', async () => {
    const captured = await post('sponsors', '/v1/procedure/capture', { actorId: IDS.ana });
    nonempty(captured.procedureId, 'procedureId'); array(captured.steps, 'captured steps'); assert(captured.steps.length);
    nonempty(captured.mode, 'capture mode'); assert(captured.evidence, 'Capture needs evidence');
    const replay = await post('sponsors', '/v1/procedure/replay', { procedureId: captured.procedureId, actorId: IDS.ben });
    assert.equal(replay.procedureId, captured.procedureId); assert.equal(replay.actorId, IDS.ben);
    array(replay.steps, 'replay steps'); assert(replay.steps.length);
    nonempty(replay.mode, 'replay mode'); assert(replay.evidence, 'Replay needs evidence'); assert(replay.result, 'Replay needs result');
    assert.equal(captured.mode, 'local-simulation');
    assert.equal(replay.mode, 'local-simulation');
    assert.equal(replay.evidence.captureTraceId, captured.evidence.traceId);
    assert.equal(replay.evidence.planSha256, captured.evidence.planSha256);
    assert.equal(replay.evidence.capturedBy, IDS.ana);
    assert.equal(replay.evidence.executedBy, IDS.ben);
    assert.equal(replay.evidence.procedureReuse, true);
    for (const execution of [captured, replay]) {
      assert.equal(execution.evidence.externalRequests, 0);
      assert.equal(execution.evidence.memorableExecuted, false);
      assert.equal(execution.evidence.insurerContacted, false);
      assert.equal(execution.evidence.synthetic, true);
      assert.equal(execution.evidence.recordedToolCount, execution.steps.length);
    }
    assert.deepEqual(replay.steps.map((step) => step.tool), captured.steps.map((step) => step.tool), 'Replay must reuse captured procedure steps');
    assert.equal(replay.result.submittedToInsurer, false);
    return { procedureId: captured.procedureId, captureMode: captured.mode, replayMode: replay.mode, actorId: replay.actorId };
  }, resetAgain);
  await check('Clinic fetch names local synthetic source and evidence', async () => {
    const result = await post('sponsors', '/v1/clinic/fetch', {});
    const source = new URL(result.sourceUrl);
    assert.equal(source.origin, 'http://127.0.0.1:4706');
    for (const field of ['name', 'hours', 'phone']) nonempty(result.clinic?.[field], `clinic ${field}`);
    nonempty(result.mode, 'clinic mode'); nonempty(result.fetchedAt, 'fetchedAt'); assert(result.evidence, 'Clinic fetch needs evidence');
    assert.equal(result.mode, 'local-http-fetch');
    assert.equal(result.evidence.synthetic, true);
    assert.equal(result.evidence.officialUfoExecution, false);
    assert.equal(result.evidence.browserExecuted, false);
    assert.equal(result.evidence.request?.url, result.sourceUrl);
    assert.equal(result.evidence.request?.redirectsAllowed, false);
    assert.equal(result.evidence.response?.status, 200);
    assert.equal(result.evidence.response?.fixtureMatched, true);
    const local = await fetch('http://127.0.0.1:4706/', { redirect: 'error', signal: AbortSignal.timeout(5000) });
    assert.equal(local.status, 200);
    const html = await local.text();
    assert.equal(result.evidence.response.sha256, createHash('sha256').update(html).digest('hex'), 'Fetch evidence must match actual local source bytes');
    const directory = JSON.parse(html.match(/<script id="care-circle-directory" type="application\/json">([^<]+)<\/script>/)?.[1] ?? 'null');
    assert.deepEqual(result.clinic, directory?.clinic, 'Extracted clinic fields must match local source');
    return { mode: result.mode, sourceUrl: result.sourceUrl, fetchedAt: result.fetchedAt };
  }, resetAgain);
  await statusChecks();
}

async function health() {
  const deadline = Date.now() + waitSeconds * 1000;
  const services = ['web', 'brain', 'ingest', 'brief', 'river', 'sponsors', 'clinic'];
  await Promise.all(services.map(async (service) => {
    await check(`${service} health`, async () => {
      let last;
      do {
        try {
          const result = await request(service, '/health', { timeoutMs: 5000 });
          assert.equal(result.ok, true); assert.equal(result.service, service === 'clinic' ? 'sponsors-clinic' : service);
          return { port: PORTS[service], service: result.service };
        } catch (error) { last = error; }
        if (Date.now() < deadline) await new Promise((r) => setTimeout(r, 1500));
      } while (Date.now() < deadline);
      throw last;
    });
  }));
}

try {
  if (full) for (let cycle = 1; cycle <= cycles; cycle++) {
    await fullCycle(cycle);
    if (mutationOutcomeUncertain) break;
  }
  else {
    await health();
    if (!healthOnly) { stage = 'current state'; await readOnly(); }
  }
} catch (error) {
  checks.push({ stage, name: 'Runner completion', status: 'failed', error: error.message });
  console.error(error.stack);
} finally {
  let commit = 'unknown';
  try { commit = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim(); } catch {}
  const totals = { passed: 0, failed: 0, skipped: 0 };
  for (const item of checks) totals[item.status]++;
  const report = { runId, startedAt, finishedAt: new Date().toISOString(), commit, mode: full ? 'full' : healthOnly ? 'health-only' : 'read-only', transport: direct ? 'direct' : 'web-proxy', cyclesRequested: full ? cycles : 0, mutationOutcomeUncertain, totals, checks };
  const directory = resolve(root, 'tests/e2e/results');
  await mkdir(directory, { recursive: true });
  const reportPath = resolve(directory, `${runId}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Acceptance: ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped. Receipt: ${reportPath}`);
  process.exitCode = totals.failed || totals.skipped ? 1 : 0;
}
