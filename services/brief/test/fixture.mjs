export const patientId = 'people/rose-alvarez';
export const doctorId = 'doctors/nephrologist';
export const medicationId = 'medications/lisinopril';

export function fixture({ pharmacy = true, changed = true, reverted = false } = {}) {
  const pages = [
    { id: patientId, type: 'patient', title: 'Rose Alvarez', body: 'Fictional Rose Alvarez, 81.', fields: {} },
    { id: doctorId, type: 'doctor', title: 'Dr. Mira Patel', body: 'Last recorded visit: 2026-09-15.', fields: { lastVisitDate: '2026-09-15', specialty: 'Nephrology' } },
    { id: 'doctors/cardiologist', type: 'doctor', title: 'Dr. Chen', body: 'Fictional cardiologist Dr. Chen.', fields: {} },
    { id: 'people/ana-alvarez', type: 'person', title: 'Ana Alvarez', body: 'Fictional family member.', fields: {} },
    { id: 'visits/baseline', type: 'visit', title: 'Nephrology, September 15', body: 'Lisinopril recorded as 10 mg daily. Ana attended.', fields: { date: '2026-09-15', doctorId, attendeeIds: ['people/ana-alvarez'], summary: 'Lisinopril recorded as 10 mg daily.', medicationChanges: [{ medicationId, dose: '10 mg', frequency: 'daily' }] } },
    { id: 'visits/unchanged', type: 'visit', title: 'Cardiology, September 20', body: 'Lisinopril remains recorded as 10 mg daily. Ana attended.', fields: { date: '2026-09-20', doctorId: 'doctors/cardiologist', attendeeIds: ['people/ana-alvarez'], summary: 'Lisinopril remains recorded as 10 mg daily.', medicationChanges: [] } },
    { id: 'questions/old-open', type: 'question', title: 'Bring records?', body: 'Should the family bring the medication notebook?', fields: { date: '2026-09-10', doctorId, text: 'Should the family bring the medication notebook?', status: 'open', sourceId: 'visits/baseline' } },
    { id: 'questions/closed', type: 'question', title: 'Closed', body: 'Closed question.', fields: { doctorId, text: 'Closed question.', status: 'closed' } },
    { id: 'questions/other-doctor', type: 'question', title: 'Other doctor', body: 'Other doctor question.', fields: { doctorId: 'doctors/cardiologist', text: 'Other doctor question.', status: 'open' } },
  ];
  const claims = [
    { dose: '10 mg', frequency: 'daily', sourceId: 'visits/baseline', date: '2026-09-15', kind: 'visit' },
    { dose: '10 mg', frequency: 'daily', sourceId: 'visits/unchanged', date: '2026-09-20', kind: 'visit' },
  ];
  if (pharmacy) {
    pages.push({ id: 'pharmacy/fill', type: 'pharmacy', title: 'Pharmacy record', body: 'Lisinopril: the pharmacy record lists 10 mg daily.', fields: { date: '2026-09-24' } });
    claims.push({ dose: '10 mg', frequency: 'daily', sourceId: 'pharmacy/fill', date: '2026-09-24', kind: 'pharmacy' });
  }
  if (changed) {
    pages.push({ id: 'visits/increased', type: 'visit', title: 'Cardiology, September 25', body: 'Dr. Chen recorded lisinopril increased to 20 mg daily. Ana attended.', fields: { date: '2026-09-25', doctorId: 'doctors/cardiologist', attendeeIds: ['people/ana-alvarez'], summary: 'Dr. Chen recorded lisinopril increased to 20 mg daily.', medicationChanges: [{ medicationId, dose: '20 mg', frequency: 'daily' }] } });
    claims.push({ dose: '20 mg', frequency: 'daily', sourceId: 'visits/increased', date: '2026-09-25', kind: 'visit' });
  }
  if (reverted) {
    pages.push({ id: 'visits/reverted', type: 'visit', title: 'Cardiology, September 27', body: 'Dr. Chen recorded lisinopril changed to 10 mg daily. Ana attended.', fields: { date: '2026-09-27', doctorId: 'doctors/cardiologist', attendeeIds: ['people/ana-alvarez'], summary: 'Dr. Chen recorded lisinopril changed to 10 mg daily.', medicationChanges: [{ medicationId, dose: '10 mg', frequency: 'daily' }] } });
    claims.push({ dose: '10 mg', frequency: 'daily', sourceId: 'visits/reverted', date: '2026-09-27', kind: 'visit' });
  }
  pages.push({ id: medicationId, type: 'medication', title: 'Lisinopril', body: 'Lisinopril source claims are synthetic.', fields: { name: 'Lisinopril', dose: reverted || !changed ? '10 mg' : '20 mg', frequency: 'daily', status: 'active', claims } });
  return {
    patientId, pages, revision: 'fixture-1',
    graph: { nodes: pages.map(({ id, type, title }) => ({ id, type, title })), edges: pages.filter((page) => page.id !== patientId).map((page) => ({ source: page.id, target: patientId, type: 'mentions' })) },
  };
}

export function attach(state, page) {
  state.pages.push(page);
  state.graph.nodes.push({ id: page.id, type: page.type, title: page.title });
  state.graph.edges.push({ source: page.id, target: patientId, type: 'mentions' });
  return page;
}
