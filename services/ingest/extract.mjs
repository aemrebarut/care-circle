import { createHash } from 'node:crypto';
import { DEMO_DATE, IDS } from '../../contract/index.mjs';

export class IngestError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const AUTHORS = new Set([IDS.ana, IDS.ben, IDS.celia]);
const DOCTORS = [
  { id: IDS.cardiologist, pattern: /\b(?:cardiology|cardiologist)\b/i },
  { id: IDS.nephrologist, pattern: /\b(?:nephrology|nephrologist)\b/i },
  { id: 'doctors/primary-care', pattern: /\b(?:primary care|primary-care|pcp)\b/i },
  { id: 'doctors/endocrinologist', pattern: /\b(?:endocrinology|endocrinologist)\b/i },
];
const DISCLAIMER = 'Deterministic extraction recognizes a limited set of explicit synthetic note patterns. It does not interpret clinical meaning or recommend treatment.';
const AMBIGUOUS = /\b(?:not|no|never|denies|denied|may|maybe|might|possibly|perhaps|unsure|uncertain|if|unless|could|would|should|consider|considering|discuss|discussed|suggest|suggested|recommend|recommended|previously|formerly|used to|last time|do not|didn't|wasn't|isn't|don't|can't|won't)\b|\?/i;
const CHANGE = /\b(?:increase[ds]?|decrease[ds]?|raise[ds]?|reduce[ds]?|change[ds]?|switch(?:ed)?|start(?:ed)?|stop(?:ped)?|hold|held|discontinue[ds]?|up to|down to)\b/i;

function invalid(message) {
  throw new IngestError(400, 'invalid_request', message);
}
function unsupported(message) {
  throw new IngestError(422, 'unsupported_note', message, { warnings: [DISCLAIMER] });
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeInput(input, { commit = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Expected a JSON object.');
  const allowed = new Set(['note', 'authorId', 'date', ...(commit ? ['idempotencyKey'] : [])]);
  if (Object.keys(input).some(key => !allowed.has(key))) invalid('Request contains unsupported fields.');
  if (typeof input.note !== 'string' || !input.note.trim()) invalid('note must be a non-empty string.');
  if (input.note.length > 12000) invalid('note must contain at most 12000 characters.');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.note)) invalid('note contains unsupported control characters.');
  if (input.authorId !== undefined && !AUTHORS.has(input.authorId)) invalid('authorId must identify Ana, Ben, or Celia in the synthetic circle.');
  if (input.date !== undefined && !validDate(input.date)) invalid('date must be a real calendar date in YYYY-MM-DD format.');
  if (input.idempotencyKey !== undefined && (typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(input.idempotencyKey))) invalid('idempotencyKey must be 1 to 128 letters, digits, dots, underscores, colons, or hyphens.');
  return { note: input.note, authorId: input.authorId ?? IDS.ana, date: input.date, idempotencyKey: input.idempotencyKey };
}

// Preserve source punctuation in every text field. The abbreviation guard avoids
// treating "Dr. Chen" as two different statements.
function statements(note) {
  return note.match(/(?:\bDr\.|\d+\.\d+|[^.!?\n;])+[.!?]?/gi)?.map(part => part.trim()).filter(Boolean) ?? [];
}

function encounter(note, parts, requestedDate, warnings) {
  const opening = parts[0] ?? '';
  const doctors = DOCTORS.filter(doctor => doctor.pattern.test(opening));
  const completedOpening = /^(?:(?:saw|visited)\s+(?:the\s+)?)?(?:cardiology|cardiologist|nephrology|nephrologist|primary care|primary-care|pcp|endocrinology|endocrinologist)(?:\s+(?:visit|appointment))?(?:\s+(?:today|(?:on\s+)?\d{4}-\d{2}-\d{2}))?(?:\s+with\s+(?:Ana|Ben|Celia)(?:\s*(?:,|and|&)\s*(?:Ana|Ben|Celia)){0,2})?[.!]?$/i;
  if (doctors.length !== 1 || !completedOpening.test(opening) || !/\b(?:today|saw|visited)\b|\b\d{4}-\d{2}-\d{2}\b/i.test(opening)) {
    unsupported('Start with one explicit completed visit specialty and date, such as "Cardiology today with Ana." Unsupported visit wording needs review.');
  }
  const dates = opening.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (dates.some(date => !validDate(date)) || new Set(dates).size > 1) unsupported('The visit date is invalid or ambiguous.');
  if (dates[0] && requestedDate && dates[0] !== requestedDate) unsupported('The note visit date conflicts with the supplied date.');
  if (/\b(?:yesterday|last\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year))\b/i.test(opening) && !requestedDate && !dates[0]) {
    unsupported('Supply the visit date explicitly for a past relative date.');
  }
  if (!dates[0] && !requestedDate) warnings.push(`Visit date defaults to the synthetic demo reference date ${DEMO_DATE}.`);
  const attendeeIds = [];
  // Only the validated visit opening can assert attendance.
  const attendance = opening.match(/\bwith\s+(.+?)[.!]?$/i)?.[1] ?? '';
  for (const [name, id] of [['Ana', IDS.ana], ['Ben', IDS.ben], ['Celia', IDS.celia]]) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(attendance)) attendeeIds.push(id);
  }
  if (!attendeeIds.length) warnings.push('No explicit sibling attendance was recognized; note authorship is recorded separately.');
  return { date: dates[0] ?? requestedDate ?? DEMO_DATE, doctorId: doctors[0].id, attendeeIds, summary: note };
}

function medicationChanges(parts, visitDoctorId) {
  const changes = [];
  for (const part of parts) {
    if (!CHANGE.test(part) && !/\blisinopril\b/i.test(part)) continue;
    if (!/\blisinopril\b/i.test(part)) unsupported('An unsupported change is mentioned. The deterministic baseline only records explicit lisinopril changes.');
    if (AMBIGUOUS.test(part)) unsupported('A medication statement is uncertain, conditional, historical, or negated. Review the original note.');
    const medMentions = part.match(/\blisinopril\b/gi) ?? [];
    const doses = part.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?)\b/gi) ?? [];
    if (medMentions.length !== 1 || doses.length !== 1) unsupported('A medication statement contains missing or competing dose claims.');
    const explicitDoctor = DOCTORS.find(doctor => doctor.pattern.test(part));
    if (explicitDoctor && explicitDoctor.id !== visitDoctorId) unsupported('A medication change attributed to a different specialty needs separate source review.');
    if (/^Dr\. Chen\b/i.test(part) && visitDoctorId !== IDS.cardiologist) unsupported('A Dr. Chen change needs an explicit cardiology encounter.');
    const actor = '(?:(?:Dr\\. Chen|(?:The )?(?:cardiologist|nephrologist|endocrinologist|primary care doctor))\\s+)?';
    const completedChange = `(?:${actor}(?:increased|decreased|raised|reduced|changed)\\s+lisinopril\\s+to|lisinopril\\s+(?:(?:was\\s+)?(?:increased|decreased|raised|reduced|changed)\\s+to|(?:up|down)\\s+to))`;
    const doseMatch = part.match(new RegExp(`^${completedChange}\\s+(\\d+(?:\\.\\d+)?)\\s*(mg)\\s+(daily|once\\s+(?:a\\s+day|daily)|twice\\s+(?:a\\s+day|daily)|every\\s+morning|every\\s+evening)[.!]?$`, 'i'));
    if (!doseMatch) unsupported('A lisinopril change needs a completed affirmative change, one dose in mg, and a complete supported frequency. Historical, proposed, and qualified changes need review.');
    const numericDose = Number(doseMatch[1]);
    if (!Number.isFinite(numericDose) || numericDose <= 0) unsupported('A recorded dose must be a positive explicit number.');
    // Only lexical whitespace is normalized; no clinical conversion is performed.
    changes.push({ medicationId: IDS.lisinopril, name: 'lisinopril', dose: `${doseMatch[1]} mg`, frequency: doseMatch[3].replace(/\s+/g, ' ').toLowerCase() });
  }
  if (changes.length > 1) unsupported('Multiple medication change statements require review before recording.');
  return changes;
}

export function extractDeterministic(input) {
  const normalized = normalizeInput(input, { commit: true });
  const { note, date } = normalized;
  const warnings = [DISCLAIMER];
  if (input.authorId === undefined) warnings.push('Note author defaults to Ana Alvarez. This does not imply visit attendance.');
  const parts = statements(note);
  const visit = encounter(note, parts, date, warnings);
  if (/\b(?:cancelled|canceled|correction|actually|hypothetical|pretend|fictional example|didn't happen|did not happen)\b/i.test(note)) unsupported('The note contains a correction, cancellation, or hypothetical context. Review the complete source before recording.');
  const changes = medicationChanges(parts, visit.doctorId);
  const questions = [];
  const followUps = [];
  const unrecognized = [];
  for (const part of parts.slice(1)) {
    if (/^ask\b/i.test(part)) {
      const target = part.match(/^Ask\s+(?:the\s+)?(cardiologist|nephrologist|primary care doctor|endocrinologist)\s+about\s+.+[.!?]?$/i)?.[1];
      const doctors = target ? DOCTORS.filter(doctor => doctor.pattern.test(target)) : [];
      if (doctors.length !== 1) unsupported('An open question must directly ask a known specialist about a stated topic.');
      questions.push({ doctorId: doctors[0].id, text: part });
    } else if (/^(?:Wants|Requested|Requests)\s+(?:a\s+)?potassium\s+recheck(?:ed)?(?:\s+(?:before nephrology(?:\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))?|(?:on|by)\s+\d{4}-\d{2}-\d{2}))?[.!]?$/i.test(part)) {
      const date = part.match(/\b(?:on|by)\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1];
      if (date && (!validDate(date) || date < visit.date)) unsupported('A requested follow-up date is invalid or earlier than the visit.');
      followUps.push({ text: part, ...(date ? { dueDate: date } : {}) });
    } else if (!/\blisinopril\b/i.test(part)) {
      unrecognized.push(part);
    }
  }

  if (unrecognized.length && (changes.length || questions.length || followUps.length)) unsupported('Additional source wording could qualify a structured claim. Review the complete note before recording.');
  if (unrecognized.length) warnings.push('Unrecognized wording was retained only in the original source note.');
  if (!changes.length) warnings.push('No supported medication change was extracted; the complete note remains the source record.');
  if (/\b(?:tuesday|monday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)\b/i.test(note)) warnings.push('Relative follow-up wording is preserved verbatim; no due date was inferred.');
  return { extraction: { visit, medicationChanges: changes, questions, followUps }, method: 'deterministic', warnings };
}

export function defaultIdempotencyKey({ note, authorId }, extraction) {
  return `ingest-v1:${createHash('sha256').update(JSON.stringify({ note, authorId, date: extraction.visit.date })).digest('hex')}`;
}
