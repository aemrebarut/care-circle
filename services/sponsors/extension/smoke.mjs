import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { createClinicServer, fetchClinic, getStatus } from './index.mjs';

const base = 'http://127.0.0.1:4706';
const adversarial = process.argv.includes('--adversarial');
const existingOnly = process.argv.includes('--existing');
const request = (path, options = {}) => fetch(`${base}${path}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(7_000) });
const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(4706, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
});
const close = (server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
const rpc = (body, headers = {}) => request('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
const call = (method, params = {}, id = 1) => rpc({ jsonrpc: '2.0', id, method, params });
const raw = (path, { method = 'GET', headers = {}, chunks = [] } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port: 4706, path, method, headers, agent: false }, (res) => {
    const parts = [];
    res.on('data', (part) => parts.push(part));
    res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(parts).toString('utf8') }));
    res.on('error', reject);
  });
  req.setTimeout(7_000, () => req.destroy(new Error('Raw HTTP smoke timeout')));
  req.on('error', reject);
  for (const chunk of chunks) req.write(chunk);
  req.end();
});
const partialHeader = () => new Promise((resolve, reject) => {
  let response = '';
  const socket = net.createConnection({ host: '127.0.0.1', port: 4706 }, () => {
    socket.write('GET / HTTP/1.1\r\nHost: 127.0.0.1:4706\r\n');
  });
  socket.setTimeout(7_000, () => socket.destroy(new Error('Partial headers did not time out within 7 seconds')));
  socket.on('data', (part) => { response += part.toString('utf8'); });
  socket.on('error', reject);
  socket.on('close', () => resolve(response));
});

assert.ok(!(adversarial && existingOnly), 'Choose --adversarial or --existing, not both.');
let ownedServer = existingOnly ? null : createClinicServer();
let reuse = existingOnly;
try {
  try { if (ownedServer) await listen(ownedServer); }
  catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    ownedServer = null;
    if (adversarial) throw new Error('Adversarial test requires free port 4706; refusing to replace a running service.');
    reuse = true;
  }
  const health = await (await request('/health')).json();
  assert.deepEqual(health, { ok: true, service: 'sponsors-clinic', synthetic: true });
  const html = await (await request('/')).text();
  assert.match(html, /Synthetic demo only/);
  assert.match(html, /Demo Circle Pharmacy \(fictional\)/);
  assert.match(html, /<footer>Not medical advice<\/footer>/);
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await raw('/', { headers: { Host: 'untrusted.example' } })).status, 403);
  const fetched = await fetchClinic({});
  assert.equal(fetched.mode, 'local-http-fetch');
  assert.equal(fetched.sourceUrl, `${base}/`);
  assert.equal(fetched.clinic.phone, '+1 (415) 555-0142');
  assert.equal(fetched.evidence.response.sha256, createHash('sha256').update(html).digest('hex'));
  assert.equal(fetched.evidence.browserExecuted, false);
  assert.equal(fetched.evidence.officialUfoExecution, false);
  assert.equal((await fetchClinic({})).evidence.response.sha256, fetched.evidence.response.sha256);
  assert.ok(getStatus().lastFetchedAt);
  for (const input of [null, [], 'http://example.test', { url: `${base}/` }, { sourceUrl: 'https://example.test' }]) {
    await assert.rejects(fetchClinic(input), { code: 'INVALID_INPUT' });
  }
  const initialized = await (await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'care-circle-smoke', version: '1' } })).json();
  assert.equal(initialized.result.protocolVersion, '2025-06-18');
  assert.equal((await (await call('initialize', { protocolVersion: '2025-03-26' })).json()).result.protocolVersion, '2025-06-18');
  for (const id of [{}, [], null, 1.5]) {
    const invalid = await call('ping', {}, id);
    assert.equal(invalid.status, 400);
    assert.deepEqual((await invalid.json()).error, { code: -32600, message: 'Invalid JSON-RPC request.' });
  }
  assert.equal((await (await call('ping', {}, 'text-id')).json()).id, 'text-id');
  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const catalog = await (await call('tools/list')).json();
  assert.equal(catalog.result.tools[0].name, 'care_circle_fetch_clinic');
  const invocation = await (await call('tools/call', { name: 'care_circle_fetch_clinic', arguments: {} })).json();
  assert.equal(invocation.result.isError, false);
  assert.equal(invocation.result.structuredContent.clinic.phone, fetched.clinic.phone);
  const denied = await (await call('tools/call', { name: 'care_circle_fetch_clinic', arguments: { url: 'https://example.test' } })).json();
  assert.equal(denied.result.isError, true);
  assert.equal((await (await call('tools/call', { name: 'missing' })).json()).error.code, -32602);
  assert.equal((await (await call('missing')).json()).error.code, -32601);
  assert.equal((await request('/mcp')).status, 405);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'MCP-Protocol-Version': 'invalid' })).status, 400);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'MCP-Protocol-Version': '2025-03-26' })).status, 400);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, { Accept: 'application/json' })).status, 406);
  assert.equal((await request('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: 'x'.repeat(8_193) })).status, 413);
  const chunked = await raw('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Transfer-Encoding': 'chunked' }, chunks: ['x'.repeat(4_096), 'x'.repeat(4_097)] });
  assert.equal(chunked.status, 413);
  assert.equal(JSON.parse(chunked.body).error.code, 'BODY_TOO_LARGE');
  assert.equal((await request('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{' })).status, 400);
  assert.match(await partialHeader(), /^HTTP\/1\.1 408 /);
  console.log(`PASS clinic health, visible source, real fixed fetch, source hash, input rejection, MCP catalog/call and HTTP bounds (${reuse ? 'existing service' : 'owned temporary server'}).`);
} finally {
  if (ownedServer) await close(ownedServer);
}

if (adversarial) {
  for (const [code, handler] of [
    ['REDIRECT_REJECTED', (_req, res) => { res.writeHead(302, { Location: 'https://example.test' }); res.end(); }],
    ['RESPONSE_TOO_LARGE', (_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('x'.repeat(32_769)); }],
    ['UNTRUSTED_CONTENT', (_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<p>Unexpected website</p>'); }],
    ['CLINIC_TIMEOUT', () => {}],
  ]) {
    const fixture = http.createServer(handler);
    await listen(fixture);
    try { await assert.rejects(fetchClinic({}), { code }); }
    finally { await close(fixture); }
  }
  console.log('PASS rejected redirects, oversized response, replaced fixture and response timeout. All owned servers closed.');
}
