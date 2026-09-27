import { createClinicServer } from './index.mjs';

const server = createClinicServer();
server.listen(4706, '127.0.0.1', () => console.log('Synthetic clinic ready at http://127.0.0.1:4706/'));
server.on('error', (error) => { console.error(`Synthetic clinic failed: ${error.code || 'ERROR'}`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
