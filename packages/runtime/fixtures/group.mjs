import { serve } from './serve.mjs';
await serve([
  { name: 'runtime-fixture', port: 4715 },
  { name: 'runtime-fixture-clinic', port: 4716 },
]);
