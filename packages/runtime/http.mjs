import { origin } from './registry.mjs';

export async function request(port, path, { method = 'GET', body, timeoutMs = 5000, json = true, maxBytes = 4 * 1024 * 1024, signal } = {}) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected fixed local path');
  const response = await fetch(`${origin(port)}${path}`, {
    method, redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`Response exceeded limit at ${port}${path}`);
    chunks.push(chunk);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${port}${path}`);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!json) return text;
  try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON at ${port}${path}`); }
}

export async function health(endpoint, timeoutMs = 1500, signal) {
  try {
    const data = await request(endpoint.port, '/health', { timeoutMs, maxBytes: 65536, signal });
    return { ok: data.ok === true && data.service === endpoint.name, data };
  } catch { return { ok: false }; }
}
