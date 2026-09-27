import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SUBMISSION = Object.freeze({
  endpoint: 'https://memorable-extraction-api.memorable.workers.dev/v1/extract',
  payloadSha256: '994c84515254b5e26114a7249ef3bf56e106503ac1e21560fccd2ab620c0bf32',
  payloadBytes: 3189,
  credentialVariable: 'MEMORABLE_API_KEY',
  maxResponseBytes: 262144,
  timeoutMs: 15000
});
const payloadUrl = new URL('./assets/memorable-request.json', import.meta.url);
const approvalUrl = new URL('../../../contract/memorable-approval.json', import.meta.url);
const outcomeRoot = new URL('./.runtime/submission/', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateApproval(approval, approvalReference) {
  if (!plain(approval) || approval.approved !== true || approval.approvedBy !== 'Emre' ||
      approval.authorization !== 'single-synthetic-extraction' ||
      approval.approvalReference !== approvalReference || typeof approvalReference !== 'string' ||
      !approvalReference.trim() || approvalReference.length > 300 ||
      !Number.isFinite(Date.parse(approval.approvedAt)) ||
      approval.payloadSha256 !== SUBMISSION.payloadSha256 || approval.payloadBytes !== SUBMISSION.payloadBytes ||
      approval.endpoint !== SUBMISSION.endpoint || approval.credentialVariable !== SUBMISSION.credentialVariable ||
      approval.maxRequests !== 1) {
    fail(403, 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED', 'A matching explicit Emre approval record from cc-lead is required.');
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

async function readBoundedResponse(response, credential) {
  if (!response.ok) fail(502, 'REMOTE_HTTP_ERROR', `Memorable returned HTTP ${response.status}. No retry was made.`);
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    fail(502, 'INVALID_REMOTE_RESPONSE', 'Memorable did not return JSON.');
  }
  if (!response.body) fail(502, 'INVALID_REMOTE_RESPONSE', 'Memorable returned an empty response.');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > SUBMISSION.maxResponseBytes) {
        await reader.cancel();
        fail(502, 'RESPONSE_TOO_LARGE', 'Memorable response exceeded the local size limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks);
  if (body.includes(Buffer.from(credential))) fail(502, 'KEY_REFLECTION_REJECTED', 'The remote response reflected a credential and was discarded.');
  let parsed;
  try { parsed = JSON.parse(body.toString('utf8')); }
  catch { fail(502, 'INVALID_REMOTE_RESPONSE', 'Memorable returned invalid JSON.'); }
  if (JSON.stringify(parsed).includes(credential)) fail(502, 'KEY_REFLECTION_REJECTED', 'The remote response reflected a credential and was discarded.');
  return { body, validated: validateMemorableResponse(parsed) };
}

// Injection points exist for offline fake-transport tests. The CLI supplies fixed production dependencies.
export async function submitWithApproval({ send = false, approvedPayloadSha256, approvalReference, approval, payload }, dependencies) {
  if (send !== true) fail(403, 'SEND_FLAG_REQUIRED', 'Submission is disabled by default. An approved invocation must explicitly include --send.');
  if (approvedPayloadSha256 !== SUBMISSION.payloadSha256 || !Buffer.isBuffer(payload) || payload.byteLength !== SUBMISSION.payloadBytes || sha256(payload) !== SUBMISSION.payloadSha256) {
    fail(409, 'PAYLOAD_APPROVAL_MISMATCH', 'The exact reviewed payload bytes and SHA-256 are required.');
  }
  validateApproval(approval, approvalReference);
  const key = dependencies.readCredential();
  if (typeof key !== 'string' || !key.trim()) fail(503, 'MEMORABLE_CREDENTIAL_REQUIRED', 'The authorized process must provide MEMORABLE_API_KEY.');
  dependencies.claimAttempt({ approvalReference, approvalRecord: structuredClone(approval), payloadSha256: SUBMISSION.payloadSha256, startedAt: new Date().toISOString() });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBMISSION.timeoutMs);
  try {
    const response = await dependencies.transport(SUBMISSION.endpoint, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: payload
    });
    const { body, validated } = await readBoundedResponse(response, key);
    const receipt = {
      schemaVersion: '1.0.0', mode: 'approved-single-remote-extraction',
      approvedBy: 'Emre', approvalReference, approvedAt: approval.approvedAt,
      completedAt: new Date().toISOString(), endpoint: SUBMISSION.endpoint,
      payloadSha256: SUBMISSION.payloadSha256, payloadBytes: SUBMISSION.payloadBytes,
      responseSha256: sha256(body), responseBytes: body.byteLength,
      requestId: validated.requestId, stepCount: validated.stepCount,
      externalRequests: 1, remoteSubmitted: true, remoteValidated: true,
      learnedStepsExecuted: false, synthetic: true
    };
    dependencies.saveOutcome({ receipt, responseBody: body });
    return receipt;
  } catch (error) {
    const code = typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'REMOTE_REQUEST_FAILED';
    dependencies.saveOutcome({ failure: { code, approvalReference, payloadSha256: SUBMISSION.payloadSha256, externalRequestsAttempted: 1, remoteAttempted: true, delivery: 'unknown', remoteValidated: false, learnedStepsExecuted: false } });
    fail(error.status ?? 502, code, 'The single approved extraction did not produce a validated receipt. No retry was made and no returned steps were executed.');
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

function loadApproval() {
  try { return JSON.parse(readBoundedFile(approvalUrl, 16384)); }
  catch { return null; }
}

function readBoundedFile(url, maximum) {
  if (statSync(url).size > maximum) throw new Error('Local submission artifact exceeds its size limit.');
  return readFileSync(url);
}

export function evaluateSubmissionHistory({ approval, attempt, receipt, responseBody }) {
  const status = { remoteAttempted: false, remoteSubmitted: false, remoteValidated: false, authorizationRecorded: false, outcome: 'not-attempted' };
  try { validateApproval(approval, approval?.approvalReference); status.authorizationRecorded = true; }
  catch {}
  try {
    validateApproval(attempt.approvalRecord, attempt.approvalReference);
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
  const history = { approval: loadApproval() };
  for (const name of ['attempt', 'receipt']) {
    try { history[name] = JSON.parse(readBoundedFile(new URL(`${name}.json`, outcomeRoot), 16384)); }
    catch {}
  }
  try { history.responseBody = readBoundedFile(new URL('response.json', outcomeRoot), SUBMISSION.maxResponseBytes); }
  catch {}
  return evaluateSubmissionHistory(history);
}

async function main(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === '--send') { if (values.send) fail(400, 'INVALID_ARGUMENTS', 'Duplicate --send flag.'); values.send = true; }
    else if (name === '--approved-payload-sha256' || name === '--approval-reference') {
      const key = name === '--approved-payload-sha256' ? 'approvedPayloadSha256' : 'approvalReference';
      if (values[key] || !args[index + 1] || args[index + 1].startsWith('--')) fail(400, 'INVALID_ARGUMENTS', 'Approval flags require one explicit value.');
      values[key] = args[++index];
    } else fail(400, 'INVALID_ARGUMENTS', 'Only --send, --approved-payload-sha256 and --approval-reference are accepted.');
  }
  const receipt = await submitWithApproval({ ...values, approval: loadApproval(), payload: readFileSync(payloadUrl) }, {
    readCredential: () => process.env.MEMORABLE_API_KEY,
    transport: fetch,
    claimAttempt: attempt => {
      mkdirSync(outcomeRoot, { recursive: true });
      try { writeFileSync(new URL('attempt.json', outcomeRoot), `${JSON.stringify(attempt, null, 2)}\n`, { flag: 'wx', mode: 0o600 }); }
      catch (error) {
        if (error.code === 'EEXIST') fail(409, 'SUBMISSION_ALREADY_ATTEMPTED', 'A prior attempt exists. No automatic retries or repeat submissions are allowed.');
        throw error;
      }
    },
    saveOutcome: ({ receipt, responseBody, failure }) => {
      if (responseBody) writeFileSync(new URL('response.json', outcomeRoot), responseBody, { flag: 'wx', mode: 0o600 });
      writeFileSync(new URL(receipt ? 'receipt.json' : 'failure.json', outcomeRoot), `${JSON.stringify(receipt ?? failure, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    }
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${JSON.stringify({ error: { code: error.code ?? 'SUBMISSION_FAILED', message: error.message } })}\n`);
    process.exitCode = 1;
  });
}
