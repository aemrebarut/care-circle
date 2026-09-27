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
  contains(node) { return node === this || this.descendants().includes(node); }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
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
    createElement: tag => Object.assign(new Element(tag), { ownerDocument: document }),
    createElementNS: (_, tag) => Object.assign(new Element(tag), { ownerDocument: document }),
    createTextNode: text => Object.assign(new Element('#text', text), { ownerDocument: document }),
  };
  for (const element of elements.values()) element.ownerDocument = document;
  const storage = new Map(pendingNote ? [[storageKey, JSON.stringify(pendingNote)]] : []);
  const requests = [];
  const intervals = [];
  const context = vm.createContext({
    document,
    Node: Element,
    AbortSignal,
    URL,
    crypto: webcrypto,
    window: { print() {} },
    setInterval(callback) { intervals.push(callback); },
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
  return { boot, document, storage, requests, reply, intervals };
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
  assert.match(harness.document.querySelector('#note-status').textContent, /earlier save is still unconfirmed/);
  harness.reply('ingest/extract', { extraction: { visit: { summary: 'Synthetic reviewed visit.' }, medicationChanges: [], questions: [], followUps: [] }, method: 'deterministic', warnings: [] });
  await review;
  assert.match(harness.document.querySelector('#note-status').textContent, /earlier save is still unconfirmed/);
  assert.doesNotMatch(harness.document.querySelector('#note-status').textContent, /Nothing has been saved|family record is unchanged/);
  const save = harness.document.querySelector('#save-note').dispatch('click');
  const request = harness.reply('ingest/ingest', failure('Synthetic uncertain save.'), 503);
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(payload, { ...pending.payload, idempotencyKey: pending.key });
  await save;
  assert.equal(harness.storage.get(storageKey), JSON.stringify(pending));
});

test('a malformed review does not deny an earlier unknown save', async () => {
  const pending = { payload: { note: 'Synthetic pending note.', authorId: 'people/ana-alvarez', date: '2026-09-27' }, key: 'pending-malformed-review' };
  const harness = createHarness(pending);
  finishInitial(harness);
  await harness.boot;
  const review = harness.document.querySelector('#note-form').dispatch('submit');
  harness.reply('ingest/extract', { extraction: {}, method: 'deterministic' });
  await review;
  const status = harness.document.querySelector('#note-status').textContent;
  assert.match(status, /This review did not save a note/);
  assert.match(status, /earlier save is still unconfirmed/);
  assert.doesNotMatch(status, /Nothing has been saved|family record is unchanged/);
  assert.equal(harness.storage.get(storageKey), JSON.stringify(pending));
});

test('the brief preserves each discrepant dose, frequency, date and source for print', async () => {
  const harness = createHarness();
  finishInitial(harness);
  await harness.boot;
  const preparing = harness.document.querySelector('#generate-brief').dispatch('click');
  const claims = [
    { sourceId: 'visits/synthetic-sep27', kind: 'visit', dose: '20 mg', frequency: 'daily', date: '2026-09-27', citation: { pageId: 'visits/synthetic-sep27', title: 'Synthetic cardiology visit', date: '2026-09-27' } },
    { sourceId: 'pharmacy/synthetic-sep24', kind: 'pharmacy', dose: '10 mg', frequency: 'daily', date: '2026-09-24', citation: { pageId: 'pharmacy/synthetic-sep24', title: 'Synthetic pharmacy fill', date: '2026-09-24' } },
  ];
  harness.reply('brief/previsit', { title: 'Synthetic previsit', generatedAt: '2026-09-27', since: '2026-09-15', medicationChanges: [], otherVisits: [], openQuestions: [], contradictions: [{ title: 'Unresolved lisinopril discrepancy', temporalStatus: 'past-discrepancy-unreconciled', description: 'Latest records now agree, but the earlier discrepancy has no source-cited reconciliation.', claims }], warnings: ['Synthetic record limitation.'] });
  await preparing;
  const content = harness.document.querySelector('#brief-content');
  const rows = content.descendants().filter(node => node.className === 'claim-record');
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /20 mg daily · Visit claim · Sep 27.*Synthetic cardiology visit/);
  assert.match(rows[1].textContent, /10 mg daily · Pharmacy claim · Sep 24.*Synthetic pharmacy fill/);
  assert.match(content.textContent, /Latest records now agree, but the earlier discrepancy has no source-cited reconciliation/);
  assert.match(content.textContent, /Synthetic record limitation/);
  const index = content.descendants().find(node => node.className === 'print-sources');
  for (const claim of claims) assert.ok(index.textContent.includes(`[${claim.sourceId}]`));
  const opening = rows[1].querySelector('button').dispatch('click');
  harness.reply(`brain/pages/${encodeURIComponent(claims[1].sourceId)}`, { page: { id: claims[1].sourceId, title: claims[1].citation.title, type: 'pharmacy', fields: {}, body: 'Synthetic pharmacy claim.' } });
  await opening;
  assert.match(harness.document.querySelector('#source-content').textContent, /Synthetic pharmacy fill/);
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

test('cached River output is identified as replay in both status and reviewed extraction', async () => {
  const harness = createHarness();
  harness.reply('brain/state', family);
  harness.reply('brain/medications', medications);
  harness.reply('brief/contradictions', { contradictions: [] });
  harness.reply('sponsors/status', { memorable: { mode: 'local-simulation' }, ufo: { mode: 'local-http-fetch' } });
  harness.reply('river/status', {
    mode: 'river', trainingStatus: 'completed', extractionAvailable: true, extractionMode: 'cached-replay',
    replay: { mode: 'cached-replay', liveInference: false }, limitations: [],
    metrics: { paired: true, audit: { verified: true }, base: { counts: { examples: 72, taskExact: 0 } }, trained: { counts: { examples: 72, taskExact: 71 } }, generationOutcomes: { base: { length: 54 } }, protocol: { generation: { max_tokens: 1024 } } },
  });
  await harness.boot;
  assert.equal(harness.document.querySelector('#river-mode').textContent, 'River cached replay');
  const status = harness.document.querySelector('#river-details').textContent;
  assert.match(status, /No live inference occurs/);
  assert.match(status, /0\/72/);
  assert.match(status, /71\/72/);
  assert.match(status, /54 base responses reached the token cap/);
  assert.match(status, /not clinical accuracy/);

  harness.document.querySelector('#note-input').value = 'Synthetic cached note.';
  const review = harness.document.querySelector('#note-form').dispatch('submit');
  harness.reply('ingest/extract', {
    extraction: { visit: { summary: 'Synthetic cached note.' }, medicationChanges: [], questions: [], followUps: [] },
    method: 'river', warnings: [], provenance: { mode: 'cached-replay', liveInference: false },
  });
  await review;
  const preview = harness.document.querySelector('#note-preview').textContent;
  assert.match(preview, /River cached replay/);
  assert.match(preview, /No live inference occurred/);
});

test('a failed source comparison does not label fresh medication rows from an old discrepancy', async () => {
  const harness = createHarness();
  harness.reply('brain/state', failure('Synthetic family unavailable.'), 503);
  harness.reply('brain/medications', medications);
  harness.reply('brief/contradictions', { contradictions: [{ medicationId: 'medications/lisinopril', title: 'Sources disagree', claims: [] }] });
  harness.reply('river/status', { mode: 'deterministic', limitations: [] });
  harness.reply('sponsors/status', { memorable: { mode: 'local-simulation' }, ufo: { mode: 'local-http-fetch' } });
  await harness.boot;
  const list = harness.document.querySelector('#medication-list');
  assert.match(list.textContent, /Sources disagree/);

  const refresh = harness.document.querySelector('#graph').querySelector('button').dispatch('click');
  harness.reply('brain/state', family);
  harness.reply('brain/medications', medications);
  harness.reply('brief/contradictions', failure('Synthetic comparison unavailable.'), 503);
  await refresh;
  assert.match(list.textContent, /10 mg/);
  assert.doesNotMatch(list.textContent, /Sources disagree/);
  assert.match(harness.document.querySelector('#alerts').textContent, /Synthetic comparison unavailable/);
});

test('late startup replies cannot overwrite records refreshed after a confirmed save', async () => {
  const harness = createHarness();
  harness.document.querySelector('#note-input').value = 'Synthetic note saved before initial reads finish.';
  const review = harness.document.querySelector('#note-form').dispatch('submit');
  harness.reply('ingest/extract', { extraction: { visit: { summary: 'Synthetic visit.' }, medicationChanges: [], questions: [], followUps: [] }, method: 'deterministic', warnings: [] });
  await review;
  const save = harness.document.querySelector('#save-note').dispatch('click');
  harness.reply('ingest/ingest', { applied: { ok: true, visitId: 'visits/synthetic-new', revision: 2, changedPageIds: ['visits/synthetic-new'] } });
  await nextTurn();
  function latest(path, value) {
    const index = harness.requests.findLastIndex(request => request.path === `/api/${path}`);
    assert.notEqual(index, -1);
    const [request] = harness.requests.splice(index, 1);
    request.resolve({ ok: true, status: 200, json: async () => value });
  }
  latest('brain/state', { ...family, revision: 2 });
  latest('brain/medications', { medications: [{ ...medications.medications[0], dose: '20 mg' }] });
  latest('brief/contradictions', { contradictions: [] });
  await save;
  assert.match(harness.document.querySelector('#medication-list').textContent, /20 mg/);
  finishInitial(harness);
  await harness.boot;
  assert.match(harness.document.querySelector('#medication-list').textContent, /20 mg/);
  assert.doesNotMatch(harness.document.querySelector('#medication-list').textContent, /10 mg/);
  assert.match(harness.document.querySelector('#note-status').textContent, /Saved to the family brain/);
});

test('source narrative keeps source HTML inert and preserves the original Markdown', async () => {
  const harness = createHarness();
  const sourceId = 'visits/synthetic-source';
  harness.reply('brain/state', family);
  harness.reply('brain/medications', { medications: [{ ...medications.medications[0], citations: [{ pageId: sourceId, title: 'Synthetic source', quote: 'Recorded source quote.' }] }] });
  harness.reply('brief/contradictions', { contradictions: [] });
  harness.reply('river/status', { mode: 'deterministic', limitations: [] });
  harness.reply('sponsors/status', { memorable: { mode: 'local-simulation' }, ufo: { mode: 'local-http-fetch' } });
  await harness.boot;
  const opening = harness.document.querySelector('#medication-list').querySelector('button').dispatch('click');
  const body = '# Synthetic source\n\n<script>untrustedSource()</script>\n\nRecorded by [[people/ana-alvarez]].\n\n[[javascript:unsafe]]';
  harness.reply(`brain/pages/${encodeURIComponent(sourceId)}`, { page: { id: sourceId, type: 'visit', title: 'Synthetic source', body, fields: {}, links: [] } });
  await opening;
  const drawer = harness.document.querySelector('#source-content');
  assert.match(drawer.textContent, /<script>untrustedSource\(\)<\/script>/);
  assert.equal(drawer.querySelectorAll('script').length, 0);
  assert.ok(drawer.querySelectorAll('pre').some(node => node.textContent === body));
  assert.ok(drawer.querySelectorAll('button').some(node => node.textContent === 'Ana Alvarez'));
  assert.match(drawer.textContent, /\[\[javascript:unsafe\]\]/);
});

test('source navigation preserves heading focus without stealing it after the drawer closes', async () => {
  const harness = createHarness();
  harness.reply('brain/state', family);
  harness.reply('brain/medications', { medications: [{ ...medications.medications[0], citations: [{ pageId: 'visits/source-one', title: 'First source' }] }] });
  harness.reply('brief/contradictions', { contradictions: [] });
  harness.reply('river/status', { mode: 'deterministic', limitations: [] });
  harness.reply('sponsors/status', { memorable: { mode: 'local-simulation' }, ufo: { mode: 'local-http-fetch' } });
  await harness.boot;
  const opening = harness.document.querySelector('#medication-list').querySelector('button').dispatch('click');
  harness.reply('brain/pages/visits%2Fsource-one', { page: { id: 'visits/source-one', type: 'visit', title: 'First source', fields: {}, body: 'Synthetic source one.', links: [{ target: 'people/ben-alvarez', type: 'attended' }] } });
  await opening;
  assert.equal(harness.document.activeElement, harness.document.querySelector('#source-title'));
  const link = harness.document.querySelector('#source-content').querySelector('button');
  link.focus();
  const following = link.dispatch('click');
  assert.equal(harness.document.activeElement, harness.document.querySelector('#source-title'));
  harness.reply('brain/pages/people%2Fben-alvarez', { page: { id: 'people/ben-alvarez', type: 'person', title: 'Ben Alvarez', fields: {}, body: 'Synthetic family member.', links: [{ target: 'people/ana-alvarez', type: 'mentions' }] } });
  await following;
  assert.equal(harness.document.activeElement, harness.document.querySelector('#source-title'));
  assert.equal(harness.document.activeElement.textContent, 'Ben Alvarez');
  const nextSource = harness.document.querySelector('#source-content').querySelector('button').dispatch('click');
  harness.document.querySelector('#source-drawer').close();
  const outside = harness.document.querySelector('#review-note');
  outside.focus();
  harness.reply('brain/pages/people%2Fana-alvarez', { page: { id: 'people/ana-alvarez', type: 'person', title: 'Ana Alvarez', fields: {}, body: 'Synthetic family member.' } });
  await nextSource;
  assert.equal(harness.document.activeElement, outside);
  assert.equal(harness.document.querySelector('#source-drawer').open, false);
});

test('River polling preserves expanded evidence and keyboard focus', async () => {
  const harness = createHarness();
  finishInitial(harness);
  await harness.boot;
  const container = harness.document.querySelector('#river-details');
  const original = container.querySelector('details');
  original.open = true;
  original.querySelector('summary').focus();
  harness.intervals[0]();
  harness.reply('river/status', { mode: 'deterministic', trainingStatus: 'not_started', limitations: [] });
  await nextTurn();
  assert.equal(container.querySelector('details'), original, 'Unchanged status must not rebuild the evidence');
  harness.intervals[0]();
  harness.reply('river/status', { mode: 'deterministic', trainingStatus: 'completed', limitations: ['Synthetic updated limitation.'] });
  await nextTurn();
  const updated = container.querySelector('details');
  assert.equal(updated.open, true);
  assert.equal(harness.document.activeElement, updated.querySelector('summary'));
  assert.match(updated.textContent, /Synthetic updated limitation/);
});
