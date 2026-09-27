import { DEMO_DATE, IDS } from '../../contract/index.mjs';

const compact = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalized = (value) => compact(value).toLowerCase().replace(/(\d)\s*(mg|mcg|g|ml)\b/g, '$1 $2');
const regimen = (claim) => `${normalized(claim.dose)}|${normalized(claim.frequency)}`;
const array = (value) => Array.isArray(value) ? value : [];
const hasHint = (text, hint) => {
  if (!/^\d/.test(hint)) return text.includes(hint);
  const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.])${escaped}(?![a-z0-9.])`).test(text);
};
export const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export class BriefError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function indexState(state) {
  if (!state || !Array.isArray(state.pages) || !state.graph || !Array.isArray(state.graph.edges)) {
    throw new BriefError(502, 'INVALID_BRAIN_STATE', 'Brain returned an incomplete page and graph snapshot.');
  }
  const pages = new Map(state.pages.map((page) => [page.id, page]));
  const neighbors = new Map([...pages.keys()].map((id) => [id, []]));
  for (const edge of state.graph.edges) {
    if (!pages.has(edge.source) || !pages.has(edge.target)) continue;
    neighbors.get(edge.source).push({ id: edge.target, edge, direction: 'outgoing' });
    neighbors.get(edge.target).push({ id: edge.source, edge, direction: 'incoming' });
  }
  return { state, pages, neighbors };
}

export function walkGraph(index, rootId) {
  if (!index.pages.has(rootId)) throw new BriefError(404, 'PAGE_NOT_FOUND', 'The requested starting page was not found in the brain.');
  const paths = new Map([[rootId, []]]);
  const queue = [rootId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const next of index.neighbors.get(current)) {
      if (paths.has(next.id)) continue;
      // Another patient's page is a boundary, even if a provider is shared.
      if (index.pages.get(next.id).type === 'patient' && next.id !== index.state.patientId) continue;
      if (index.pages.get(next.id).fields?.patientId && index.pages.get(next.id).fields.patientId !== index.state.patientId) continue;
      paths.set(next.id, [...paths.get(current), { ...next.edge, direction: next.direction }]);
      queue.push(next.id);
    }
  }
  return paths;
}

export function citation(page, hints = []) {
  const body = String(page.body ?? '');
  const prose = body.replace(/```[\s\S]*?```/g, '');
  const lines = prose.split('\n').map((line) => line.trim()).filter((line) => line && !/^#{1,6}\s|^---$|^<!--|^-->/u.test(line));
  const needles = hints.filter(Boolean).map(normalized);
  const score = (line) => needles.reduce((total, hint, i) => total + (hasHint(normalized(line), hint) ? 2 ** (needles.length - i) : 0), 0);
  const ranked = lines.map((line) => ({ line, score: score(line) })).sort((a, b) => b.score - a.score);
  const line = ranked[0]?.line;
  const selected = line ?? body.trim();
  const starts = [0];
  for (const hint of hints.filter(Boolean)) {
    const anchor = selected.toLowerCase().indexOf(String(hint).toLowerCase());
    if (anchor >= 0) starts.push(Math.max(0, anchor - 80), Math.max(0, anchor - 250));
  }
  const quote = starts.map((start) => selected.slice(start, start + 500)).sort((a, b) => score(b) - score(a))[0];
  const result = { pageId: page.id, title: page.title, quote };
  if (validDate(page.fields?.date)) result.date = page.fields.date;
  if (Array.isArray(page.fields?.attendeeIds)) result.attendeeIds = [...page.fields.attendeeIds];
  return result;
}

function uniqueCitations(citations) {
  const sources = new Map();
  for (const item of citations.filter(Boolean)) if (!sources.has(item.pageId)) sources.set(item.pageId, item);
  return [...sources.values()];
}

function sourceClaims(medication, index, paths, warnings) {
  return array(medication.fields?.claims).flatMap((claim) => {
    const source = index.pages.get(claim.sourceId);
    if (!source || !paths.has(source.id) || !compact(claim.dose)) {
      warnings.push(`A claim on ${medication.id} lacks a graph-reachable source or recorded dose.`);
      return [];
    }
    const date = validDate(claim.date) ? claim.date : validDate(source.fields?.date) ? source.fields.date : null;
    if (!date) warnings.push(`The claim from ${source.id} has no valid event date; its order is uncertain.`);
    const kind = source.type === 'visit' ? 'visit' : source.type === 'pharmacy' ? 'pharmacy' : (claim.kind || source.type);
    return [{
      dose: compact(claim.dose), frequency: compact(claim.frequency), sourceId: source.id,
      date, kind, attendeeIds: array(claim.attendeeIds ?? source.fields?.attendeeIds),
      citation: citation(source, [medication.fields?.name || medication.title, claim.dose, claim.frequency]),
    }];
  });
}

function latest(claims) {
  const dated = claims.filter((claim) => claim.date && claim.date <= DEMO_DATE);
  const date = dated.map((claim) => claim.date).sort().at(-1);
  // Undated records cannot be safely superseded by a dated event.
  return claims.filter((claim) => !claim.date || claim.date === date);
}

function currentClaims(claims) {
  const groups = new Map();
  for (const claim of claims) {
    if (claim.date && claim.date > DEMO_DATE) continue;
    const group = claim.kind === 'visit' || claim.kind === 'pharmacy' ? claim.kind : `other:${claim.kind}`;
    groups.set(group, [...(groups.get(group) ?? []), claim]);
  }
  return [...groups.entries()].flatMap(([kind, records]) => kind === 'pharmacy' ? records : latest(records))
    .filter((claim, i, records) => records.findIndex((other) => other.sourceId === claim.sourceId && other.date === claim.date && regimen(other) === regimen(claim)) === i);
}

function disagreement(claims) {
  return claims.some((a, i) => claims.slice(i + 1).some((b) =>
    normalized(a.dose) !== normalized(b.dose) || (a.frequency && b.frequency && normalized(a.frequency) !== normalized(b.frequency))));
}

function conflictFor(medication, claims) {
  const current = currentClaims(claims);
  const latestSources = [...latest(current.filter((claim) => claim.kind === 'visit')), ...latest(current.filter((claim) => claim.kind === 'pharmacy')), ...current.filter((claim) => !['visit', 'pharmacy'].includes(claim.kind))];
  const currentlyDifferent = disagreement(latestSources);
  const evidence = disagreement(current) ? [...current] : [];
  const visits = claims.filter((claim) => claim.kind === 'visit' && (!claim.date || claim.date <= DEMO_DATE));
  for (const pharmacy of claims.filter((claim) => claim.kind === 'pharmacy' && (!claim.date || claim.date <= DEMO_DATE))) {
    const before = pharmacy.date ? latest(visits.filter((visit) => visit.date && visit.date <= pharmacy.date)) : [];
    const after = visits.filter((visit) => !pharmacy.date || !visit.date || visit.date > pharmacy.date);
    for (const visit of [...before, ...after]) {
      if (disagreement([pharmacy, visit])) evidence.push(pharmacy, visit);
    }
  }
  if (!evidence.length) return null;
  const sourceEvidence = [...evidence, ...latest(visits)].filter((claim, i, records) => records.findIndex((other) => other.sourceId === claim.sourceId && other.date === claim.date && regimen(other) === regimen(claim)) === i);
  const name = medication.fields?.name || medication.title;
  return {
    id: `source-discrepancy:${medication.id}`, medicationId: medication.id,
    title: `${name}: unresolved source discrepancy`,
    description: currentlyDifferent ? 'Source records disagree. Historical visit-only changes are retained as history. A pharmacy discrepancy requires separate source-cited reconciliation, which this demo does not record. Actual use is unconfirmed.' : 'Latest records agree, but an earlier source discrepancy has no source-cited reconciliation and remains unresolved. Actual use is unconfirmed.',
    claims: sourceEvidence, status: 'unresolved',
    temporalStatus: currentlyDifferent ? 'current-disagreement' : 'past-discrepancy-unreconciled',
  };
}

function medicationsFrom(index, paths) {
  const warnings = [];
  const medications = [...index.pages.values()].filter((page) => page.type === 'medication' && paths.has(page.id)).map((page) => {
    const claims = sourceClaims(page, index, paths, warnings);
    const visits = latest(claims.filter((claim) => claim.kind === 'visit'));
    const preferred = visits.length ? visits : latest(claims);
    const first = preferred[0];
    const hasClaims = array(page.fields?.claims).length > 0;
    const fallbackAllowed = !hasClaims;
    const conflict = conflictFor(page, claims);
    const ambiguous = disagreement(preferred);
    return {
      id: page.id, name: page.fields?.name || page.title,
      dose: ambiguous ? null : first?.dose ?? (fallbackAllowed ? compact(page.fields?.dose) : null),
      frequency: ambiguous ? null : first?.frequency ?? (fallbackAllowed ? compact(page.fields?.frequency) : null),
      status: page.fields?.status || 'unknown', label: 'Recorded dose',
      recordedAsOf: first?.date ?? null,
      citations: uniqueCitations([...preferred.map((claim) => claim.citation), ...(conflict ? conflict.claims.map((claim) => claim.citation) : []), ...(!first ? [citation(page)] : [])]),
      claims, contradictionId: conflict?.id ?? null,
      uncertainty: ambiguous ? 'Latest visit records disagree; no single recorded dose selected.' : conflict ? conflict.temporalStatus === 'past-discrepancy-unreconciled' ? 'Earlier source discrepancy remains unresolved; latest records agree but actual use is unconfirmed.' : 'Conflicting source records; actual use is unconfirmed.' : !first ? hasClaims ? 'No graph-supported claim is available on or before the reference date; recorded dose is unconfirmed.' : 'No dated source claim available; medication page record only.' : null,
      contradiction: conflict,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { medications, warnings: [...new Set(warnings)] };
}

export function buildContradictions(state) {
  const index = indexState(state);
  const paths = walkGraph(index, state.patientId || IDS.patient);
  const { medications, warnings } = medicationsFrom(index, paths);
  return { contradictions: medications.map((med) => med.contradiction).filter(Boolean), revision: state.revision, warnings };
}

export function buildMedicationAnswer(state) {
  const index = indexState(state);
  const paths = walkGraph(index, state.patientId || IDS.patient);
  const { medications, warnings } = medicationsFrom(index, paths);
  const active = medications.filter((med) => med.status === 'active');
  const lines = active.map((med) => `${med.name}: ${med.dose ? [med.dose, med.frequency].filter(Boolean).join(' ') : 'recorded dose unresolved'}.${med.uncertainty ? ` ${med.uncertainty}` : ''}`);
  return {
    question: 'What is Mom on right now?',
    answer: `Recorded active medications as of ${DEMO_DATE}. These are source records, not confirmation of actual use.\n${lines.length ? lines.join('\n') : 'No active medication records are reachable in the family graph.'}\nNot medical advice`,
    medications: active.map(({ contradiction, ...med }) => med),
    citations: uniqueCitations(active.flatMap((med) => med.citations)),
    contradictions: active.map((med) => med.contradiction).filter(Boolean), revision: state.revision, warnings,
  };
}

const doctorName = (index, id) => index.pages.get(id)?.title || id;
const afterBaseline = (date, since) => validDate(date) && date > since && date <= DEMO_DATE;

export function buildPrevisit(state, doctorId, { now = new Date() } = {}) {
  const index = indexState(state);
  const doctor = index.pages.get(doctorId);
  if (!doctor || doctor.type !== 'doctor') throw new BriefError(404, 'DOCTOR_NOT_FOUND', 'No doctor page exists for that doctorId.');
  if (doctor.fields?.patientId && doctor.fields.patientId !== state.patientId) throw new BriefError(404, 'DOCTOR_NOT_FOUND', 'The requested doctor is outside this family circle.');
  const since = doctor.fields?.lastVisitDate;
  if (!validDate(since) || since > DEMO_DATE) throw new BriefError(422, 'INVALID_BASELINE', 'The doctor page needs a valid lastVisitDate on or before the demo reference date.');
  const paths = walkGraph(index, doctorId);
  const reachable = [...index.pages.values()].filter((page) => paths.has(page.id));
  const visits = reachable.filter((page) => page.type === 'visit' && afterBaseline(page.fields?.date, since)).sort((a, b) => a.fields.date.localeCompare(b.fields.date) || a.id.localeCompare(b.id));
  const { medications, warnings } = medicationsFrom(index, paths);
  const medicationChanges = [];
  const seenChanges = new Set();
  for (const visit of visits) {
    for (const change of array(visit.fields?.medicationChanges)) {
      const medication = index.pages.get(change.medicationId);
      if (!medication || !paths.has(medication.id)) { warnings.push(`Visit ${visit.id} references a medication missing from the reachable graph.`); continue; }
      const name = medication.fields?.name || medication.title;
      const dose = compact(change.dose);
      if (!dose) continue;
      const key = `${visit.id}|${medication.id}|${regimen(change)}`;
      if (seenChanges.has(key)) continue;
      seenChanges.add(key);
      medicationChanges.push({ text: `${visit.fields.date}: ${name} recorded as ${dose}${change.frequency ? ` ${compact(change.frequency)}` : ''} by ${doctorName(index, visit.fields.doctorId)}.`, citations: [citation(visit, [name, dose, change.frequency])] });
    }
  }
  const otherVisits = visits.filter((visit) => visit.fields.doctorId !== doctorId).map((visit) => ({
    text: `${visit.fields.date}: ${doctorName(index, visit.fields.doctorId)}. ${compact(visit.fields.summary)}`,
    citations: [citation(visit, [visit.fields.summary])],
  }));
  const openQuestions = reachable.filter((page) => page.type === 'question' && page.fields?.doctorId === doctorId && page.fields?.status === 'open').flatMap((page) => {
    const source = index.pages.get(page.fields.sourceId);
    if ((validDate(page.fields.date) && page.fields.date > DEMO_DATE) || (validDate(source?.fields?.date) && source.fields.date > DEMO_DATE)) return [];
    if (page.fields.sourceId && (!source || !paths.has(source.id))) warnings.push(`Question ${page.id} has a missing or graph-unreachable origin; only its own page is cited.`);
    return [{ text: compact(page.fields.text || page.title), citations: uniqueCitations([citation(page, [page.fields.text]), source && paths.has(source.id) ? citation(source, [source.fields?.summary, page.fields.text, source.fields?.date]) : null]) }];
  });
  const contradictions = medications.map((med) => med.contradiction).filter(Boolean);
  const citations = uniqueCitations([citation(doctor, [since]), ...medicationChanges.flatMap((item) => item.citations), ...otherVisits.flatMap((item) => item.citations), ...openQuestions.flatMap((item) => item.citations), ...contradictions.flatMap((item) => item.claims.map((claim) => claim.citation))]);
  const result = {
    doctorId, title: `Pre-visit brief: ${doctor.title}`, since, through: DEMO_DATE, generatedAt: now.toISOString(),
    medicationChanges, otherVisits, openQuestions, contradictions, citations, revision: state.revision,
    warnings: [...new Set(warnings)],
    traversal: { rootId: doctorId, strategy: 'Breadth-first, incoming and outgoing persisted graph edges; then event-date and doctor filters.', visitedPageIds: [...paths.keys()], sources: citations.map((item) => ({ pageId: item.pageId, path: paths.get(item.pageId) ?? [] })) },
  };
  result.markdown = renderMarkdown(result);
  return result;
}

function safeText(value) { return compact(value).replace(/[<>]/g, '').replace(/[\[\]`]/g, '').replace(/[\u2013\u2014]/g, '-'); }

export function renderMarkdown(brief) {
  const numbered = new Map(brief.citations.map((item, index) => [item.pageId, index + 1]));
  const refs = (items) => uniqueCitations(items).map((item) => `[${numbered.get(item.pageId)}]`).join(' ');
  const section = (title, entries) => [`## ${title}`, ...(entries.length ? entries.map((item) => `- ${safeText(item.text)} ${refs(item.citations)}`) : ['- None recorded in the reachable graph.'])].join('\n');
  const conflicts = brief.contradictions.map((item) => ({
    text: `${item.title}: ${item.claims.map((claim) => `${claim.dose}${claim.frequency ? ` ${claim.frequency}` : ''} (${claim.kind}, ${claim.date || 'date unknown'})`).join(' vs ')}.${item.temporalStatus === 'past-discrepancy-unreconciled' ? ' Earlier discrepancy unreconciled; latest records agree.' : ''} Actual use unconfirmed.`, citations: item.claims.map((claim) => claim.citation),
  }));
  return [
    `# ${safeText(brief.title)}`,
    `Since ${brief.since}, through ${brief.through}. Synthetic family records. [${numbered.get(brief.doctorId)}]`,
    section('Medication changes recorded', brief.medicationChanges),
    section('Other visits', brief.otherVisits),
    section('Open questions', brief.openQuestions),
    section('Source discrepancies', conflicts),
    '## Sources',
    ...brief.citations.map((item, i) => `${i + 1}. [${safeText(item.title)}](/api/brain/pages/${encodeURIComponent(item.pageId)})${item.date ? `, ${item.date}` : ''}.`),
    ...(brief.warnings.length ? [`Record gaps: ${brief.warnings.map(safeText).join(' ')}`] : []),
    'Not medical advice',
  ].join('\n\n');
}
