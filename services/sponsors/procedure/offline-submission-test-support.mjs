import { createHash } from 'node:crypto';
import { SUBMISSION, validateMemorableResponse, validateHistoricalApproval as validateApproval } from './memorable-submit.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };

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

// Test-only adapter. Production CLI has no transport or credential path.
export async function submitWithApproval({ send = false, approvedPayloadSha256, approvalReference, approval, payload }, dependencies) {
  if (dependencies?.offlineOnly !== true) fail(403, 'OFFLINE_TEST_ONLY', 'This adapter is available only to offline fake-transport tests.');
  if (send !== true) fail(403, 'SEND_FLAG_REQUIRED', 'The offline adapter fixture requires send:true.');
  if (approvedPayloadSha256 !== SUBMISSION.payloadSha256 || !Buffer.isBuffer(payload) || payload.byteLength !== SUBMISSION.payloadBytes || sha256(payload) !== SUBMISSION.payloadSha256) {
    fail(409, 'PAYLOAD_APPROVAL_MISMATCH', 'The exact reviewed payload bytes and SHA-256 are required.');
  }
  validateApproval(approval, approvalReference);
  const key = dependencies.readSyntheticCredential();
  if (key !== 'demo-only') fail(503, 'SYNTHETIC_CREDENTIAL_REQUIRED', 'The offline adapter accepts only its fixed synthetic test marker.');
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
