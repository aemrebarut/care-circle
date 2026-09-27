import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(await readFile(join(root, 'seed.json'), 'utf8'));
const { patientId, pages } = seed;
const byId = new Map(pages.map((p) => [p.id, p]));
const types = new Set(['patient', 'person', 'doctor', 'medication', 'visit', 'lab', 'insurer-call', 'question', 'pharmacy']);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const wikiRefs = (body) => [...body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1]);
const count = (type) => pages.filter((p) => p.type === type).length;
assert.equal(patientId, 'people/rose-alvarez');
assert.equal(byId.size, pages.length, 'Page IDs must be unique');
for (const [type, expected] of Object.entries({ patient: 1, person: 3, doctor: 4, medication: 7, visit: 6, 'insurer-call': 2, lab: 3, pharmacy: 1, question: 3 })) {
  assert.equal(count(type), expected, `${type} count`);
}
let citations = 0;
let links = 0;
function references(value, owner, key = '') {
  if (Array.isArray(value)) return value.forEach((v) => references(v, owner, key.endsWith('Ids') ? key.slice(0, -1) : key));
  if (value && typeof value === 'object') return Object.entries(value).forEach(([k, v]) => references(v, owner, k));
  if (key.endsWith('Id') && typeof value === 'string') assert.ok(byId.has(value), `${owner}: unresolved ${key} ${value}`);
}
for (const p of pages) {
  assert.match(p.id, idPattern);
  assert.ok(types.has(p.type), `${p.id}: unsupported page type`);
  assert.ok(p.title.trim());
  assert.equal(p.fields.synthetic, true);
  assert.match(p.updatedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.ok(Number.isFinite(Date.parse(p.updatedAt)));
  assert.ok(p.body.includes('Not medical advice'));
  assert.ok(p.body.includes('fictional demo data'));
  assert.doesNotMatch(JSON.stringify(p), /[\u2013\u2014]/);
  references(p.fields, p.id);
  const visible = new Set(wikiRefs(p.body));
  for (const id of visible) assert.ok(byId.has(id), `${p.id}: missing wikilink ${id}`);
  for (const link of p.links) {
    assert.ok(byId.has(link.target), `${p.id}: missing graph link ${link.target}`);
    assert.ok(visible.has(link.target), `${p.id}: graph link absent from human markdown ${link.target}`);
    assert.ok(['mentions', 'attended'].includes(link.type));
    links++;
  }
  assert.equal(new Set(p.links.map((l) => l.target)).size, p.links.length);
  const raw = await readFile(join(root, 'pages', `${p.id}.md`), 'utf8');
  const matches = [...raw.matchAll(/\n```care-circle-page\n([\s\S]*?)\n```\n/g)];
  assert.equal(matches.length, 1, `${p.id}: one metadata fence`);
  const { body, ...metadata } = p;
  assert.deepEqual(JSON.parse(matches[0][1]), metadata, `${p.id}: metadata persistence parity`);
  assert.equal(raw.slice(0, matches[0].index), body, `${p.id}: source body parity`);
  if (p.fields.date) {
    assert.match(p.fields.date, datePattern);
    assert.ok(p.fields.date < '2026-09-27', `${p.id}: demo day must remain ingest-only`);
  }
  if (p.type === 'visit') {
    assert.equal(byId.get(p.fields.doctorId).type, 'doctor');
    for (const id of p.fields.attendeeIds) assert.equal(byId.get(id).type, 'person');
  }
  if (p.type === 'doctor') {
    const dates = pages.filter((v) => v.type === 'visit' && v.fields.doctorId === p.id).map((v) => v.fields.date).sort();
    assert.equal(p.fields.lastVisitDate, dates.at(-1), `${p.id}: latest visit date`);
    assert.ok(p.fields.nextVisitDate > p.fields.lastVisitDate);
  }
  if (p.type === 'medication') {
    assert.equal(p.fields.status, 'active');
    assert.equal(p.fields.claims.length, p.fields.citations.length);
    for (let i = 0; i < p.fields.claims.length; i++) {
      const claim = p.fields.claims[i];
      const source = byId.get(claim.sourceId);
      const citation = p.fields.citations[i];
      assert.equal(source.type, claim.kind);
      assert.equal(source.fields.date, claim.date);
      assert.deepEqual(source.fields.attendeeIds, claim.attendeeIds);
      assert.equal(citation.pageId, source.id);
      assert.equal(citation.title, source.title);
      assert.equal(citation.date, source.fields.date);
      assert.deepEqual(citation.attendeeIds, claim.attendeeIds);
      assert.ok(source.body.includes(citation.quote), `${p.id}: quotation absent from ${source.id}`);
      citations++;
    }
    const currentVisit = p.fields.claims.filter((c) => c.kind === 'visit').sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const currentPharmacy = p.fields.claims.filter((c) => c.kind === 'pharmacy').at(-1);
    for (const claim of [currentVisit, currentPharmacy]) {
      assert.equal(claim.dose, p.fields.dose, `${p.id}: baseline current sources agree`);
      assert.equal(claim.frequency, p.fields.frequency);
    }
  }
  if (p.type === 'question') {
    assert.equal(p.fields.status, 'open');
    assert.equal(byId.get(p.fields.doctorId).type, 'doctor');
  }
  if (p.type === 'lab') {
    assert.equal(typeof p.fields.value, 'number');
    assert.equal(p.fields.interpretation, null);
    const source = byId.get(p.fields.sourceId);
    assert.equal(source.id, p.id, `${p.id}: original synthetic report is its own result source`);
    assert.equal(p.fields.recordKind, 'original-synthetic-lab-report');
    assert.ok(source.body.includes(`${p.fields.name} is recorded as ${p.fields.value} ${p.fields.unit} on ${p.fields.date}.`));
    assert.equal(byId.get(p.fields.associatedVisitId).type, 'visit');
    assert.ok(p.fields.date >= byId.get(p.fields.associatedVisitId).fields.date);
  }
}
const neph = byId.get('doctors/nephrologist');
assert.deepEqual(byId.get(patientId).fields.childIds, ['people/ana-alvarez', 'people/ben-alvarez', 'people/celia-alvarez']);
assert.equal(byId.get(patientId).fields.siblingIds, undefined);
assert.equal(neph.fields.lastVisitDate, '2026-09-15');
assert.equal(neph.fields.nextVisitDate, '2026-09-29');
const lisinopril = byId.get('medications/lisinopril');
assert.equal(lisinopril.fields.dose, '10 mg');
assert.equal(lisinopril.fields.frequency, 'daily');
assert.ok(lisinopril.fields.claims.every((c) => c.dose === '10 mg' && c.frequency === 'daily'));
const change = byId.get('visits/2026-09-23-cardiology').fields.medicationChanges[0];
assert.equal(change.previousDose, '2.5 mg');
assert.equal(change.dose, '5 mg');
assert.equal(byId.get(change.medicationId).fields.dose, change.dose);
assert.equal(byId.get('insurer-calls/2026-09-22-follow-up').fields.reference, byId.get('insurer-calls/2026-09-18-prior-authorization').fields.reference);
const markdownFiles = [];
async function inspectFiles(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await inspectFiles(path);
    else {
      const content = await readFile(path, 'utf8');
      assert.doesNotMatch(content, /[\u2013\u2014]/, `Forbidden dash in ${relative(root, path)}`);
      if (path.endsWith('.md') && path.startsWith(join(root, 'pages'))) markdownFiles.push(path);
    }
  }
}
await inspectFiles(root);
assert.equal(markdownFiles.length, pages.length, 'No extra or missing source page files');
console.log(`world smoke passed: ${pages.length} pages, ${links} resolvable links, ${citations} exact source citations; baseline, dates, metadata, and framing verified.`);
