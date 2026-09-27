import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SUBMISSION = Object.freeze({
  endpoint: 'https://memorable-extraction-api.memorable.workers.dev/v1/extract',
  payloadSha256: '994c84515254b5e26114a7249ef3bf56e106503ac1e21560fccd2ab620c0bf32',
  payloadBytes: 3189,
  credentialVariable: 'MEMORABLE_API_KEY',
  maxResponseBytes: 262144,
  timeoutMs: 15000
});
const outcomeRoot = new URL('./.runtime/submission/', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateHistoricalApproval(approval, approvalReference) {
  if (!plain(approval) || approval.approved !== true || approval.approvedBy !== 'Emre' ||
      approval.authorization !== 'single-synthetic-extraction' ||
      approval.approvalReference !== approvalReference || typeof approvalReference !== 'string' ||
      !approvalReference.trim() || approvalReference.length > 300 ||
      !Number.isFinite(Date.parse(approval.approvedAt)) ||
      approval.payloadSha256 !== SUBMISSION.payloadSha256 || approval.payloadBytes !== SUBMISSION.payloadBytes ||
      approval.endpoint !== SUBMISSION.endpoint || approval.credentialVariable !== SUBMISSION.credentialVariable ||
      approval.maxRequests !== 1) {
    fail(403, 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED', 'Historical receipt authorization does not match its recorded request.');
  }
}

export function validateMemorableResponse(value) {
  const validText = (text, maximum) => typeof text === 'string' && text.length > 0 && text.length <= maximum;
  const draft = value?.draft;
  if (!plain(value) || !validText(value.request_id, 128) || !/^[A-Za-z0-9_-]+$/.test(value.request_id) ||
      !plain(draft) || !validText(draft.title, 300) || draft.schema_version !== '1.0.0' ||
      !Array.isArray(draft.steps) || draft.steps.length < 1 || draft.steps.length > 32) {
    fail(502, 'INVALID_REMOTE_RESPONSE', 'Memorable returned an unsupported response shape. The response was not executed.');
  }
  const sequences = new Set();
  for (const step of draft.steps) {
    if (!plain(step) || !Number.isInteger(step.seq) || step.seq < 1 || step.seq > 200 || sequences.has(step.seq) ||
        !validText(step.action, 200) || !validText(step.activity_class, 80) ||
        (step.command !== undefined && !validText(step.command, 4000)) ||
        (step.repeat_count !== undefined && (!Number.isInteger(step.repeat_count) || step.repeat_count < 1 || step.repeat_count > 1000))) {
      fail(502, 'INVALID_REMOTE_RESPONSE', 'Memorable returned unsupported procedure steps. The response was not executed.');
    }
    sequences.add(step.seq);
  }
  for (const field of ['preconditions', 'postconditions']) {
    if (draft[field] !== undefined && (!Array.isArray(draft[field]) || draft[field].length > 40 || draft[field].some(text => !validText(text, 2000)))) {
      fail(502, 'INVALID_REMOTE_RESPONSE', 'Memorable returned unsupported procedure conditions.');
    }
  }
  if (draft.embedding !== undefined && (!Array.isArray(draft.embedding) || draft.embedding.length > 4096 || draft.embedding.some(value => typeof value !== 'number' || !Number.isFinite(value)))) {
    fail(502, 'INVALID_REMOTE_RESPONSE', 'Memorable returned an unsupported embedding.');
  }
  return { requestId: value.request_id, stepCount: draft.steps.length, schemaVersion: draft.schema_version };
}

function readBoundedFile(url, maximum) {
  if (statSync(url).size > maximum) throw new Error('Local submission artifact exceeds its size limit.');
  return readFileSync(url);
}

export function evaluateSubmissionHistory({ attempt, receipt, responseBody }) {
  const status = { remoteAttempted: false, remoteSubmitted: false, remoteValidated: false, authorizationRecorded: false, authorizationDecision: 'denied', productionSubmissionEnabled: false, outcome: 'not-attempted' };
  try {
    validateHistoricalApproval(attempt.approvalRecord, attempt.approvalReference);
    if (attempt.payloadSha256 !== SUBMISSION.payloadSha256 || !Number.isFinite(Date.parse(attempt.startedAt))) return status;
    status.remoteAttempted = true;
    status.remoteSubmitted = null;
    status.delivery = 'unknown';
    status.outcome = 'unvalidated-or-failed';
  } catch { return status; }
  try {
    if (!Buffer.isBuffer(responseBody) || responseBody.byteLength > SUBMISSION.maxResponseBytes) return status;
    const validated = validateMemorableResponse(JSON.parse(responseBody.toString('utf8')));
    if (receipt.remoteSubmitted === true && receipt.remoteValidated === true && receipt.externalRequests === 1 &&
        receipt.approvalReference === attempt.approvalReference && receipt.payloadSha256 === SUBMISSION.payloadSha256 &&
        receipt.approvedAt === attempt.approvalRecord.approvedAt && receipt.endpoint === SUBMISSION.endpoint &&
        receipt.payloadBytes === SUBMISSION.payloadBytes && receipt.learnedStepsExecuted === false &&
        receipt.responseSha256 === sha256(responseBody) && receipt.responseBytes === responseBody.byteLength &&
        receipt.requestId === validated.requestId && receipt.stepCount === validated.stepCount) {
      return { ...status, remoteSubmitted: true, remoteValidated: true, delivery: 'validated-response-received', outcome: 'validated-extraction', requestId: receipt.requestId, learnedStepsExecuted: false };
    }
  } catch {}
  return status;
}

export function getSubmissionStatus() {
  const history = {};
  for (const name of ['attempt', 'receipt']) {
    try { history[name] = JSON.parse(readBoundedFile(new URL(`${name}.json`, outcomeRoot), 16384)); }
    catch {}
  }
  try { history.responseBody = readBoundedFile(new URL('response.json', outcomeRoot), SUBMISSION.maxResponseBytes); }
  catch {}
  return evaluateSubmissionHistory(history);
}

export function denyRemoteSubmission() {
  fail(403, 'MEMORABLE_REMOTE_SUBMISSION_DENIED', 'Emre declined remote Memorable submission. The production CLI is disabled.');
}

async function main() {
  // Unconditional denial precedes flags, records, payload reads and credential access.
  denyRemoteSubmission();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${JSON.stringify({ error: { code: error.code ?? 'SUBMISSION_FAILED', message: error.message } })}\n`);
    process.exitCode = 1;
  });
}
