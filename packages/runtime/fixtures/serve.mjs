import http from 'node:http';

export async function serve(endpoints, { healthy = true } = {}) {
  const servers = [];
  let redirectHits = 0;
  const send = (response, value, status = 200) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  for (const endpoint of endpoints) {
    const server = http.createServer((request, response) => {
      if (request.url === '/health') return send(response, { ok: healthy, service: endpoint.name });
      if (request.url === '/redirect') {
        response.writeHead(302, { location: `http://127.0.0.1:${endpoint.port}/redirect-target` });
        return response.end();
      }
      if (request.url === '/redirect-target') {
        redirectHits += 1;
        return send(response, { ok: true });
      }
      if (request.url === '/stats') return send(response, { redirectHits });
      if (request.url === '/large') return send(response, { value: 'x'.repeat(128 * 1024) });
      if (request.url === '/slow') return;
      return send(response, { error: 'fixture route missing' }, 404);
    });
    server.on('error', () => { process.exitCode = 1; shutdown(); });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(endpoint.port, '127.0.0.1', resolve);
    });
    servers.push(server);
  }
  function shutdown() {
    for (const server of servers) {
      server.closeAllConnections();
      server.close();
    }
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
