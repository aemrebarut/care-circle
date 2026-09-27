import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { submitWithApproval } from './offline-submission-test-support.mjs';
import { SUBMISSION, validateMemorableResponse, getSubmissionStatus, evaluateSubmissionHistory, denyRemoteSubmission } from './memorable-submit.mjs';

const payload = readFileSync(new URL('./assets/memorable-request.json', import.meta.url));
const initialSubmissionStatus = getSubmissionStatus();
const approvalReference = 'synthetic-unit-test-approval-only';
const approval = {
  approved: true, approvedBy: 'Emre', authorization: 'single-synthetic-extraction',
  approvalReference, approvedAt: '2026-09-27T22:00:00.000Z',
  payloadSha256: SUBMISSION.payloadSha256, payloadBytes: SUBMISSION.payloadBytes,
  endpoint: SUBMISSION.endpoint, credentialVariable: 'MEMORABLE_API_KEY', maxRequests: 1
};
const accepted = {
  request_id: 'synthetic-test-response',
  draft: { title: 'Synthetic local test', schema_version: '1.0.0',
    steps: [{ seq: 1, action: 'simulate_prior_auth_submission', activity_class: 'execute', repeat_count: 1 }],
    postconditions: ['Synthetic rehearsal only.'], embedding: [], embedding_model: '' }
};
const options = () => ({ send: true, approvedPayloadSha256: SUBMISSION.payloadSha256, approvalReference, approval: structuredClone(approval), payload });
const jsonResponse = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });

test('production submission denies without inspecting arguments or accessing dependencies', () => {
  const unreadable = new Proxy({}, { get() { throw new Error('Production denial must not inspect options or credentials.'); } });
  assert.throws(() => denyRemoteSubmission(unreadable, unreadable), { code: 'MEMORABLE_REMOTE_SUBMISSION_DENIED', status: 403 });
  const status = getSubmissionStatus();
  assert.equal(status.authorizationDecision, 'denied');
  assert.equal(status.authorizationRecorded, false);
  assert.equal(status.productionSubmissionEnabled, false);
});

test('production CLI refuses all flags under denied file/network access and a credential-read trap', () => {
  const script = fileURLToPath(new URL('./memorable-submit.mjs', import.meta.url));
  const packagePath = fileURLToPath(new URL('./package.json', import.meta.url));
  for (const args of [[], ['--send', '--approved-payload-sha256', SUBMISSION.payloadSha256, '--approval-reference', 'ignored-after-denial']]) {
    const source = `
      process.env = new Proxy({}, { get(target, name) {
        if (name === 'MEMORABLE_API_KEY') throw new Error('Credential access is forbidden.');
        return undefined;
      }});
      globalThis.fetch = () => { throw new Error('Network access is forbidden.'); };
      process.argv = [process.execPath, ${JSON.stringify(script)}, ...${JSON.stringify(args)}];
      await import(${JSON.stringify(new URL('./memorable-submit.mjs', import.meta.url).href)});
    `;
    const result = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${script}`, `--allow-fs-read=${packagePath}`, '--input-type=module', '--eval', source], {
      env: {}, encoding: 'utf8', timeout: 5000, maxBuffer: 65536
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).error.code, 'MEMORABLE_REMOTE_SUBMISSION_DENIED');
  }
});
function fixture(response = () => jsonResponse(accepted)) {
  const observed = { credentialsRead: 0, requests: [], outcomes: [], attempts: [] };
  const dependencies = {
    offlineOnly: true,
    readSyntheticCredential: () => { observed.credentialsRead += 1; return 'demo-only'; },
    claimAttempt: attempt => {
      if (observed.attempts.length) throw Object.assign(new Error('Attempt already claimed.'), { status: 409, code: 'SUBMISSION_ALREADY_ATTEMPTED' });
      observed.attempts.push(attempt);
    },
    transport: async (url, request) => { observed.requests.push({ url, request }); return response(); },
    saveOutcome: outcome => observed.outcomes.push(outcome)
  };
  return { observed, dependencies };
}

test('offline adapter fixture refuses before synthetic credential access by default', async () => {
  const { observed, dependencies } = fixture();
  await assert.rejects(submitWithApproval({ ...options(), send: false }, dependencies), { code: 'SEND_FLAG_REQUIRED' });
  await assert.rejects(submitWithApproval({ ...options(), approval: null }, dependencies), { code: 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED' });
  await assert.rejects(submitWithApproval({ ...options(), approval: { ...approval, approved: false } }, dependencies), { code: 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED' });
  assert.equal(observed.credentialsRead, 0);
  assert.equal(observed.requests.length, 0);
  assert.equal(observed.attempts.length, 0);
});

test('exact payload and all approval fields must match before credential access', async () => {
  const { observed, dependencies } = fixture();
  await assert.rejects(submitWithApproval({ ...options(), payload: Buffer.concat([payload, Buffer.from(' ')]) }, dependencies), { code: 'PAYLOAD_APPROVAL_MISMATCH' });
  await assert.rejects(submitWithApproval({ ...options(), approvedPayloadSha256: '0'.repeat(64) }, dependencies), { code: 'PAYLOAD_APPROVAL_MISMATCH' });
  for (const [field, value] of [['approvedBy', 'someone'], ['approvalReference', 'different'], ['maxRequests', 2], ['endpoint', 'https://example.com'], ['credentialVariable', 'OTHER_KEY'], ['approvedAt', null]]) {
    await assert.rejects(submitWithApproval({ ...options(), approval: { ...approval, [field]: value } }, dependencies), { code: 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED' });
  }
  assert.equal(observed.credentialsRead, 0);
  assert.equal(observed.requests.length, 0);
});

test('approved fake transport sends exactly once with fixed endpoint and redirect refusal', async () => {
  const { observed, dependencies } = fixture();
  const receipt = await submitWithApproval(options(), dependencies);
  assert.equal(observed.requests.length, 1);
  assert.equal(observed.requests[0].url, SUBMISSION.endpoint);
  assert.equal(observed.requests[0].request.method, 'POST');
  assert.equal(observed.requests[0].request.redirect, 'error');
  assert.equal(observed.requests[0].request.body, payload);
  assert.ok(observed.requests[0].request.signal instanceof AbortSignal);
  assert.equal(observed.requests[0].request.signal.aborted, true);
  assert.equal(receipt.remoteSubmitted, true);
  assert.equal(receipt.remoteValidated, true);
  assert.equal(receipt.learnedStepsExecuted, false);
  assert.equal(receipt.externalRequests, 1);
  assert.equal(observed.outcomes.length, 1);
  assert.ok(!JSON.stringify(receipt).includes('demo-only'));
  await assert.rejects(submitWithApproval(options(), dependencies), { code: 'SUBMISSION_ALREADY_ATTEMPTED' });
  assert.equal(observed.requests.length, 1);
});

test('missing synthetic test marker prevents the fake attempt', async () => {
  const { observed, dependencies } = fixture();
  dependencies.readSyntheticCredential = () => '';
  await assert.rejects(submitWithApproval(options(), dependencies), { code: 'SYNTHETIC_CREDENTIAL_REQUIRED' });
  assert.equal(observed.attempts.length, 0);
  assert.equal(observed.requests.length, 0);
});

test('HTTP failures, redirect responses, malformed JSON and oversized bodies never retry', async () => {
  const cases = [
    [() => new Response('{}', { status: 500 }), 'REMOTE_HTTP_ERROR'],
    [() => new Response('', { status: 302, headers: { location: 'https://example.com' } }), 'REMOTE_HTTP_ERROR'],
    [() => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }), 'INVALID_REMOTE_RESPONSE'],
    [() => new Response('bad', { status: 200, headers: { 'content-type': 'application/json' } }), 'INVALID_REMOTE_RESPONSE'],
    [() => new Response('{}'.repeat(SUBMISSION.maxResponseBytes), { headers: { 'content-type': 'application/json' } }), 'RESPONSE_TOO_LARGE'],
    [() => jsonResponse({}), 'INVALID_REMOTE_RESPONSE']
  ];
  for (const [response, code] of cases) {
    const { observed, dependencies } = fixture(response);
    await assert.rejects(submitWithApproval(options(), dependencies), { code });
    assert.equal(observed.requests.length, 1);
    assert.equal(observed.requests[0].request.signal.aborted, true);
    assert.equal(observed.outcomes[0].failure.remoteValidated, false);
  }
});

test('transport errors do not expose arbitrary upstream message content', async () => {
  const { observed, dependencies } = fixture();
  let signal;
  dependencies.transport = async (url, request) => { signal = request.signal; throw new Error('Never print this synthetic sentinel.'); };
  await assert.rejects(submitWithApproval(options(), dependencies), error => error.code === 'REMOTE_REQUEST_FAILED' && !error.message.includes('sentinel'));
  assert.equal(observed.outcomes[0].failure.code, 'REMOTE_REQUEST_FAILED');
  assert.equal(observed.outcomes[0].failure.delivery, 'unknown');
  assert.equal(signal.aborted, true);
});

test('response validation rejects unsupported shapes and treats command text as inert data', () => {
  for (const changed of [null, {}, { ...accepted, request_id: '<unsafe>' }, { ...accepted, draft: { ...accepted.draft, schema_version: '9' } }, { ...accepted, draft: { ...accepted.draft, steps: [] } }]) {
    assert.throws(() => validateMemorableResponse(changed), { code: 'INVALID_REMOTE_RESPONSE' });
  }
  const inert = structuredClone(accepted);
  inert.draft.steps[0].command = 'This text is stored only; it is never executed.';
  assert.equal(validateMemorableResponse(inert).stepCount, 1);
});

test('a reflected credential is rejected before saving a response or printing receipt data', async () => {
  for (const response of [
    () => jsonResponse({ ...accepted, request_id: 'demo-only' }),
    () => new Response(JSON.stringify({ ...accepted, request_id: 'demo-only' }).replace('demo-only', '\\u0064emo-only'), { headers: { 'content-type': 'application/json' } })
  ]) {
    const { observed, dependencies } = fixture(response);
    await assert.rejects(submitWithApproval(options(), dependencies), { code: 'KEY_REFLECTION_REJECTED' });
    assert.equal(observed.outcomes.length, 1);
    assert.equal(observed.outcomes[0].responseBody, undefined);
    assert.equal(observed.outcomes[0].receipt, undefined);
    assert.ok(!JSON.stringify(observed.outcomes).includes('demo-only'));
    assert.equal(observed.requests[0].request.signal.aborted, true);
  }
});

test('no real approval or submission receipt is invented by the offline suite', () => {
  assert.deepEqual(getSubmissionStatus(), initialSubmissionStatus);
});

test('attempt history remains visible after approval revocation and unvalidated outcomes stay uncertain', async () => {
  const { observed, dependencies } = fixture();
  const receipt = await submitWithApproval(options(), dependencies);
  const history = { approval: null, attempt: observed.attempts[0], receipt, responseBody: observed.outcomes[0].responseBody };
  const proven = evaluateSubmissionHistory(history);
  assert.equal(proven.authorizationRecorded, false);
  assert.equal(proven.remoteAttempted, true);
  assert.equal(proven.remoteValidated, true);
  assert.equal(proven.delivery, 'validated-response-received');
  for (const changed of [{ ...history, receipt: null }, { ...history, responseBody: Buffer.from('{}') }, { ...history, receipt: { ...receipt, responseSha256: '0'.repeat(64) } }]) {
    const uncertain = evaluateSubmissionHistory(changed);
    assert.equal(uncertain.remoteAttempted, true);
    assert.equal(uncertain.remoteSubmitted, null);
    assert.equal(uncertain.remoteValidated, false);
    assert.equal(uncertain.delivery, 'unknown');
    assert.equal(uncertain.outcome, 'unvalidated-or-failed');
  }
});
