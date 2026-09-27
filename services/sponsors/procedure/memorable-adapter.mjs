// Local export only. This module does not import network clients or read credentials.
const ENDPOINT = 'https://memorable-extraction-api.memorable.workers.dev/v1/extract';

export function memorableExportMetadata() {
  return {
    mode: 'local-export-only',
    synthetic: true,
    documentationUrl: 'https://www.memorable.sh/doc',
    documentationCheckedOn: '2026-09-27',
    intendedEndpoint: ENDPOINT,
    intendedMethod: 'POST',
    externalSubmissionAuthorized: false,
    authorizationDecision: 'denied',
    artifactPurpose: 'unsent-historical-review',
    submissionEnabled: false,
    remoteSubmitted: false,
    remoteValidated: false,
    limitations: [
      'This is an unsent review artifact matching the public Extraction API example.',
      'Custom tool interpretation and remote response compatibility have not been verified.',
      'Emre declined remote Memorable submission. The production CLI is unconditionally disabled.'
    ]
  };
}

export function toMemorablePayload(trace = {}) {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    throw Object.assign(new Error('A local synthetic tool trace object is required.'), { status: 400, code: 'INVALID_TRACE' });
  }
  const { traceId, task, steps } = trace;
  if (typeof traceId !== 'string' || !/^trace-[a-f0-9]{24}$/.test(traceId) || typeof task !== 'string' || !task.trim() || task.length > 2000 || !Array.isArray(steps) || !steps.length || steps.length > 32) {
    throw Object.assign(new Error('A bounded local synthetic tool trace is required.'), { status: 400, code: 'INVALID_TRACE' });
  }
  const tool_calls = steps.map(step => {
    if (!step || typeof step.tool !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(step.tool) || !step.input || typeof step.input !== 'object' || Array.isArray(step.input) || !step.output || typeof step.output !== 'object' || Array.isArray(step.output)) {
      throw Object.assign(new Error('Each trace step must contain a tool name, input object and output object.'), { status: 400, code: 'INVALID_TRACE' });
    }
    return { name: step.tool, input: structuredClone(step.input), result: structuredClone(step.output) };
  });
  return { session_id: traceId, task_description: task, harness: 'care-circle-synthetic-local', tool_calls };
}

export function submitMemorable() {
  throw Object.assign(new Error('Emre declined remote Memorable submission. No remote submission is available.'), {
    status: 403, code: 'EXTERNAL_SUBMISSION_NOT_AUTHORIZED'
  });
}
