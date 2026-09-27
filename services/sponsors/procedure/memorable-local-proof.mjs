import { writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture } from './index.mjs';
import { OFFICIAL_CLI_SHA256, runOfficialLocalRecall, sha256 } from './memorable-local-runner.mjs';

const component = dirname(fileURLToPath(import.meta.url));
const captured = capture();
const { row, storeBody, commands, isolation } = runOfficialLocalRecall(captured);
const report = {
  schemaVersion: '1.0.0', checkedAt: new Date().toISOString(),
  mode: 'official-local-recall-of-manual-fixture',
  package: { name: 'memorable-cli', version: '0.5.30', cliSha256: OFFICIAL_CLI_SHA256, unmodified: true, redistributed: false },
  procedureId: row.slug, captureTraceId: captured.evidence.traceId,
  manualStoreSha256: sha256(storeBody), synthetic: true,
  memorableExtractionExecuted: false, memorableTraceLearningExecuted: false,
  remoteSubmitted: false, externalRequests: 0,
  isolation,
  commands,
  limitations: [
    'Care Circle manually seeded the local procedure fixture; Memorable did not extract or learn it.',
    'Only official CLI local lexical recall, guarded rendering and listing were tested.',
    'CLI ingest and record require hosted extraction and remain unexecuted.',
    'This proof does not change the service capture or replay mode from local-simulation.'
  ]
};
writeFileSync(resolve(component, 'assets/memorable-local-procedure.json'), `${JSON.stringify(row, null, 2)}\n`);
const receipt = resolve(component, 'assets/memorable-local-proof.json');
writeFileSync(receipt, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ok: true, mode: report.mode, receipt: relative(component, receipt), isolation, commands: commands.map(item => item.command) })}\n`);
