import { createHash } from 'node:crypto';
import { DEMO_DATE } from '../../contract/index.mjs';

const PAGE_TYPES = new Set(['patient', 'person', 'doctor', 'medication', 'visit', 'lab', 'insurer-call', 'question', 'pharmacy']);
const LINK_TYPES = new Set(['mentions', 'attended']);
const ID = /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)+$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function invalid(message) {
  throw new HttpError(400, 'invalid_request', message);
}

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(`${label} must be an object.`);
  return value;
}

function keys(value, permitted, label) {
  object(value, label);
  if (Object.keys(value).some(key => !permitted.includes(key))) invalid(`${label} contains unsupported fields.`);
}

function text(value, label, maximum = 2000, { empty = false } = {}) {
  if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim())
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    invalid(`${label} must be ${empty ? 'a' : 'a nonempty'} string of at most ${maximum} characters.`);
  }
  return value;
}

function array(value, label, maximum = 50) {
  if (!Array.isArray(value) || value.length > maximum) invalid(`${label} must be an array of at most ${maximum} items.`);
  return value;
}

function slug(value, label) {
  if (typeof value !== 'string' || value.length > 200 || !ID.test(value)) invalid(`${label} must be a safe page ID.`);
  return value;
}

function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${label} must be a calendar date in YYYY-MM-DD format.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value.startsWith('0000')) {
    invalid(`${label} must be a real calendar date.`);
  }
  return value;
}

function reference(index, value, label, types) {
  slug(value, label);
  const page = index.get(value);
  if (!page || (types && !types.includes(page.type))) invalid(`${label} must reference a known ${types?.join(' or ') ?? 'source'} page.`);
  return page;
}

function attendees(index, value, label) {
  array(value, label, 30).forEach(id => reference(index, id, label, ['person', 'patient']));
  if (new Set(value).size !== value.length) invalid(`${label} must not contain duplicate people.`);
}

// Sorting entries instead of assigning keys also handles a literal __proto__ key safely.
export function canonicalJson(value) {
  const parents = new Set();
  function encode(item, depth) {
    if (depth > 32) invalid('JSON is nested too deeply.');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || item === null) invalid('Only JSON values are accepted.');
    if (parents.has(item)) invalid('JSON must not contain circular references.');
    parents.add(item);
    let output;
    if (Array.isArray(item)) {
      const values = Array.from(item, child => encode(child, depth + 1));
      output = `[${values.join(',')}]`;
    } else {
      object(item, 'JSON value');
      output = `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${encode(item[key], depth + 1)}`).join(',')}}`;
    }
    parents.delete(item);
    return output;
  }
  return encode(value, 0);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function pageIndex(pages) {
  array(pages, 'pages', 10000);
  const index = new Map();
  for (const page of pages) {
    object(page, 'page');
    slug(page.id, 'page.id');
    if (index.has(page.id)) invalid(`Duplicate page ID: ${page.id}.`);
    index.set(page.id, page);
  }
  return index;
}

function validateClaim(claim, index, label) {
  object(claim, label);
  text(claim.dose, `${label}.dose`, 200);
  text(claim.frequency, `${label}.frequency`, 300);
  date(claim.date, `${label}.date`);
  const source = reference(index, claim.sourceId, `${label}.sourceId`);
  text(claim.kind, `${label}.kind`, 80);
  if (claim.kind === 'visit' && source.type !== 'visit') invalid(`${label} visit claim must reference a visit.`);
  if (claim.kind === 'pharmacy' && source.type !== 'pharmacy') invalid(`${label} pharmacy claim must reference a pharmacy record.`);
  attendees(index, claim.attendeeIds, `${label}.attendeeIds`);
}

function validateCitation(citation, index, label) {
  object(citation, label);
  const source = reference(index, citation.pageId, `${label}.pageId`);
  text(citation.title, `${label}.title`, 500);
  text(citation.quote, `${label}.quote`, 5000);
  if (typeof source.body !== 'string' || !source.body.includes(citation.quote)) invalid(`${label}.quote must be a literal source excerpt.`);
  if (citation.date !== undefined) date(citation.date, `${label}.date`);
  if (citation.attendeeIds !== undefined) attendees(index, citation.attendeeIds, `${label}.attendeeIds`);
}

export function validateSeed(seed) {
  object(seed, 'seed');
  const pages = clone(array(seed.pages, 'seed.pages', 10000));
  if (!pages.length) invalid('seed.pages must not be empty.');
  const index = pageIndex(pages);
  reference(index, seed.patientId, 'seed.patientId', ['patient']);
  for (const page of pages) {
    if (!PAGE_TYPES.has(page.type)) invalid(`Unsupported page type on ${page.id}.`);
    text(page.title, 'page.title', 500);
    text(page.body, 'page.body', 200000, { empty: true });
    object(page.fields, 'page.fields');
    array(page.links, 'page.links', 2000);
    if (typeof page.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(page.updatedAt)
      || !Number.isFinite(Date.parse(page.updatedAt))) invalid('page.updatedAt must be an ISO UTC timestamp.');
    date(page.updatedAt.slice(0, 10), 'page.updatedAt date');
    for (const link of page.links) {
      object(link, 'page link');
      reference(index, link.target, 'link.target');
      if (!LINK_TYPES.has(link.type)) invalid('Only mentions and attended links are supported.');
    }
    const fields = page.fields;
    for (const key of ['date', 'lastVisitDate', 'nextVisitDate']) {
      if (fields[key] !== undefined && fields[key] !== null) date(fields[key], `fields.${key}`);
    }
    for (const key of ['patientId', 'sourceId', 'recordedSourceId']) {
      if (fields[key] !== undefined) reference(index, fields[key], `fields.${key}`);
    }
    for (const key of ['authorId', 'ownerId', 'recordedBy']) {
      if (fields[key] !== undefined) reference(index, fields[key], `fields.${key}`, ['person', 'patient']);
    }
    if (fields.doctorId !== undefined) reference(index, fields.doctorId, 'fields.doctorId', ['doctor']);
    if (fields.attendeeIds !== undefined) attendees(index, fields.attendeeIds, 'fields.attendeeIds');
    if (fields.medicationChanges !== undefined) {
      array(fields.medicationChanges, 'fields.medicationChanges').forEach(change => {
        object(change, 'medication change');
        reference(index, change.medicationId, 'medicationChanges.medicationId', ['medication']);
      });
    }
    if (fields.followUps !== undefined) {
      array(fields.followUps, 'fields.followUps').forEach(followUp => {
        object(followUp, 'followUp');
        text(followUp.text, 'followUps.text', 2000);
        if (followUp.dueDate !== undefined) date(followUp.dueDate, 'followUps.dueDate');
      });
    }
    if (fields.claims !== undefined) array(fields.claims, 'fields.claims', 10000).forEach(claim => validateClaim(claim, index, 'claim'));
    if (fields.citations !== undefined) array(fields.citations, 'fields.citations', 10000).forEach(citation => validateCitation(citation, index, 'citation'));
    if (page.type === 'medication') {
      for (const key of ['name', 'dose', 'frequency', 'status']) text(fields[key], `medication.${key}`, 300);
      array(fields.claims, 'medication.claims', 10000);
    }
  }
  return { patientId: seed.patientId, pages };
}

function validatePayload(payload, index) {
  keys(payload, ['extraction', 'note', 'authorId', 'idempotencyKey'], 'payload');
  text(payload.idempotencyKey, 'idempotencyKey', 200);
  text(payload.note, 'note', 20000);
  reference(index, payload.authorId, 'authorId', ['person']);
  const extraction = payload.extraction;
  keys(extraction, ['visit', 'medicationChanges', 'questions', 'followUps'], 'extraction');
  keys(extraction.visit, ['date', 'doctorId', 'attendeeIds', 'summary'], 'extraction.visit');
  const visit = extraction.visit;
  date(visit.date, 'visit.date');
  if (visit.date > DEMO_DATE) throw new HttpError(422, 'future_visit_date', `Visit dates after the demo as-of date ${DEMO_DATE} cannot change the family record.`);
  reference(index, visit.doctorId, 'visit.doctorId', ['doctor']);
  attendees(index, visit.attendeeIds, 'visit.attendeeIds');
  text(visit.summary, 'visit.summary', 5000);
  const medications = new Set();
  for (const change of array(extraction.medicationChanges, 'medicationChanges', 30)) {
    keys(change, ['medicationId', 'name', 'dose', 'frequency'], 'medication change');
    const medication = reference(index, change.medicationId, 'medicationId', ['medication']);
    if (medications.has(change.medicationId)) invalid('Only one change per medication is allowed in a visit.');
    medications.add(change.medicationId);
    text(change.name, 'medication change name', 300);
    if (change.name.trim().toLowerCase() !== medication.fields.name.trim().toLowerCase()) invalid('Medication name must match the referenced medication.');
    text(change.dose, 'medication change dose', 200);
    text(change.frequency, 'medication change frequency', 300);
  }
  for (const question of array(extraction.questions, 'questions', 50)) {
    keys(question, ['doctorId', 'text'], 'question');
    reference(index, question.doctorId, 'question.doctorId', ['doctor']);
    text(question.text, 'question.text', 2000);
  }
  for (const followUp of array(extraction.followUps, 'followUps', 50)) {
    keys(followUp, ['text', 'dueDate'], 'followUp');
    text(followUp.text, 'followUp.text', 2000);
    if (followUp.dueDate !== undefined) date(followUp.dueDate, 'followUp.dueDate');
  }
}

function linkTo(target, type = 'mentions') {
  return { target, type };
}

function addLinks(page, links) {
  const known = new Set(page.links.map(link => `${link.type}:${link.target}`));
  for (const link of links) {
    const key = `${link.type}:${link.target}`;
    if (!known.has(key)) {
      page.links.push(link);
      known.add(key);
    }
  }
}

function latestVisitClaim(claims) {
  return claims.reduce((latest, claim) => claim.kind === 'visit' && (!latest || claim.date >= latest.date) ? claim : latest, null);
}

function excerptWindow(value, name, dose) {
  const maximum = 1200;
  if (value.length <= maximum) return value;
  const ranges = term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...value.matchAll(new RegExp(escaped, 'giu'))].map(match => ({ start: match.index, end: match.index + match[0].length }));
  };
  const names = ranges(name);
  const doses = ranges(dose);
  let closest;
  for (let i = 0, j = 0; i < names.length && j < doses.length;) {
    const pair = { start: Math.min(names[i].start, doses[j].start), end: Math.max(names[i].end, doses[j].end) };
    if (!closest || pair.end - pair.start < closest.end - closest.start) closest = pair;
    if (names[i].start <= doses[j].start) i += 1;
    else j += 1;
  }
  const support = closest && closest.end - closest.start <= maximum
    ? closest : doses[0] ?? names[0] ?? { start: 0, end: 0 };
  const padding = Math.floor((maximum - (support.end - support.start)) / 2);
  const start = Math.max(0, Math.min(value.length - maximum, support.start - padding));
  return value.slice(start, start + maximum);
}

function excerpt(source, medication, claim) {
  const existing = medication.fields.citations?.find(citation => citation.pageId === source.id
    && (!citation.date || citation.date === claim.date) && typeof citation.quote === 'string' && source.body.includes(citation.quote));
  const name = medication.fields.name.toLowerCase();
  const dose = claim.dose.toLowerCase();
  if (existing && existing.quote.toLowerCase().includes(name) && existing.quote.toLowerCase().includes(dose)) return excerptWindow(existing.quote, name, dose);
  const candidates = (source.fields.note ?? source.body).split(/\r?\n/).map(line => line.trim()).filter(line => line && source.body.includes(line));
  const quote = candidates.find(line => line.toLowerCase().includes(name) && line.toLowerCase().includes(dose))
    ?? candidates.find(line => line.toLowerCase().includes(dose))
    ?? candidates.find(line => line.toLowerCase().includes(name))
    ?? candidates.find(line => !line.startsWith('#'));
  if (!quote) throw new HttpError(500, 'invalid_source', `Source ${source.id} has no literal excerpt.`);
  return excerptWindow(quote, name, dose);
}

function citationFor(index, medication, claim) {
  const source = reference(index, claim.sourceId, 'claim.sourceId');
  return {
    pageId: source.id,
    title: source.title,
    quote: excerpt(source, medication, claim),
    date: claim.date,
    attendeeIds: [...claim.attendeeIds],
  };
}

function medicationBody(page) {
  const current = latestVisitClaim(page.fields.claims);
  const lines = [
    `# ${page.title}`, '',
    'Synthetic family source records. Not medical advice.', '',
    '## Latest recorded visit claim', '',
    current ? `${page.fields.name}: ${current.dose} ${current.frequency}, recorded on ${current.date} in [[${current.sourceId}]].` : 'No visit claim is recorded.',
    '', 'This displays a source record and does not recommend a dose or establish what was taken.', '',
    `Status in the source list: ${page.fields.status}.`, '', '## Source history', '',
  ];
  for (const claim of page.fields.claims) {
    lines.push(`- ${claim.date}: ${claim.dose} ${claim.frequency}; ${claim.kind} source [[${claim.sourceId}]]; recorded attendees: ${claim.attendeeIds.map(id => `[[${id}]]`).join(', ') || 'none recorded'}.`);
  }
  lines.push('', 'All prior claims are retained. Unequal pharmacy and visit claims remain unresolved.', '');
  return lines.join('\n');
}

export function applyIngest(state, payload) {
  object(state, 'state');
  const index = pageIndex(state.pages);
  validatePayload(payload, index);
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || state.revision >= Number.MAX_SAFE_INTEGER) invalid('State revision must be a nonnegative safe integer.');
  object(state.idempotency, 'state.idempotency');
  const hash = createHash('sha256').update(canonicalJson({ extraction: payload.extraction, note: payload.note, authorId: payload.authorId })).digest('hex');
  const prior = own(state.idempotency, payload.idempotencyKey) ? state.idempotency[payload.idempotencyKey] : null;
  if (prior) {
    if (prior.hash !== hash) throw new HttpError(409, 'idempotency_conflict', 'This idempotency key was already used for a different note or extraction.');
    return { state, result: clone(prior.result) };
  }
  const resetEpoch = state.resetEpoch ?? 0;
  if (!Number.isSafeInteger(resetEpoch) || resetEpoch < 0) invalid('State resetEpoch must be a nonnegative safe integer.');
  const suffix = createHash('sha256').update(canonicalJson({ idempotencyKey: payload.idempotencyKey, resetEpoch })).digest('hex').slice(0, 24);
  const visitId = `visits/ingest-${suffix}`;
  const questionIds = payload.extraction.questions.map((_, i) => `questions/ingest-${suffix}-${i + 1}`);
  if ([visitId, ...questionIds].some(id => index.has(id))) throw new HttpError(409, 'page_conflict', 'The generated source ID already exists.');

  const nextState = clone(state);
  const nextIndex = pageIndex(nextState.pages);
  const extraction = clone(payload.extraction);
  const { visit } = extraction;
  const now = new Date().toISOString();
  const changedPageIds = [visitId];
  const doctor = nextIndex.get(visit.doctorId);
  const visitPage = {
    id: visitId, type: 'visit', title: `${doctor.title} visit, ${visit.date}`,
    body: '',
    fields: {
      synthetic: true, patientId: state.patientId, ...visit,
      note: payload.note, authorId: payload.authorId,
      medicationChanges: extraction.medicationChanges,
      followUps: extraction.followUps,
    },
    links: [], updatedAt: now,
  };
  addLinks(visitPage, [
    linkTo(state.patientId), linkTo(visit.doctorId), linkTo(payload.authorId),
    ...visit.attendeeIds.map(id => linkTo(id, 'attended')),
    ...extraction.medicationChanges.map(change => linkTo(change.medicationId)),
    ...questionIds.map(id => linkTo(id)),
  ]);
  const body = [
    `# ${visitPage.title}`, '', 'Synthetic family source record. Not medical advice.', '',
    `Date: ${visit.date}`, `Patient: [[${state.patientId}]]`, `Doctor: [[${visit.doctorId}]]`,
    `Attendees: ${visit.attendeeIds.map(id => `[[${id}]]`).join(', ') || 'None recorded.'}`,
    `Submitted by: [[${payload.authorId}]]`, '', '## Recorded summary', '', visit.summary,
    '', '## Verbatim source note', '', ...payload.note.split('\n').map(line => `> ${line}`),
    '', '## Recorded medication changes', '',
    ...extraction.medicationChanges.map(change => `- [[${change.medicationId}]]: ${change.dose} ${change.frequency}.`),
    '', '## Open questions', '',
    ...extraction.questions.map((question, i) => `- [[${questionIds[i]}]] for [[${question.doctorId}]]: ${question.text}`),
    '', '## Recorded follow-ups', '',
    ...extraction.followUps.map(followUp => `- ${followUp.text}${followUp.dueDate ? ` (due ${followUp.dueDate})` : ''}`),
    '', 'Care Circle records source claims without recommending treatment.', '',
  ];
  visitPage.body = body.join('\n');
  nextState.pages.push(visitPage);
  nextIndex.set(visitId, visitPage);

  if (!doctor.fields.lastVisitDate || visit.date > doctor.fields.lastVisitDate) {
    doctor.fields.lastVisitDate = visit.date;
    const statement = `Last recorded visit: ${visit.date} (source: [[${visitId}]]).`;
    const priorStatement = /^Last recorded visit:[ \t]*\d{4}-\d{2}-\d{2}(?:[ \t]*\(source:[ \t]*\[\[[a-z0-9_/-]+\]\]\))?\.?/gm;
    doctor.body = priorStatement.test(doctor.body)
      ? doctor.body.replace(priorStatement, statement)
      : `${doctor.body.trimEnd()}\n\n${statement}\n`;
  }
  addLinks(doctor, [linkTo(visitId)]);
  doctor.updatedAt = now;
  changedPageIds.push(doctor.id);

  for (const change of extraction.medicationChanges) {
    const medication = nextIndex.get(change.medicationId);
    medication.fields.claims.push({
      dose: change.dose, frequency: change.frequency, sourceId: visitId,
      date: visit.date, attendeeIds: [...visit.attendeeIds], kind: 'visit',
    });
    const latest = latestVisitClaim(medication.fields.claims);
    medication.fields.dose = latest.dose;
    medication.fields.frequency = latest.frequency;
    medication.fields.recordedSourceId = latest.sourceId;
    medication.fields.citations = medication.fields.claims.map(claim => citationFor(nextIndex, medication, claim));
    addLinks(medication, [linkTo(visitId), ...visit.attendeeIds.map(id => linkTo(id))]);
    medication.body = medicationBody(medication);
    medication.updatedAt = now;
    changedPageIds.push(medication.id);
  }

  extraction.questions.forEach((question, i) => {
    const page = {
      id: questionIds[i], type: 'question', title: question.text.slice(0, 200),
      body: [
        `# ${question.text.slice(0, 200)}`, '', 'Synthetic family question. Not medical advice.', '',
        question.text, '', `For: [[${question.doctorId}]]`, `Source: [[${visitId}]]`,
        `Submitted by: [[${payload.authorId}]]`, '', 'Status: open. This is a question for the care team.', '',
      ].join('\n'),
      fields: { synthetic: true, patientId: state.patientId, ...question, status: 'open', sourceId: visitId, authorId: payload.authorId },
      links: [linkTo(question.doctorId), linkTo(visitId), linkTo(state.patientId), linkTo(payload.authorId)],
      updatedAt: now,
    };
    nextState.pages.push(page);
    nextIndex.set(page.id, page);
    changedPageIds.push(page.id);
  });
  nextState.version = 1;
  nextState.revision += 1;
  nextState.ownedIds = [...new Set([...(nextState.ownedIds ?? state.pages.map(page => page.id)), ...changedPageIds])];
  const result = { ok: true, visitId, changedPageIds, revision: nextState.revision };
  Object.defineProperty(nextState.idempotency, payload.idempotencyKey, { value: { hash, result: clone(result) }, enumerable: true, writable: true, configurable: true });
  graph(nextState);
  return { state: nextState, result };
}

export function graph(state) {
  const index = pageIndex(state.pages);
  const edges = [];
  const seen = new Set();
  for (const page of state.pages) {
    for (const link of array(page.links, 'page.links', 2000)) {
      object(link, 'page link');
      reference(index, link.target, 'link.target');
      if (!LINK_TYPES.has(link.type)) invalid('Only mentions and attended links are supported.');
      const key = canonicalJson([page.id, link.target, link.type]);
      if (!seen.has(key)) edges.push({ source: page.id, target: link.target, type: link.type });
      seen.add(key);
    }
  }
  return { nodes: state.pages.map(({ id, type, title }) => ({ id, type, title })), edges };
}

export function medications(state) {
  const index = pageIndex(state.pages);
  return {
    medications: state.pages.filter(page => page.type === 'medication').map(page => {
      const claims = array(page.fields.claims, 'medication.claims', 10000);
      claims.forEach(claim => validateClaim(claim, index, 'claim'));
      const latest = latestVisitClaim(claims);
      return {
        id: page.id, name: page.fields.name, dose: latest?.dose ?? page.fields.dose,
        frequency: latest?.frequency ?? page.fields.frequency, status: page.fields.status,
        citations: claims.map(claim => citationFor(index, page, claim)), claims: clone(claims),
      };
    }),
    revision: state.revision,
  };
}

export function pageMarkdown(page) {
  const { body, ...metadata } = page;
  const missingLinks = [...new Set(page.links.map(link => link.target))].filter(target => !body.includes(`[[${target}]]`));
  const related = missingLinks.length ? `\n\n## Related records\n\n${missingLinks.map(target => `- [[${target}]]`).join('\n')}` : '';
  // Source text may itself discuss this fence syntax. Only the final fence is metadata.
  return `---\ntitle: ${JSON.stringify(page.title)}\ntype: note\nembed_skip: true\n---\n\n${body}${related}\n\n\`\`\`care-circle-page\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n`;
}
