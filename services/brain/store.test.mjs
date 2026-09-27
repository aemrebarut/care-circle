import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BrainStore, STATE_SLUG, encodeState, decodeState } from './store.mjs';
import { applyIngest, validateSeed } from './domain.mjs';

const world = JSON.parse(await readFile(new URL('../../packages/world/seed.json', import.meta.url), 'utf8'));
const payload = JSON.parse(await readFile(new URL('./fixtures/demo-ingest.json', import.meta.url), 'utf8'));
const initial = () => ({ version: 1, ...structuredClone(world), revision: 1, resetEpoch: 0, idempotency: {}, ownedIds: world.pages.map(page => page.id) });

class MemoryGBrain {
  constructor(state = initial()) {
    this.rows = new Map([[STATE_SLUG, { content: encodeState(state), revision: 'storage-1' }]]);
    this.sequence = 1;
    this.events = [];
  }
  async preflight() {}
  async barrier() {
    this.events.push('barrier');
    if (this.queued) {
      this.rows.set(STATE_SLUG, this.queued);
      this.queued = null;
    }
  }
  async get(id) {
    this.events.push(`get:${id}`);
    return this.rows.get(id) ?? null;
  }
  async put(id, content, options = {}) {
    const current = this.rows.get(id);
    if (options.expectedRevision) assert.equal(options.expectedRevision, current.revision);
    const revision = `storage-${++this.sequence}`;
    if (id === STATE_SLUG && this.failSnapshot) {
      this.failSnapshot = false;
      this.queued = { content, revision };
      throw new Error('Simulated pending snapshot with lost transport receipt');
    }
    if (id !== STATE_SLUG && this.failProjection) {
      this.failProjection = false;
      throw new Error('Simulated interrupted projection');
    }
    this.rows.set(id, { content, revision });
    return { state: 'committed', revision };
  }
  async remove(id) {
    if (this.failDelete) {
      this.failDelete = false;
      throw new Error('Simulated reset cleanup failure');
    }
    this.rows.delete(id);
  }
  async importWorld() {}
  async extractLinks() { this.events.push('extract'); }
}

async function start(db = new MemoryGBrain()) {
  const store = new BrainStore({ db });
  store.seed = async () => validateSeed(world);
  await store.initialize();
  return store;
}

test('actual world typed snapshot survives encoding including singular pharmacy ownership', () => {
  const before = initial();
  const after = decodeState({ content: encodeState(before) });
  assert.deepEqual(after, before);
  assert.ok(after.ownedIds.includes('pharmacy/2026-09-24-medication-record'));
});

test('concurrent retries commit one visit and exact idempotent receipt across restart', async () => {
  const db = new MemoryGBrain();
  const store = await start(db);
  const results = await Promise.all([store.ingest(payload), store.ingest(payload), store.ingest(payload)]);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
  assert.equal(store.state.pages.filter(page => page.id === results[0].visitId).length, 1);
  const restarted = await start(db);
  assert.deepEqual(restarted.view(), store.view());
  assert.deepEqual(await restarted.ingest(payload), results[0]);
  await assert.rejects(restarted.ingest({ ...payload, note: `${payload.note} Changed.` }), error => error.status === 409);
  const medication = restarted.medicationList().medications.find(page => page.id === 'medications/lisinopril');
  assert.equal(medication.dose, '20 mg');
  assert.ok(medication.claims.some(claim => claim.kind === 'pharmacy' && claim.dose === '10 mg'));
  for (const citation of medication.citations) assert.ok(restarted.getPage(citation.pageId).page.body.includes(citation.quote));
});

test('pending snapshot is drained before recovery chooses state', async () => {
  const db = new MemoryGBrain();
  const store = await start(db);
  db.events = [];
  db.failSnapshot = true;
  await assert.rejects(store.ingest(payload), error => error.status === 503);
  await store.recovery;
  assert.equal(store.state.revision, 2);
  assert.equal(store.health().ok, true);
  assert.deepEqual(db.events.slice(0, 2), ['barrier', `get:${STATE_SLUG}`]);
  const result = await store.ingest(payload);
  assert.equal(result.revision, 2);
});

test('fresh process drains a pending snapshot before reading its durable state', async () => {
  const db = new MemoryGBrain();
  const applied = applyIngest(initial(), payload);
  db.queued = { content: encodeState(applied.state), revision: 'pending-storage' };
  const store = await start(db);
  assert.equal(store.view().revision, 2);
  assert.deepEqual(await store.ingest(payload), applied.result);
  assert.deepEqual(db.events.slice(0, 2), ['barrier', `get:${STATE_SLUG}`]);
});

test('committed ingest repairs interrupted entity materialization without duplication', async () => {
  const db = new MemoryGBrain();
  const store = await start(db);
  db.failProjection = true;
  await assert.rejects(store.ingest(payload), error => error.status === 503);
  await store.recovery;
  const result = await store.ingest(payload);
  assert.equal(result.revision, 2);
  assert.ok(db.rows.get(result.visitId).content.includes('care-circle-page'));
  assert.equal(store.state.pages.length, world.pages.length + 2);
});

test('reset tombstones survive failed cleanup and preserve unrelated brain pages', async () => {
  const db = new MemoryGBrain();
  const store = await start(db);
  const applied = await store.ingest(payload);
  db.rows.set('unrelated/synthetic-fixture', { content: 'Do not delete', revision: 'unrelated' });
  db.failDelete = true;
  await assert.rejects(store.reset(), error => error.status === 503);
  await store.recovery;
  const restarted = await start(db);
  assert.equal(restarted.state.pages.length, world.pages.length);
  assert.equal(restarted.state.revision, 3);
  assert.equal(db.rows.has(applied.visitId), false);
  assert.equal(db.rows.has('unrelated/synthetic-fixture'), true);
  assert.ok(restarted.state.ownedIds.includes(applied.visitId));
});

test('corrupt durable metadata fails closed and never imports a seed', async () => {
  const db = new MemoryGBrain();
  db.rows.set(STATE_SLUG, { content: 'corrupt', revision: 'broken' });
  db.importWorld = () => assert.fail('must not silently reseed');
  await assert.rejects(start(db), /Refusing to reseed/);
});

test('shutdown rejects new mutations before they can touch storage', async () => {
  const store = await start();
  store.stopping = true;
  await assert.rejects(store.ingest(payload), error => error.status === 503);
  assert.equal(store.state.revision, 1);
});
