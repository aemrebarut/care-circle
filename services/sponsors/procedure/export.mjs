import { capture, getMemorablePayload } from './index.mjs';

capture();
// Printing a synthetic review artifact is the only effect. Nothing is submitted.
process.stdout.write(`${JSON.stringify(getMemorablePayload(), null, 2)}\n`);
