import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const storageKey = 'care-circle-pending-note';

// Exercise the actual app in memory. No HTTP listener or product service is used.
class Element {
  constructor(tagName = 'div', text = '') {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.open = false;
    this.text = text;
    this.classList = { toggle() {} };
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.text = ''; this.children = nodes; }
  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name === 'value') this.value = value;
    if (name === 'id') this.id = value;
  }
  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  }
  async dispatch(name) {
    const event = { target: this, preventDefault() {} };
    return Promise.all((this.listeners.get(name) || []).map(callback => callback(event)));
  }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  querySelectorAll(selector) { return this.descendants().filter(node => node.tagName === selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}

function createHarness(pendingNote) {
  const elements = new Map([...markup.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"/g)]
    .map(([, tag, id]) => [id, new Element(tag)]));
  elements.get('note-author').disabled = true;
  const document = {
    visibilityState: 'visible',
    querySelector(selector) {
      const id = selector.slice(1);
      return elements.get(id) || [...elements.values()].flatMap(node => node.descendants()).find(node => node.id === id) || null;
    },
    querySelectorAll(selector) {
      if (selector === '#note-author option') return elements.get('note-author').querySelectorAll('option');
      if (selector === 'dialog') return [...elements.values()].filter(node => node.tagName === 'dialog');
      return [];
    },
    getElementById(id) { return this.querySelector(`#${id}`); },
    createElement: tag => new Element(tag),
    createElementNS: (_, tag) => new Element(tag),
    createTextNode: text => new Element('#text', text),
  };
  const storage = new Map(pendingNote ? [[storageKey, JSON.stringify(pendingNote)]] : []);
  const requests = [];
  const context = vm.createContext({
    document,
    Node: Element,
    AbortSignal,
    URL,
    crypto: webcrypto,
    window: { print() {} },
    setInterval() {},
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    fetch: (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })),
  });
  const boot = vm.runInContext(`(async () => {\n${source}\n})()`, context);
  function reply(path, value, status = 200) {
    const index = requests.findIndex(request => request.path === `/api/${path}`);
    assert.notEqual(index, -1, `No pending request for ${path}`);
    const [request] = requests.splice(index, 1);
    request.resolve({ ok: status >= 200 && status < 300, status, json: async () => value });
    return request;
  }
  return { boot, document, storage, requests, reply };
}

const family = {
  patientId: 'people/rose-alvarez',
  revision: 1,
  pages: [
    { id: 'people/rose-alvarez', type: 'patient', title: 'Rose Alvarez' },
    { id: 'people/ana-alvarez', type: 'person', title: 'Ana Alvarez' },
    { id: 'people/ben-alvarez', type: 'person', title: 'Ben Alvarez' },
  ],
  graph: { nodes: [], edges: [] },
};
const medications = { medications: [{ id: 'medications/lisinopril', name: 'Lisinopril', dose: '10 mg', frequency: 'daily', status: 'active', citations: [] }] };
const failure = message => ({ error: { code: 'SYNTHETIC_FAILURE', message } });

function finishInitial(harness, { familyFailure = false, sponsorFailure = false } = {}) {
  harness.reply('brain/state', familyFailure ? failure('Synthetic family state failure.') : family, familyFailure ? 503 : 200);
  harness.reply('brain/medications', medications);
  harness.reply('brief/contradictions', { contradictions: [] });
  harness.reply('river/status', { mode: 'deterministic', trainingStatus: 'not_started', limitations: [] });
  harness.reply('sponsors/status', sponsorFailure ? failure('Synthetic sponsor status failure.') : { memorable: { mode: 'local-simulation' }, ufo: { mode: 'local-http-fetch' } }, sponsorFailure ? 503 : 200);
}

test('a completed alert refresh cannot replace a medication failure with cached doses', async () => {
  const harness = createHarness();
  finishInitial(harness, { familyFailure: true });
  await harness.boot;
  const medicationList = harness.document.querySelector('#medication-list');
  assert.match(medicationList.textContent, /10 mg/);

  const refresh = harness.document.querySelector('#graph').querySelector('button').dispatch('click');
  harness.reply('brain/state', family);
  harness.reply('brain/medications', failure('Synthetic medication fetch failure.'), 503);
  await nextTurn();
  assert.match(medicationList.textContent, /Synthetic medication fetch failure/);
  harness.reply('brief/contradictions', { contradictions: [{ medicationId: 'medications/lisinopril', title: 'Sources disagree', claims: [] }] });
  await refresh;

  assert.match(medicationList.textContent, /Synthetic medication fetch failure/);
  assert.doesNotMatch(medicationList.textContent, /10 mg/);
});

test('an unknown save is restored before initial requests settle and retains its retry identity', async () => {
  const pending = {
    payload: { note: 'Synthetic note from Ben awaiting confirmation.', authorId: 'people/ben-alvarez', date: '2026-09-27' },
    key: 'synthetic-retry-key',
  };
  const harness = createHarness(pending);
  assert.equal(harness.requests.length, 5, 'All initial requests remain unresolved');
  assert.equal(harness.document.querySelector('#note-input').value, pending.payload.note);
  assert.match(harness.document.querySelector('#note-status').textContent, /previous save was not confirmed/);
  assert.equal(harness.storage.get(storageKey), JSON.stringify(pending));

  finishInitial(harness);
  await harness.boot;
  assert.equal(harness.document.querySelector('#note-author').value, pending.payload.authorId);
  const review = harness.document.querySelector('#note-form').dispatch('submit');
  harness.reply('ingest/extract', { extraction: { visit: { summary: 'Synthetic reviewed visit.' }, medicationChanges: [], questions: [], followUps: [] }, method: 'deterministic', warnings: [] });
  await review;
  const save = harness.document.querySelector('#save-note').dispatch('click');
  const request = harness.reply('ingest/ingest', failure('Synthetic uncertain save.'), 503);
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(payload, { ...pending.payload, idempotencyKey: pending.key });
  await save;
  assert.equal(harness.storage.get(storageKey), JSON.stringify(pending));
});

for (const sponsorFailure of [false, true]) {
  test(`late initial sponsor status ${sponsorFailure ? 'failure' : 'success'} preserves newer action evidence`, async () => {
    const harness = createHarness();
    const capture = harness.document.querySelector('#capture-procedure').dispatch('click');
    harness.reply('sponsors/procedure/capture', { procedureId: 'synthetic-procedure', steps: ['Check the synthetic request.'], mode: 'local-simulation', evidence: { synthetic: true } });
    const lookup = harness.document.querySelector('#fetch-clinic').dispatch('click');
    harness.reply('sponsors/clinic/fetch', { clinic: { name: 'Fictional clinic', hours: 'Synthetic hours', phone: 'Synthetic phone' }, mode: 'local-http-fetch', sourceUrl: 'http://127.0.0.1:4706/' });
    await Promise.all([capture, lookup]);
    const procedure = harness.document.querySelector('#procedure-details').textContent;
    const clinic = harness.document.querySelector('#clinic-details').textContent;
    assert.match(procedure, /Local procedure captured with Ana/);
    assert.match(clinic, /Fictional clinic/);

    finishInitial(harness, { sponsorFailure });
    await harness.boot;
    assert.equal(harness.document.querySelector('#procedure-details').textContent, procedure);
    assert.equal(harness.document.querySelector('#clinic-details').textContent, clinic);
  });
}
