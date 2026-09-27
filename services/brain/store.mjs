import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GBrain, ROOT } from './gbrain.mjs';
import { validateSeed, applyIngest, graph, medications, pageMarkdown, HttpError } from './domain.mjs';

export const STATE_SLUG = 'care-circle/service-state';
const STATE_MARKER = 'care-circle-state';
const STATE_LIMIT = 2_000_000;

export function encodeState(state) {
  const encoded = JSON.stringify(state);
  if (Buffer.byteLength(encoded) > STATE_LIMIT) {
    throw new HttpError(507, 'demo_capacity', 'This demo brain has reached its storage limit. Reset the synthetic demo before adding more notes.');
  }
  return `---\ntype: note\ntitle: Care Circle durable commit record\nembed_skip: true\n---\n# Care Circle durable commit record\n\nInternal synthetic service state. Entity pages and native links are repairable projections of this committed record.\n\n\`\`\`${STATE_MARKER}\n${encoded}\n\`\`\`\n`;
}

export function decodeState(page) {
  const match = page?.content?.match(/\n```care-circle-state\n([^\n]+)\n```\s*$/);
  if (!match) throw new Error('The durable family state marker is missing. Refusing to reseed.');
  const state = JSON.parse(match[1]);
  if (state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 1 ||
      !Array.isArray(state.ownedIds) || !state.idempotency || typeof state.idempotency !== 'object') {
    throw new Error('The durable family state is invalid. Refusing to reseed.');
  }
  validateSeed(state);
  const owned = new Set(state.ownedIds);
  if (owned.size !== state.ownedIds.length || state.pages.some(page => !owned.has(page.id)) ||
      state.ownedIds.some(id => typeof id !== 'string' || !/^(people|doctors|medications|visits|labs|questions|pharmacy|pharmacies|insurer-calls)\/[a-z0-9][a-z0-9/-]*$/.test(id))) {
    throw new Error('The durable ownership manifest is invalid. Refusing recovery.');
  }
  return state;
}

export class BrainStore {
  constructor({ db = new GBrain(), seedPath = resolve(ROOT, 'packages/world/seed.json'), worldPath = resolve(ROOT, 'packages/world/pages') } = {}) {
    this.db = db;
    this.seedPath = seedPath;
    this.worldPath = worldPath;
    this.ready = false;
    this.status = 'initializing';
    this.state = null;
    this.storageRevision = null;
    this.tail = Promise.resolve();
    this.pending = 0;
    this.stopping = false;
  }

  async seed() {
    return validateSeed(JSON.parse(await readFile(this.seedPath, 'utf8')));
  }

  async initialize() {
    await this.db.preflight();
    await this.db.barrier();
    const saved = await this.db.get(STATE_SLUG);
    if (saved) {
      this.state = decodeState(saved);
      this.storageRevision = saved.revision;
    } else {
      const seed = await this.seed();
      // Import the real world's markdown into GBrain, without embedding or any
      // external inference. The snapshot preserves the same typed metadata.
      await this.db.importWorld(this.worldPath);
      const initial = { version: 1, ...seed, revision: 1, resetEpoch: 0, idempotency: {}, ownedIds: seed.pages.map(page => page.id) };
      const receipt = await this.db.put(STATE_SLUG, encodeState(initial));
      this.storageRevision = receipt.revision;
      this.state = initial;
    }
    await this.project(this.state);
    this.ready = !this.stopping;
    this.status = this.stopping ? 'stopping' : 'ready';
  }

  health() {
    return { ok: this.ready, service: 'brain', status: this.status, storage: 'gbrain', revision: this.state?.revision ?? null, pages: this.state?.pages.length ?? 0, externalSubmissions: false };
  }

  requireReady() {
    if (!this.ready || this.stopping) throw new HttpError(503, 'brain_recovering', 'The family brain is recovering durable storage. Retry this request with the same idempotency key.');
  }

  view() {
    this.requireReady();
    return { patientId: this.state.patientId, pages: this.state.pages, graph: graph(this.state), revision: this.state.revision };
  }

  getPage(id) {
    this.requireReady();
    const page = this.state.pages.find(page => page.id === id);
    if (!page) throw new HttpError(404, 'page_not_found', 'The requested family source page does not exist.');
    return { page };
  }

  medicationList() {
    this.requireReady();
    return medications(this.state);
  }

  enqueue(action) {
    if (this.stopping) return Promise.reject(new HttpError(503, 'brain_stopping', 'The family brain is shutting down. Retry after restart.'));
    if (this.pending >= 20) return Promise.reject(new HttpError(429, 'brain_busy', 'The family brain has too many queued writes. Retry shortly.'));
    this.pending++;
    const next = this.tail.then(action);
    this.tail = next.catch(() => {}).finally(() => { this.pending--; });
    return next;
  }

  ingest(payload) {
    return this.enqueue(async () => {
      this.requireReady();
      const applied = applyIngest(this.state, payload);
      if (applied.state === this.state) return applied.result;
      await this.commit(applied.state);
      return applied.result;
    });
  }

  reset() {
    return this.enqueue(async () => {
      this.requireReady();
      const seed = await this.seed();
      const state = { version: 1, ...seed, revision: this.state.revision + 1,
        resetEpoch: (this.state.resetEpoch ?? 0) + 1, idempotency: {},
        // Retain tombstone ownership through restart, including a reset that
        // crashes after its snapshot commit and before projection cleanup.
        ownedIds: [...new Set([...this.state.ownedIds, ...seed.pages.map(page => page.id)])] };
      await this.commit(state);
      return { ok: true, revision: state.revision };
    });
  }

  async project(state, previous = null) {
    const old = new Map(previous?.pages.map(page => [page.id, pageMarkdown(page)]) ?? []);
    for (const page of state.pages) {
      const content = pageMarkdown(page);
      if (old.get(page.id) !== content) await this.db.put(page.id, content, { force: true });
    }
    const present = new Set(state.pages.map(page => page.id));
    for (const id of state.ownedIds) if (!present.has(id)) await this.db.remove(id);
    await this.db.extractLinks();
  }

  async commit(nextState) {
    // Capacity and serialization errors must not take a healthy brain offline.
    const content = encodeState(nextState);
    const previous = this.state;
    this.ready = false;
    this.status = 'committing';
    const requestId = randomUUID();
    try {
      const receipt = await this.db.put(STATE_SLUG, content, { expectedRevision: this.storageRevision, requestId });
      this.storageRevision = receipt.revision;
      this.state = nextState;
      await this.project(nextState, previous);
      this.ready = !this.stopping;
      this.status = this.stopping ? 'stopping' : 'ready';
    } catch {
      // The write may have committed even if transport failed. Re-read GBrain
      // instead of rolling back or accepting a second mutation from old state.
      this.status = 'recovery-needed';
      this.recover().catch(() => {});
      throw new HttpError(503, 'brain_recovering', 'Storage confirmation was interrupted. The note may already be committed. Retry with the identical idempotency key.');
    }
  }

  async recover() {
    if (this.recovery) return this.recovery;
    if (this.stopping) throw new HttpError(503, 'brain_stopping', 'The family brain is shutting down.');
    this.recovery = (async () => {
      await this.db.barrier();
      const saved = await this.db.get(STATE_SLUG);
      if (!saved) throw new Error('Durable state is missing during recovery.');
      this.state = decodeState(saved);
      this.storageRevision = saved.revision;
      await this.project(this.state);
      this.ready = !this.stopping;
      this.status = this.stopping ? 'stopping' : 'ready';
    })().finally(() => { this.recovery = null; });
    return this.recovery;
  }
}
