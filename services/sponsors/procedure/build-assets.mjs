import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { capture, replay, getMemorablePayload } from './index.mjs';

const root = new URL('./assets/', import.meta.url);
const captured = capture();
const replayed = replay();
const exported = getMemorablePayload();
const body = `${JSON.stringify(exported.payload, null, 2)}\n`;
const manifest = {
  schemaVersion: '1.0.0',
  synthetic: true,
  externalSubmissionAuthorized: false,
  authorizationDecision: 'denied',
  artifactPurpose: 'unsent-historical-review',
  remoteSubmitted: false,
  request: {
    file: 'memorable-request.json',
    sha256: createHash('sha256').update(body).digest('hex'),
    bytes: Buffer.byteLength(body),
    method: exported.intendedMethod,
    endpoint: exported.intendedEndpoint
  },
  captureTraceId: captured.evidence.traceId,
  procedureId: captured.procedureId,
  documentationUrl: exported.documentationUrl,
  documentationCheckedOn: exported.documentationCheckedOn,
  limitations: exported.limitations
};
mkdirSync(root, { recursive: true });
writeFileSync(new URL('memorable-request.json', root), body);
for (const [name, value] of [['manifest', manifest], ['capture-trace', captured], ['replay-trace', replayed]]) {
  writeFileSync(new URL(`${name}.json`, root), `${JSON.stringify(value, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify({ bytes: manifest.request.bytes, sha256: manifest.request.sha256, remoteSubmitted: false })}\n`);
