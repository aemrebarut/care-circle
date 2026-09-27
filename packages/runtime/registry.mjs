import { HOST, PORTS } from '../../contract/index.mjs';

const service = (name, endpoints = [{ name, port: PORTS[name] }]) => ({
  name, entry: `services/${name}/server.mjs`, endpoints,
});

export const services = Object.freeze([
  service('brain'), service('river'), service('ingest'), service('brief'),
  service('sponsors', [{ name: 'sponsors', port: PORTS.sponsors }, { name: 'sponsors-clinic', port: PORTS.clinic }]),
  service('web'),
]);
export const origin = port => {
  if (!Number.isInteger(port) || port < 4700 || port > 4719) throw new Error('Port outside Care Circle range');
  return `http://${HOST}:${port}`;
};

export function selectServices(names = []) {
  for (const name of names) if (!services.some(service => service.name === name)) throw new Error(`Unknown service: ${name}`);
  return names.length ? services.filter(service => names.includes(service.name)) : [...services];
}
