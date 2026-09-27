import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const patientId = 'people/rose-alvarez';
const ana = 'people/ana-alvarez';
const ben = 'people/ben-alvarez';
const celia = 'people/celia-alvarez';
const neph = 'doctors/nephrologist';
const cardio = 'doctors/cardiologist';
const primary = 'doctors/primary-care';
const endo = 'doctors/endocrinologist';
const updatedAt = '2026-09-27T12:00:00.000Z';
const disclaimer = 'All people, providers, records, and events on this page are fictional demo data. Care Circle organizes source records and does not recommend doses or treatments. Not medical advice.';
const pages = [];
const wiki = (id) => `[[${id}]]`;
function page(id, type, title, fields, text) {
  const result = { id, type, title, body: `# ${title}\n\n${disclaimer}\n\n${text.trim()}\n`, fields: { synthetic: true, ...fields }, links: [], updatedAt };
  pages.push(result);
  return result;
}
function visit(id, date, doctorId, attendeeIds, title, summary, medicationChanges = [], followUps = []) {
  return page(id, 'visit', title, { patientId, date, doctorId, attendeeIds, summary, medicationChanges, followUps }, [
    `Date: ${date}. Patient: ${wiki(patientId)}. Doctor: ${wiki(doctorId)}.`,
    `Attendees: ${attendeeIds.map(wiki).join(', ')}.`,
    '## Source record', summary,
    ...medicationChanges.map((c) => `${c.name}: the visit records a change from ${c.previousDose} ${c.previousFrequency} to ${c.dose} ${c.frequency}. Medication page: ${wiki(c.medicationId)}.`),
    ...followUps.map((f) => `Recorded follow-up: ${f.text}${f.dueDate ? ` Source target date: ${f.dueDate}.` : ''}`),
    'This is a fictional visit record, not a treatment instruction.'
  ].join('\n\n'));
}

page(patientId, 'patient', 'Rose Alvarez', {
  name: 'Rose Alvarez', age: 81, dateOfBirth: '1945-04-12', referenceDate: '2026-09-27',
  childIds: [ana, ben, celia], doctorIds: [neph, cardio, primary, endo],
  context: 'Three adult children share a source-cited family care notebook.'
}, `Rose is 81 on the demo reference date, September 27, 2026. Her three adult children are siblings to one another: ${wiki(ana)}, ${wiki(ben)}, and ${wiki(celia)}.\n\nHer fictional care team includes ${wiki(primary)}, ${wiki(cardio)}, ${wiki(neph)}, and ${wiki(endo)}.\n\nThe notebook records what source documents say. The recorded list is not confirmation of what Rose actually takes. Source conflicts remain visible for the family to discuss with the care team.`);

for (const [id, name, role, text] of [
  [ana, 'Ana Alvarez', 'Daughter; appointment notes', 'Ana accompanies Rose to cardiology and helps capture after-visit notes.'],
  [ben, 'Ben Alvarez', 'Son; pharmacy and insurer records', 'Ben keeps pharmacy source records and insurer call notes.'],
  [celia, 'Celia Alvarez', 'Daughter; visit preparation', 'Celia gathers questions before nephrology appointments and coordinates the family notebook.']
]) page(id, 'person', name, { name, patientId, relationship: id === ben ? 'son' : 'daughter', role }, `${text}\n\nFamily: ${[patientId, ana, ben, celia].filter((x) => x !== id).map(wiki).join(', ')}. This is a fictional family role, not a professional care role.`);

for (const [id, name, specialty, lastVisitDate, nextVisitDate] of [
  [neph, 'Dr. Mira Patel', 'Nephrology', '2026-09-15', '2026-09-29'],
  [cardio, 'Dr. Evelyn Chen', 'Cardiology', '2026-09-23', '2026-09-27'],
  [primary, 'Dr. Luis Romero', 'Primary care', '2026-09-21', '2026-10-05'],
  [endo, 'Dr. Nora Okafor', 'Endocrinology', '2026-09-10', '2026-10-08']
]) page(id, 'doctor', name, { name, specialty, lastVisitDate, nextVisitDate, patientId }, `Specialty: ${specialty}. Fictional care team member for ${wiki(patientId)}.\n\nLast recorded visit: ${lastVisitDate}. Next appointment on the family calendar: ${nextVisitDate}.\n\nAn appointment date does not establish that a visit has happened or that a recommendation was made.`);

const v1 = 'visits/2026-09-03-primary-care';
const v2 = 'visits/2026-09-08-cardiology';
const v3 = 'visits/2026-09-10-endocrinology';
const v4 = 'visits/2026-09-15-nephrology';
const v5 = 'visits/2026-09-21-primary-care';
const v6 = 'visits/2026-09-23-cardiology';
const pharmacy = 'pharmacy/2026-09-24-medication-record';
const med = (name) => `medications/${name}`;
const reconciliation = [
  'Lisinopril is recorded as 10 mg daily.',
  'Amlodipine is recorded as 2.5 mg daily.',
  'Atorvastatin is recorded as 20 mg nightly.',
  'Metformin is recorded as 500 mg twice daily.',
  'Levothyroxine is recorded as 50 mcg each morning.',
  'Vitamin D3 is recorded as 1000 IU daily.',
  'Acetaminophen is recorded as 500 mg once daily as needed for pain.'
].join(' ');
visit(v1, '2026-09-03', primary, [ana], 'Primary care medication reconciliation, September 3', `${reconciliation} Ana copied these entries from the fictional visit medication list. No administration log is available.`, [], [{ text: 'Bring the family medication notebook to the next specialist visit.' }]);
visit(v2, '2026-09-08', cardio, [ana], 'Cardiology source review, September 8', 'Dr. Chen reviewed the family medication notebook with Ana. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. This visit records no medication change.');
visit(v3, '2026-09-10', endo, [ben], 'Endocrinology visit, September 10', 'Ben attended the endocrinology visit. Metformin is recorded as 500 mg twice daily. Levothyroxine is recorded as 50 mcg each morning. The source records an A1c sample on September 10 without an interpretation in this notebook.', [], [{ text: 'Keep the A1c source result with the visit notes.' }]);
visit(v4, '2026-09-15', neph, [celia], 'Nephrology visit, September 15', 'Celia attended the nephrology visit. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 2.5 mg daily. The fictional source requested a chemistry lab draw for September 16 and listed the next nephrology appointment as September 29.', [], [{ text: 'Chemistry lab draw recorded in the source.', dueDate: '2026-09-16' }, { text: 'Next nephrology appointment on the family calendar.', dueDate: '2026-09-29' }]);
visit(v5, '2026-09-21', primary, [ben], 'Primary care paperwork visit, September 21', 'Ben brought the family notebook to primary care. Atorvastatin is recorded as 20 mg nightly. Vitamin D3 is recorded as 1000 IU daily. Acetaminophen is recorded as 500 mg once daily as needed for pain. No medication change is recorded. Ben asked the office to send the fictional referral attachment requested by the insurer.', [], [{ text: 'Office to confirm that the requested referral attachment was sent.' }]);
visit(v6, '2026-09-23', cardio, [ana], 'Cardiology visit, September 23', 'Ana attended cardiology with Dr. Chen. Lisinopril is recorded as 10 mg daily. Amlodipine is recorded as 5 mg daily. The source records an amlodipine change from the earlier 2.5 mg daily entry. A follow-up cardiology appointment was placed on the family calendar for September 27.', [{ medicationId: med('amlodipine'), name: 'Amlodipine', previousDose: '2.5 mg', previousFrequency: 'daily', dose: '5 mg', frequency: 'daily' }], [{ text: 'Family to bring the updated medication source list to nephrology.' }]);

const medicationSpecs = [
  ['lisinopril', 'Lisinopril', '10 mg', 'daily', v6, '2026-09-23', [ana]],
  ['amlodipine', 'Amlodipine', '5 mg', 'daily', v6, '2026-09-23', [ana]],
  ['atorvastatin', 'Atorvastatin', '20 mg', 'nightly', v5, '2026-09-21', [ben]],
  ['metformin', 'Metformin', '500 mg', 'twice daily', v3, '2026-09-10', [ben]],
  ['levothyroxine', 'Levothyroxine', '50 mcg', 'each morning', v3, '2026-09-10', [ben]],
  ['vitamin-d3', 'Vitamin D3', '1000 IU', 'daily', v5, '2026-09-21', [ben]],
  ['acetaminophen', 'Acetaminophen', '500 mg', 'once daily as needed for pain', v5, '2026-09-21', [ben]]
];
const pharmacyRecords = medicationSpecs.map(([slug, name, dose, frequency]) => ({ medicationId: med(slug), name, dose, frequency }));
page(pharmacy, 'pharmacy', 'Fictional pharmacy medication record, September 24', { patientId, date: '2026-09-24', recordedBy: ben, attendeeIds: [ben], pharmacyName: 'Demo Circle Pharmacy', records: pharmacyRecords, recordKind: 'pharmacy-record', verifiesAdministration: false }, `Date: 2026-09-24. Recorded by ${wiki(ben)} for ${wiki(patientId)}.\n\n## Source record\n\n${pharmacyRecords.map((r) => `${r.name}: the pharmacy record lists ${r.dose} ${r.frequency}. ${wiki(r.medicationId)}.`).join('\n\n')}\n\nThis fictional pharmacy list agrees with the latest visit claims at seed time. It is not proof of dispensing, adherence, or current administration. Later source discrepancies should be shown with both sources.`);

for (const [slug, name, dose, frequency, sourceId, date, attendeeIds] of medicationSpecs) {
  const historicalDose = slug === 'amlodipine' ? '2.5 mg' : dose;
  const claims = [
    { dose: historicalDose, frequency, sourceId: v1, date: '2026-09-03', attendeeIds: [ana], kind: 'visit' },
    { dose, frequency, sourceId, date, attendeeIds, kind: 'visit' },
    { dose, frequency, sourceId: pharmacy, date: '2026-09-24', attendeeIds: [ben], kind: 'pharmacy' }
  ];
  page(med(slug), 'medication', name, { patientId, name, dose, frequency, status: 'active', claims, recordedSourceId: sourceId, asNeeded: slug === 'acetaminophen' }, `## Recorded medication entry\n\n${name} is recorded as ${dose} ${frequency} in ${wiki(sourceId)}. This is a source claim, not a recommendation.\n\nStatus in the fictional source list: active${slug === 'acetaminophen' ? '; as-needed use is recorded, not scheduled administration' : ''}.\n\n## Source history\n\n${claims.map((c) => `- ${c.date}: ${c.dose} ${c.frequency}; ${c.kind} source ${wiki(c.sourceId)}; family recorder or attendee ${c.attendeeIds.map(wiki).join(', ')}.`).join('\n')}\n\nHistorical entries are retained. A changed visit entry does not erase a pharmacy source. The family notebook does not determine what Rose should take.`);
}

for (const [id, name, date, value, unit, associatedVisitId, recordedBy] of [
  ['labs/2026-09-10-a1c', 'Hemoglobin A1c', '2026-09-10', 7.2, '%', v3, ben],
  ['labs/2026-09-16-potassium', 'Potassium', '2026-09-16', 4.6, 'mmol/L', v4, celia],
  ['labs/2026-09-16-creatinine', 'Creatinine', '2026-09-16', 1.2, 'mg/dL', v4, celia]
]) page(id, 'lab', `${name} source result, ${date}`, { patientId, date, name, value, unit, sourceId: id, associatedVisitId, recordedBy, interpretation: null, recordKind: 'original-synthetic-lab-report' }, `## Original synthetic lab report\n\n${name} is recorded as ${value} ${unit} on ${date}.\n\nThis page is the original fictional result source, not a transcription of a result from the associated visit note.\n\nFamily recorder: ${wiki(recordedBy)}. Associated visit: ${wiki(associatedVisitId)}. Patient: ${wiki(patientId)}.\n\nThe value is synthetic. No reference interval, trend conclusion, diagnosis, or clinical interpretation is supplied. This result predates the September 27 demo note and cannot establish completion of any later request.`);

const call1 = 'insurer-calls/2026-09-18-prior-authorization';
const call2 = 'insurer-calls/2026-09-22-follow-up';
page(call1, 'insurer-call', 'Synthetic insurer call, September 18', { patientId, date: '2026-09-18', actorId: ben, attendeeIds: [ben], insurerName: 'Demo Family Health Plan', reference: 'DEMO-PA-2026-0918', request: 'Nephrology follow-up referral authorization', status: 'pending-documentation', doctorId: neph, steps: ['Identify the fictional case reference.', 'Record which referral attachment is missing.', 'Ask the referring office for the attachment.', 'Record the follow-up reference and status.'], summary: 'The synthetic representative reported that the referral attachment was missing. No approval or coverage guarantee was given.' }, `Date: 2026-09-18. Caller: ${wiki(ben)}. Patient: ${wiki(patientId)}. Visit context: ${wiki(neph)} and ${wiki(v4)}.\n\n## Source call note\n\nDemo Family Health Plan case DEMO-PA-2026-0918 is recorded as pending documentation for the nephrology follow-up referral. The synthetic representative reported that the referral attachment was missing. No approval or coverage guarantee was given.\n\nRecorded procedure: identify the fictional case reference, record the missing attachment, ask the referring office for it, then record the follow-up reference and status.\n\nThis is a fabricated call transcript summary. No insurer was contacted and no document was sent.`);
page(call2, 'insurer-call', 'Synthetic insurer follow-up, September 22', { patientId, date: '2026-09-22', actorId: celia, attendeeIds: [celia], insurerName: 'Demo Family Health Plan', reference: 'DEMO-PA-2026-0918', previousCallId: call1, request: 'Nephrology follow-up referral authorization', status: 'under-review', doctorId: neph, steps: ['Use the existing fictional case reference.', 'Confirm the attachment status in the synthetic record.', 'Record that review is pending.', 'Save the follow-up note for the family.'], summary: 'The synthetic representative reported the attachment received and the request under review. No approval or coverage guarantee was given.' }, `Date: 2026-09-22. Caller: ${wiki(celia)}. Patient: ${wiki(patientId)}. Earlier call: ${wiki(call1)}. Office follow-up context: ${wiki(v5)}.\n\n## Source call note\n\nCelia used the same fictional case reference, DEMO-PA-2026-0918. The synthetic representative reported the attachment received and the request under review. No approval or coverage guarantee was given.\n\nThe notebook contains two sequential status records, not a verified insurance determination. No insurer was contacted and no document was sent.`);

for (const [id, doctorId, text, sourceId, ownerId] of [
  ['questions/nephrology-medication-notebook', neph, 'Can the nephrology team review the medication source list updated at cardiology on September 23?', v6, celia],
  ['questions/nephrology-lab-records', neph, 'Does the office have the September 16 lab source records for the September 29 appointment?', v4, celia],
  ['questions/primary-care-referral-status', primary, 'Can the office confirm the referral attachment status recorded in the September 22 insurer call?', call2, ben]
]) page(id, 'question', text, { patientId, doctorId, text, status: 'open', sourceId, ownerId }, `## Open family question\n\n${text}\n\nFor: ${wiki(doctorId)}. Family owner: ${wiki(ownerId)}. Source context: ${wiki(sourceId)}.\n\nThis is a family question for the care team, not a clinical recommendation or a completed follow-up.`);

const byId = new Map(pages.map((p) => [p.id, p]));
function fieldRefs(value, refs = new Set()) {
  if (typeof value === 'string' && byId.has(value)) refs.add(value);
  else if (Array.isArray(value)) value.forEach((v) => fieldRefs(v, refs));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => fieldRefs(v, refs));
  return refs;
}
for (const p of pages) {
  const refs = fieldRefs(p.fields);
  for (const m of p.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) refs.add(m[1]);
  refs.delete(p.id);
  const visible = new Set([...p.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1]));
  const additional = [...refs].filter((id) => !visible.has(id)).sort();
  if (additional.length) p.body += `\n## Related source pages\n\n${additional.map(wiki).join(', ')}.\n`;
  p.links = [...refs].sort().map((target) => ({ target, type: p.type === 'visit' && p.fields.attendeeIds.includes(target) ? 'attended' : 'mentions' }));
  if (p.type === 'medication') {
    p.fields.citations = p.fields.claims.map((claim) => {
      const source = byId.get(claim.sourceId);
      const quote = claim.kind === 'pharmacy' ? `${p.title}: the pharmacy record lists ${claim.dose} ${claim.frequency}.` : `${p.title} is recorded as ${claim.dose} ${claim.frequency}.`;
      return { pageId: source.id, title: source.title, quote, date: claim.date, attendeeIds: claim.attendeeIds };
    });
  }
}

await mkdir(join(root, 'pages'), { recursive: true });
for (const p of pages) {
  const { body, ...metadata } = p;
  const path = join(root, 'pages', `${p.id}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${body}\n\`\`\`care-circle-page\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n`);
}
await writeFile(join(root, 'seed.json'), `${JSON.stringify({ patientId, pages }, null, 2)}\n`);
console.log(`Generated ${pages.length} synthetic pages and seed.json.`);
