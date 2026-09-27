import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { toMemorablePayload, memorableExportMetadata } from './memorable-adapter.mjs';

const MODE = 'local-simulation';
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const SOURCES = new Map(FIXTURE.sources.map(source => [source.id, source]));
const MEMBER = SOURCES.get('procedure-fixtures/member');
const REQUEST = SOURCES.get('procedure-fixtures/request');
const REQUIREMENTS = SOURCES.get('procedure-fixtures/requirements');
const ACTORS = new Set(MEMBER.data.representativeIds);
const TASK = 'Rehearse a synthetic prior-authorization administrative workflow locally. No insurer is contacted and no treatment or coverage decision is made.';
const LIMITATIONS = Object.freeze([
  'Procedure execution is a deterministic local simulation using synthetic fixtures.',
  'No insurer is contacted; no authorization, coverage decision or treatment recommendation is produced.',
  'The reusable procedure is assembled locally, not learned or extracted by Memorable.',
  'Memorable payload export follows the public API example but has not been remotely submitted or validated.',
  'Captured procedures are in memory and reset when the sponsor service restarts or the demo is reset.'
]);
const captures = new Map();
let latestId = null;
let replayCount = 0;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function fail(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

function options(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail(400, 'INVALID_INPUT', 'Expected a JSON object.');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(400, 'UNKNOWN_FIELD', `Unsupported field: ${key}.`);
  }
  return value;
}

function actor(value, fallback) {
  const selected = value === undefined ? fallback : value;
  if (typeof selected !== 'string' || !ACTORS.has(selected)) {
    fail(400, 'INVALID_ACTOR', 'actorId must identify Ana, Ben or Celia using a stable Care Circle person ID.');
  }
  return selected;
}

function stored(value) {
  if (value !== undefined && (typeof value !== 'string' || !/^procedures\/prior-auth-[a-f0-9]{20}$/.test(value))) {
    fail(400, 'INVALID_PROCEDURE_ID', 'procedureId must be an ID returned by capture.');
  }
  const selected = value === undefined ? latestId : value;
  if (selected === null) fail(409, 'CAPTURE_REQUIRED', 'Capture the synthetic procedure before replay or export.');
  if (!captures.has(selected)) fail(404, 'PROCEDURE_NOT_FOUND', 'The captured procedure is unavailable. Capture again after reset or restart.');
  return captures.get(selected);
}

const PLAN = Object.freeze([
  { tool: 'read_synthetic_member', precondition: 'Known fictional family representative', postcondition: 'Synthetic member ID and plan read', sourceIds: [MEMBER.id] },
  { tool: 'read_synthetic_request', precondition: 'Member read', postcondition: 'Administrative request and supplied documents read', sourceIds: [REQUEST.id] },
  { tool: 'read_synthetic_requirements', precondition: 'Request and plan read', postcondition: 'Required fields and documents identified', sourceIds: [REQUIREMENTS.id] },
  { tool: 'assemble_synthetic_packet', precondition: 'Required fields and documents available', postcondition: 'Packet complete for local rehearsal', sourceIds: [MEMBER.id, REQUEST.id, REQUIREMENTS.id] },
  { tool: 'simulate_prior_auth_submission', precondition: 'Complete synthetic packet', postcondition: 'Simulated pending-review reference created; no insurer contacted', sourceIds: [REQUIREMENTS.id] },
  { tool: 'record_synthetic_followup', precondition: 'Simulated reference available', postcondition: 'Administrative follow-up question recorded in replay result', sourceIds: [REQUIREMENTS.id] }
]);

const HANDLERS = Object.freeze({
  read_synthetic_member(context) {
    const input = { patientId: MEMBER.data.patientId, actorId: context.actorId };
    const output = { ...MEMBER.data, authorizedRepresentative: ACTORS.has(context.actorId), synthetic: true };
    context.member = output;
    return { input, output };
  },
  read_synthetic_request(context) {
    if (!context.member) fail(500, 'INVALID_PLAN', 'Member context is missing.');
    const input = { patientId: context.member.patientId, requestId: REQUEST.data.requestId };
    const output = { ...REQUEST.data, synthetic: true };
    context.request = output;
    return { input, output };
  },
  read_synthetic_requirements(context) {
    if (!context.request || !context.member) fail(500, 'INVALID_PLAN', 'Request context is missing.');
    const input = { planId: context.member.planId, serviceCode: context.request.serviceCode };
    const output = { ...REQUIREMENTS.data, synthetic: true };
    context.requirements = output;
    return { input, output };
  },
  assemble_synthetic_packet(context) {
    if (!context.requirements) fail(500, 'INVALID_PLAN', 'Requirements context is missing.');
    const input = { memberId: context.member.memberId, requestId: context.request.requestId, documentIds: context.request.documentIds };
    const missingFields = context.requirements.requiredFields.filter(field => !input[field]);
    const missingDocuments = context.requirements.requiredDocumentIds.filter(id => !input.documentIds.includes(id));
    if (missingFields.length || missingDocuments.length) fail(422, 'INCOMPLETE_PACKET', 'The synthetic packet is incomplete.');
    const output = { packetId: `SYNTHETIC-PACKET-${digest(input).slice(0, 12)}`, complete: true, synthetic: true, submittedToInsurer: false };
    context.packet = output;
    return { input, output };
  },
  simulate_prior_auth_submission(context) {
    if (!context.packet?.complete) fail(500, 'INVALID_PLAN', 'A complete packet is required.');
    const input = { packetId: context.packet.packetId, actorId: context.actorId, simulation: true };
    const output = { reference: `SIM-PA-${digest(input).slice(0, 12)}`, status: 'simulated-pending-review', simulation: true, submittedToInsurer: false, externalRequests: 0 };
    context.submission = output;
    return { input, output };
  },
  record_synthetic_followup(context) {
    if (!context.submission) fail(500, 'INVALID_PLAN', 'A simulated reference is required.');
    const input = { reference: context.submission.reference, actorId: context.actorId };
    const output = {
      afterDemoBusinessDays: context.requirements.followUpAfterDemoBusinessDays,
      question: context.requirements.followUpQuestion,
      storage: 'local-result-only',
      simulation: true
    };
    context.followUp = output;
    return { input, output };
  }
});

function execute(plan, actorId) {
  const context = { actorId };
  const steps = plan.map((step, index) => {
    const handler = HANDLERS[step.tool];
    if (!handler) fail(500, 'UNKNOWN_TOOL', 'The stored procedure contains an unsupported tool.');
    return { index: index + 1, ...structuredClone(step), ...structuredClone(handler(context)), status: 'completed-in-simulation' };
  });
  return { steps, result: {
    status: context.submission.status,
    summary: 'Synthetic administrative packet rehearsed and follow-up question recorded locally.',
    reference: context.submission.reference,
    followUp: context.followUp,
    synthetic: true,
    simulation: true,
    submittedToInsurer: false,
    medicalAdvice: false
  } };
}

function sourceEvidence() {
  return FIXTURE.sources.map(source => ({
    sourceId: source.id, sourceType: 'local-synthetic-fixture', title: source.title,
    date: source.date, quote: source.text, sha256: digest(source)
  }));
}

function evidence({ procedureId, phase, actorId, capturedBy, steps, captureTraceId }) {
  const traceSha256 = digest({ procedureId, phase, actorId, steps, fixtureSha256: digest(FIXTURE) });
  return {
    traceId: `trace-${traceSha256.slice(0, 24)}`, traceSha256,
    ...(captureTraceId ? { captureTraceId } : {}),
    capturedBy, executedBy: actorId, phase,
    execution: 'deterministic-local-tool-simulation', synthetic: true, simulation: true,
    externalRequests: 0, memorableExecuted: false, insurerContacted: false,
    sourceGrounding: sourceEvidence(), fixtureSha256: digest(FIXTURE),
    planSha256: digest(PLAN), referenceDate: FIXTURE.referenceDate,
    procedureReuse: phase === 'replay', recordedToolCount: steps.length,
    truthLabel: 'Local simulation. No Memorable extraction or insurer submission has run.'
  };
}

export function capture(input = {}) {
  options(input, ['actorId']);
  const actorId = actor(input.actorId, 'people/ana-alvarez');
  const run = execute(PLAN, actorId);
  const procedureId = `procedures/prior-auth-${digest({ actorId, plan: PLAN, fixture: FIXTURE }).slice(0, 20)}`;
  const response = { procedureId, steps: run.steps, mode: MODE,
    evidence: evidence({ procedureId, phase: 'capture', actorId, capturedBy: actorId, steps: run.steps }) };
  captures.set(procedureId, structuredClone({ actorId, plan: PLAN, response }));
  latestId = procedureId;
  return structuredClone(response);
}

export function replay(input = {}) {
  options(input, ['procedureId', 'actorId']);
  const record = stored(input.procedureId);
  const actorId = actor(input.actorId, 'people/ben-alvarez');
  if (actorId === record.actorId) fail(409, 'DISTINCT_ACTOR_REQUIRED', 'Replay must use a different sibling from the one who captured the procedure.');
  const { procedureId } = record.response;
  const run = execute(record.plan, actorId);
  replayCount += 1;
  return structuredClone({ procedureId, actorId, steps: run.steps, result: run.result, mode: MODE,
    evidence: evidence({ procedureId, phase: 'replay', actorId, capturedBy: record.actorId,
      steps: run.steps, captureTraceId: record.response.evidence.traceId }) });
}

export function getMemorablePayload(input = {}) {
  options(input, ['procedureId']);
  const record = stored(input.procedureId);
  return {
    procedureId: record.response.procedureId,
    ...memorableExportMetadata(),
    payload: toMemorablePayload({ traceId: record.response.evidence.traceId, task: TASK, steps: record.response.steps }),
    evidence: { capturedBy: record.actorId, traceId: record.response.evidence.traceId, synthetic: true, externalRequests: 0 }
  };
}

export function reset() {
  captures.clear();
  latestId = null;
  replayCount = 0;
  return { ok: true };
}

export function getStatus() {
  return {
    mode: MODE,
    status: captures.size ? 'captured-local-simulation' : 'ready-for-local-capture',
    limitations: [...LIMITATIONS],
    synthetic: true, simulation: true, externalSubmissionAuthorized: false,
    memorableExecuted: false, procedureCount: captures.size, replayCount,
    latestProcedureId: latestId,
    adapter: { status: 'local-export-only', documentationUrl: 'https://www.memorable.sh/doc', remoteSubmitted: false }
  };
}
