const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { pages: [], graph: null, medications: [], contradictions: [], graphView: 'care', revision: null, preview: null, noteKey: null, noteSnapshot: null, procedureId: null };
const demoNote = 'Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg daily. Wants potassium rechecked before nephrology Tuesday. Ask the nephrologist about the potassium recheck.';
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const typeLabels = { person: 'Family member', patient: 'Family record', doctor: 'Care team', medication: 'Medication record', visit: 'Visit note', question: 'Open question', pharmacy: 'Pharmacy record', lab: 'Lab record', 'insurer-call': 'Insurance call' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'disabled') node.disabled = Boolean(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null && typeof child !== 'boolean') node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
function replace(target, ...children) { const node = typeof target === 'string' ? $(target) : target; node.replaceChildren(...children.flat(Infinity).filter(Boolean)); }
function textValue(value) { if (value == null) return ''; return typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function dateLabel(value, long = false) { if (!value) return ''; const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value); return Number.isNaN(parsed.getTime()) ? String(value) : (long ? longDateFormat : dateFormat).format(parsed); }
function pageById(id) { return state.pages.find(page => page.id === id); }
function titleFor(id) { return pageById(id)?.title || String(id || '').split('/').at(-1)?.replaceAll('-', ' ') || 'Source record'; }
function errorMessage(error) { return error?.message || 'The service could not complete this request.'; }
function setStatus(target, message, kind = '') { const node = $(target); node.textContent = message; node.className = `inline-status ${kind}`; }
function busy(button, isBusy, label) { if (isBusy) { button.dataset.originalLabel = button.textContent; button.textContent = label; } else { button.textContent = button.dataset.originalLabel || button.textContent; } button.disabled = isBusy; button.setAttribute('aria-busy', String(isBusy)); }
async function api(path, { method = 'GET', body, timeout = 135000 } = {}) {
  let response;
  try { response = await fetch(`/api/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout), cache: 'no-store' }); }
  catch (error) { throw new Error(error.name === 'TimeoutError' ? 'The local service did not respond in time. The request may still be running.' : 'The local service is not reachable. Please try again when it is available.'); }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('The service returned an unreadable response. Nothing has been confirmed.'); }
  if (!response.ok || payload?.error) {
    const detail = payload?.error || {};
    const message = /recovering durable storage/i.test(detail.message || '') ? 'The family brain is still getting ready. Please try again in a moment.' : detail.outcome === 'unknown' ? 'The save could not be confirmed. The family brain may still have received it.' : detail.message || `The service returned HTTP ${response.status}.`;
    const error = new Error(message); error.code = detail.code; error.outcome = detail.outcome; error.retryable = detail.retryable; error.idempotencyKey = detail.idempotencyKey; throw error;
  }
  return payload;
}
function errorBlock(error, retry) { return el('div', { class: 'error-state', role: 'alert' }, el('p', {}, errorMessage(error)), retry && el('button', { class: 'button button-outline small', type: 'button', onClick: retry }, 'Try again')); }
function empty(message) { return el('p', { class: 'empty-state' }, message); }
function sourceButton(citation, label) {
  const source = typeof citation === 'string' ? { pageId: citation, title: titleFor(citation) } : citation || {};
  if (!source.pageId) return el('span', { class: 'quiet' }, 'Source unavailable');
  return el('button', { type: 'button', class: 'source-button', title: `Open source: ${source.title || titleFor(source.pageId)}`, onClick: () => openSource(source.pageId, source) }, label || source.title || titleFor(source.pageId));
}
function citationChips(citations = []) { return el('div', { class: 'source-chips' }, citations.map(citation => sourceButton(citation))); }
function claimRecords(claims = [], cite = citationChips) {
  return claims.map(claim => {
    const citation = {...claim.citation,pageId:claim.citation?.pageId || claim.sourceId,title:claim.citation?.title || titleFor(claim.sourceId),date:claim.citation?.date || claim.date};
    const kind = claim.kind || pageById(claim.sourceId)?.type;
    const label = kind === 'visit' ? 'Visit claim' : kind === 'pharmacy' ? 'Pharmacy claim' : 'Source claim';
    return el('div',{class:'claim-record'},el('p',{},el('strong',{},claim.dose || 'Dose not recorded'),' ',claim.frequency || '(frequency not recorded)',` · ${label} · ${dateLabel(claim.date || citation.date) || 'Date not recorded'}`),cite([citation]));
  });
}
function evidenceDetails(evidence, title = 'View local evidence') { return el('details', {}, el('summary', {}, title), el('pre', {}, JSON.stringify(evidence, null, 2))); }

async function loadFamily() {
  const request = state.familyRequest = (state.familyRequest || 0) + 1;
  try {
    const data = await api('brain/state');
    if (request !== state.familyRequest) return false;
    if (!Array.isArray(data.pages) || !Array.isArray(data.graph?.nodes) || !Array.isArray(data.graph?.edges)) throw new Error('The family record has not returned its pages and graph yet.');
    state.pages = data.pages; state.graph = data.graph; state.revision = data.revision;
    const patient = pageById(data.patientId) || data.pages.find(page => page.type === 'patient');
    const firstName = patient?.title?.split(' ')[0] || 'Rose';
    $('#circle-heading').textContent = `${firstName}'s circle`;
    const members = data.pages.filter(page => page.type === 'person' && page.id !== data.patientId);
    replace('#family-avatars', members.slice(0, 3).map(member => el('span', { class: 'avatar', title: member.title }, member.title?.split(' ').map(name => name[0]).slice(0, 2).join(''))));
    $('#family-summary').textContent = members.length ? `${members.map(member => member.title?.split(' ')[0]).join(', ')}. One circle of care.` : 'A shared place for the family record.';
    const status = $('#connection-status'); status.textContent = 'Connected to the family brain'; status.className = 'connection-status online';
    const author = $('#note-author'); const previous = state.pendingAuthorId || author.value;
    replace(author, members.length ? members.map(member => el('option', { value: member.id }, member.title)) : [el('option', { value: '' }, 'No family members available')]);
    if (members.some(member => member.id === previous)) author.value = previous;
    else if (members.some(member => member.id === 'people/ana-alvarez')) author.value = 'people/ana-alvarez';
    author.disabled = !members.length;
    if (members.some(member => member.id === state.pendingAuthorId)) state.pendingAuthorId = null;
    const nephrologist = pageById('doctors/nephrologist');
    $('#next-visit-detail').textContent = nephrologist ? `${nephrologist.fields?.nextVisitDate ? dateLabel(nephrologist.fields.nextVisitDate, true) : 'Next nephrology visit'} with ${nephrologist.title}. Gather what changed since the last visit.` : 'Gather the recorded changes and open questions for the next nephrology appointment.';
    renderGraph();
    return true;
  } catch (error) {
    if (request !== state.familyRequest) return false;
    replace('#graph', errorBlock(error, refreshData));
    $('#graph-count').textContent = 'Record unavailable'; $('#graph-summary').textContent = '';
    $('#connection-status').textContent = 'Family brain unavailable'; $('#connection-status').className = 'connection-status offline';
    if (!state.pages.length) { replace('#note-author',el('option',{value:''},'Family record unavailable')); $('#family-summary').textContent = 'Waiting for the family record.'; $('#next-visit-detail').textContent = 'Appointment details will appear when the family brain is connected.'; }
    return false;
  }
}
async function loadMedications() {
  const request = state.medicationRequest = (state.medicationRequest || 0) + 1;
  state.medicationsFresh = false;
  try { const data = await api('brain/medications'); if (request !== state.medicationRequest) return false; if (!Array.isArray(data.medications)) throw new Error('Medication records are not available yet.'); state.medications = data.medications; state.medicationsFresh = true; renderMedications(); return true; }
  catch (error) { if (request !== state.medicationRequest) return false; replace('#medication-list', errorBlock(error, loadMedications)); return false; }
}
async function loadAlerts() {
  const request = state.alertRequest = (state.alertRequest || 0) + 1;
  state.contradictionsFresh = false;
  try { const data = await api('brief/contradictions'); if (request !== state.alertRequest) return false; if (!Array.isArray(data.contradictions)) throw new Error('Source comparison is not available yet.'); state.contradictions = data.contradictions; state.contradictionsFresh = true; renderAlerts(); if (state.medicationsFresh) renderMedications(); return true; }
  catch (error) { if (request !== state.alertRequest) return false; replace('#alerts', errorBlock(error, loadAlerts)); if (state.medicationsFresh) renderMedications(); return false; }
}
async function refreshData() { const results = await Promise.allSettled([loadFamily(), loadMedications(), loadAlerts()]); return results.every(result => result.status === 'fulfilled' && result.value); }

function graphLabel(node) {
  if (node.type === 'person' || node.type === 'patient') return node.title?.split(' ')[0] || node.title;
  if (node.type === 'doctor') return pageById(node.id)?.fields?.specialty || node.title;
  return node.title?.length > 23 ? `${node.title.slice(0, 21)}…` : node.title;
}
function renderGraph() {
  if (!state.graph) return;
  const graph = state.graph;
  const patient = graph.nodes.find(node => node.type === 'patient') || graph.nodes.find(node => node.id === 'people/rose-alvarez');
  const care = new Set(['patient', 'person', 'doctor', 'medication']);
  const visible = graph.nodes.filter(node => state.graphView === 'all' || care.has(node.type));
  const others = visible.filter(node => node.id !== patient?.id).sort((a, b) => ['doctor','person','medication'].indexOf(a.type) - ['doctor','person','medication'].indexOf(b.type));
  const positions = new Map();
  if (patient) positions.set(patient.id, { x: 50, y: 47 });
  const count = others.length;
  others.forEach((node, index) => {
    const all = state.graphView === 'all';
    const inner = all && index >= Math.ceil(count * .64);
    const ringIndex = inner ? index - Math.ceil(count * .64) : index;
    const ringCount = inner ? count - Math.ceil(count * .64) : all ? Math.ceil(count * .64) : count;
    const angle = (ringIndex / Math.max(1, ringCount)) * Math.PI * 2 - Math.PI / 2 + (inner ? .2 : 0);
    positions.set(node.id, { x: 50 + Math.cos(angle) * (inner ? 26 : 42), y: 47 + Math.sin(angle) * (inner ? 25 : 37) });
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  let visibleEdges = 0;
  for (const edge of graph.edges) {
    const source = positions.get(edge.source), target = positions.get(edge.target);
    if (!source || !target) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    for (const [key, value] of Object.entries({x1:source.x,y1:source.y,x2:target.x,y2:target.y,class:'graph-line','vector-effect':'non-scaling-stroke'})) line.setAttribute(key,String(value));
    svg.append(line); visibleEdges++;
  }
  const nodes = visible.map(node => {
    const position = positions.get(node.id); if (!position) return null;
    const initials = node.type === 'patient' ? node.title?.split(' ').map(part => part[0]).slice(0,2).join('') : node.type === 'person' ? node.title?.[0] : node.type === 'doctor' ? '+' : node.type === 'medication' ? '•' : '↗';
    const button = el('button', {type:'button',class:`graph-node ${node.type}`,title:`${node.title}: ${typeLabels[node.type] || 'Source record'}`,'aria-label':`Open ${node.title}, ${typeLabels[node.type] || 'source record'}`,onClick:()=>openSource(node.id)},el('span',{class:`node-orb ${node.type}`},initials),el('span',{},graphLabel(node)),node.type === 'patient' && el('small',{},'At the heart of it all'));
    button.style.left = `${position.x}%`; button.style.top = `${position.y}%`; return button;
  });
  $('#graph').className = `graph-stage ${state.graphView === 'all' ? 'all-records' : ''}`;
  replace('#graph', svg, nodes);
  $('#graph-count').textContent = `${graph.nodes.length} connected records`;
  $('#graph-summary').textContent = `${visible.length} pages · ${visibleEdges} visible links`;
  replace('#graph-list', graph.nodes.map(node => sourceButton(node.id, node.title)));
}
function renderMedications() {
  if (!state.medications.length) { replace('#medication-list', empty('No medication records have been returned by the family brain.')); return; }
  const table = el('table',{class:'medication-table'},el('caption',{class:'skip-link'},'Recorded medication doses and their sources'),el('thead',{},el('tr',{},['Medication','Recorded dose','Source'].map(label=>el('th',{scope:'col'},label)))));
  table.append(el('tbody',{},state.medications.map(medication=>{
    const conflict = state.contradictionsFresh ? state.contradictions.find(item=>item.medicationId === medication.id) : null;
    const citations = medication.citations || [];
    const matchingClaims = (medication.claims || []).filter(claim=>claim.dose === medication.dose && claim.frequency === medication.frequency && claim.kind === 'visit').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const primary = citations.find(citation=>citation.pageId === matchingClaims[0]?.sourceId);
    const otherCitations = citations.filter(citation=>citation !== primary);
    const source = primary ? [sourceButton(primary),el('span',{class:'medication-meta'},`Recorded ${dateLabel(primary.date) || 'date unavailable'}`),otherCitations.length && el('details',{class:'medication-source-history'},el('summary',{},`${otherCitations.length} other source records`),citationChips(otherCitations))] : citations.length ? citationChips(citations) : el('span',{class:'quiet'},'Citation not returned');
    return el('tr',{class:conflict ? 'medication-conflict' : ''},el('td',{},el('span',{class:'medication-name'},medication.name),el('span',{class:'medication-meta'},medication.status === 'active' ? 'Recorded as active' : medication.status || 'Recorded medication'),conflict && el('span',{class:'conflict-tag'},conflict.temporalStatus === 'past-discrepancy-unreconciled' ? 'Earlier discrepancy unresolved' : 'Sources disagree')),el('td',{},el('span',{class:'dose'},medication.dose || 'Not recorded'),el('span',{class:'medication-meta'},medication.frequency || 'Frequency not recorded')),el('td',{},source));
  })));
  replace('#medication-list', table);
}
function renderAlerts() {
  if (!state.contradictions.length) { replace('#alerts', el('div',{class:'status-good'},el('span',{'aria-hidden':'true'},'✓'),el('p',{},'No unresolved medication source differences were returned. Every new note is checked against the record.'))); return; }
  replace('#alerts', state.contradictions.map(item=>el('article',{class:'alert-item'},el('h3',{},item.title || 'Medication sources disagree'),el('p',{},item.description || 'These source records show different doses. The difference remains unresolved.'),claimRecords(item.claims),el('p',{class:'tiny'},'A newer visit does not resolve a different pharmacy record.'))));
}

function sourceInline(text) {
  const pieces = []; const pattern = /\[\[([a-z0-9_/-]+)(?:\|([^\]]+))?\]\]/gi; let cursor = 0;
  for (const match of text.matchAll(pattern)) { pieces.push(text.slice(cursor,match.index),sourceButton(match[1],match[2] || titleFor(match[1]))); cursor = match.index + match[0].length; }
  pieces.push(text.slice(cursor)); return pieces;
}
function sourceNarrative(body) {
  const blocks = String(body || '').split(/\n\s*\n/).filter(Boolean);
  return el('div',{class:'source-body'},blocks.map((block,index)=>{
    if (index === 0 && /^# /.test(block)) return null;
    const heading = block.match(/^#{1,6} (.+)$/);
    if (heading) return el('h3',{},heading[1]);
    if (block.split('\n').every(line=>/^[-*] /.test(line))) return el('ul',{},block.split('\n').map(line=>el('li',{},sourceInline(line.slice(2)))));
    return el('p',{},sourceInline(block));
  }));
}
function sourceField(key,value) {
  if (/Id$/.test(key)) return sourceButton(String(value),titleFor(String(value)));
  return String(value);
}
function replaceSourceContent(...children) {
  const readingSource = $('#source-drawer').open && $('#source-content').contains(document.activeElement);
  replace('#source-content',...children);
  if (readingSource) $('#source-title').focus({preventScroll:true});
}
let sourceRequest = 0;
async function openSource(id, citation) {
  const request = ++sourceRequest;
  const dialog = $('#source-drawer');
  replaceSourceContent(el('h2',{id:'source-title',tabindex:'-1'},citation?.title || titleFor(id)),el('div',{class:'loading-state'},'Opening the original record...'));
  if (!dialog.open) dialog.showModal();
  $('#source-title').focus({preventScroll:true});
  try {
    const data = await api(`brain/pages/${encodeURIComponent(id)}`);
    if (request !== sourceRequest) return;
    const page = data.page; if (!page) throw new Error('This source record was not returned.');
    const sourceDate = citation?.date || page.fields?.date;
    const attendees = citation?.attendeeIds || page.fields?.attendeeIds || [];
    const fields = Object.entries(page.fields || {}).filter(([key,value])=>!['claims','summary','medicationChanges','followUps','synthetic'].includes(key) && ['string','number','boolean'].includes(typeof value));
    replaceSourceContent(el('span',{class:'pill'},typeLabels[page.type] || page.type),el('h2',{id:'source-title',tabindex:'-1'},page.title),el('p',{class:'source-meta'},sourceDate ? `Recorded ${dateLabel(sourceDate, true)}` : 'Date not specified in this record'),attendees.length && el('p',{class:'source-meta'},`Present: ${attendees.map(titleFor).join(', ')}`),citation?.quote && el('blockquote',{class:'source-quote'},citation.quote),fields.length && el('dl',{class:'source-fields'},fields.map(([key,value])=>[el('dt',{},key.replace(/Id$/,'').replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase())),el('dd',{},sourceField(key,value))])),el('h3',{},'Source record'),page.body ? sourceNarrative(page.body) : el('p',{class:'source-body'},'This source has no narrative text.'),page.body && el('details',{},el('summary',{},'View original source Markdown'),el('pre',{},page.body)),page.links?.length && el('section',{},el('h3',{},'Connected records'),el('div',{class:'source-chips'},page.links.map(link=>sourceButton(link.target,titleFor(link.target))))),el('details',{},el('summary',{},'View structured source fields'),el('pre',{},JSON.stringify(page.fields || {},null,2))),el('p',{class:'source-meta'},`Source ID: ${page.id}`));
  } catch(error) { if (request === sourceRequest) replaceSourceContent(el('h2',{id:'source-title',tabindex:'-1'},'Source unavailable'),errorBlock(error,()=>openSource(id,citation))); }
}
function invalidateNote() { state.pendingSave = false; state.pendingAuthorId = null; try { sessionStorage.removeItem('care-circle-pending-note'); } catch {} state.preview = null; state.noteKey = null; state.noteSnapshot = null; $('#note-preview').hidden = true; replace('#note-preview'); setStatus('#note-status',''); }
function notePayload() { return {note:$('#note-input').value.trim(),authorId:$('#note-author').disabled ? state.pendingAuthorId || undefined : $('#note-author').value || undefined,date:'2026-09-27'}; }
function renderPreview(result) {
  const extraction = result.extraction; if (!extraction?.visit) throw new Error('The extractor did not return a reviewable visit. This review did not save a note.');
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const preview = $('#note-preview'); preview.hidden = false;
  const list = (items) => el('ul',{},items.map(item=>el('li',{},item)));
  replace(preview,el('h3',{},'A moment to review'),el('span',{class:`pill ${result.method === 'river' ? '' : 'warning'}`},result.method === 'river' ? (result.provenance?.mode === 'cached-replay' && result.provenance?.liveInference === false ? 'River cached replay' : 'River output: mode not reported') : 'Deterministic extraction'),el('p',{},extraction.visit.summary || 'Visit extracted from your note.'),result.provenance?.mode === 'cached-replay' && el('p',{class:'tiny'},'A saved prediction for this exact synthetic sample. No live inference occurred.'),result.provenance && evidenceDetails(result.provenance,'View prediction provenance'),warnings.length && el('div',{class:'warning-box'},el('strong',{},'Please check these limitations.'),list(warnings.map(textValue))),el('h4',{},'Medication source claims'),extraction.medicationChanges?.length ? list(extraction.medicationChanges.map(change=>`${change.name || titleFor(change.medicationId)}: ${change.dose}, ${change.frequency || 'frequency not specified'}`)) : el('p',{},'No medication change extracted.'),extraction.questions?.length && [el('h4',{},'Questions to carry forward'),list(extraction.questions.map(question=>question.text))],extraction.followUps?.length && [el('h4',{},'Follow-ups in the note'),list(extraction.followUps.map(item=>item.text))],el('p',{class:'tiny'},'This adds a source claim. It does not resolve differing pharmacy records or recommend a treatment.'),el('button',{type:'button',class:'button button-primary full-width',id:'save-note',onClick:saveNote},'Save to the family brain'));
}
async function reviewNote(event) {
  event.preventDefault(); const payload = notePayload(); if (!payload.note) return;
  const button = $('#review-note'); busy(button,true,'Reading your note...'); $('#note-preview').hidden = true; setStatus('#note-status',state.pendingSave ? 'Reading the pending note again. Its earlier save is still unconfirmed.' : 'Extracting details for your review. This review does not save a note.');
  try { const result = await api('ingest/extract',{method:'POST',body:payload}); if (JSON.stringify(payload) !== JSON.stringify(notePayload())) { setStatus('#note-status','The note changed while it was being read. Review it again to see the latest details.'); return; } state.preview = result; state.noteSnapshot = payload; state.noteKey ||= crypto.randomUUID(); renderPreview(result); setStatus('#note-status',state.pendingSave ? 'Review the extracted details below. The earlier save is still unconfirmed; you can retry this same note.' : 'Review the extracted details below. Save is a separate step.'); }
  catch(error) { setStatus('#note-status',`${errorMessage(error)}${state.pendingSave ? ' The earlier save is still unconfirmed.' : ''}`,'error'); }
  finally { busy(button,false); }
}
async function saveNote() {
  if (!state.preview || !state.noteSnapshot || JSON.stringify(state.noteSnapshot) !== JSON.stringify(notePayload())) { invalidateNote(); setStatus('#note-status','The note changed. Review it again before saving.','error'); return; }
  const button = $('#save-note'); busy(button,true,'Saving the source and its links...'); $('#review-note').disabled = true; $('#note-input').disabled = true; $('#note-author').disabled = true; $('#sample-note').disabled = true; setStatus('#note-status','Saving to the family brain. This may take a moment.');
  try {
    state.pendingSave = true;
    try { sessionStorage.setItem('care-circle-pending-note',JSON.stringify({payload:state.noteSnapshot,key:state.noteKey})); } catch {}
    const result = await api('ingest/ingest',{method:'POST',body:{...state.noteSnapshot,idempotencyKey:state.noteKey}});
    if (!result.applied?.ok || !result.applied?.visitId) throw new Error('The service has not confirmed this note was saved. Check the record before retrying.');
    try { sessionStorage.removeItem('care-circle-pending-note'); } catch {}
    state.pendingSave = false;
    state.preview = null; $('#note-preview').hidden = true;
    setStatus('#note-status','Note saved. Refreshing the connected family record...','success');
    const refreshed = await refreshData();
    replace('#note-status', el('span',{},refreshed ? `Saved to the family brain. ${result.applied.changedPageIds?.length || 'Connected'} records updated. ` : 'The note was saved, but some views could not refresh. '),result.provenance?.mode === 'cached-replay' && el('span',{},'River cached replay, no live inference. '),sourceButton(result.applied.visitId,'Open saved visit'));
    $('#note-status').className = `inline-status ${refreshed ? 'success' : 'error'}`;
    $('#medication-answer').hidden = true;
  } catch(error) { setStatus('#note-status',`${errorMessage(error)} Your note is still here. You can safely retry the same reviewed note.`,'error'); busy(button,false); }
  finally { $('#review-note').disabled = false; $('#note-input').disabled = false; $('#note-author').disabled = !state.pages.some(page=>page.type === 'person'); $('#sample-note').disabled = false; }
}

async function askMedications() {
  const button = $('#ask-medications'); busy(button,true,'Reading the cited answer...'); const box = $('#medication-answer'); box.hidden = false; replace(box,el('p',{},'Asking the family record...'));
  try { const result = await api('brief/answer/medications'); if (!result.answer) throw new Error('No grounded answer was returned.'); replace(box,el('p',{},result.answer),result.citations?.length && citationChips(result.citations)); }
  catch(error) { replace(box,errorBlock(error,askMedications)); }
  finally { busy(button,false); }
}
async function generateBrief() {
  const button = $('#generate-brief'); busy(button,true,'Gathering connected records...'); setStatus('#brief-status','Following the source graph since the last nephrology visit.');
  try { const brief = await api('brief/previsit',{method:'POST',body:{doctorId:'doctors/nephrologist'}}); if (!brief.title || !Array.isArray(brief.medicationChanges)) throw new Error('The service did not return a complete visit brief.'); renderBrief(brief); $('#brief-dialog').showModal(); setStatus('#brief-status','Brief ready, with linked sources.','success'); }
  catch(error) { setStatus('#brief-status',errorMessage(error),'error'); }
  finally { busy(button,false); }
}
function renderBrief(brief) {
  const citations = new Map();
  const remember = items => { for (const citation of items || []) if (citation?.pageId) citations.set(citation.pageId,citation); return citationChips(items); };
  function section(title, items, emptyText) { return el('section',{class:'brief-section'},el('h3',{},title),items?.length ? items.map(item=>el('div',{class:'brief-item'},el('p',{},item.text),remember(item.citations || []))) : empty(emptyText)); }
  const content = [el('div',{class:'brief-heading'},el('div',{},el('p',{class:'eyebrow'},'CARE CIRCLE · SYNTHETIC FAMILY RECORD'),el('h2',{id:'brief-title'},brief.title),el('p',{class:'brief-subtitle'},`For ${titleFor(brief.doctorId)} · Changes since ${dateLabel(brief.since) || 'the last recorded visit'}`),el('p',{class:'brief-subtitle'},`Generated ${dateLabel(brief.generatedAt, true)} from the family source graph.`)),el('span',{class:'brand-mark','aria-hidden':'true'},el('i'),el('i'),el('i'))),section('Medication changes in the record',brief.medicationChanges,'No medication changes were returned for this period.'),section('Other visits since the last appointment',brief.otherVisits,'No other visits were returned for this period.'),section('Questions to bring',brief.openQuestions,'No open questions were returned.'),el('section',{class:'brief-section'},el('h3',{},'Unresolved differences between sources'),brief.contradictions?.length ? brief.contradictions.map(item=>el('div',{class:'brief-item brief-conflict'},el('p',{},el('strong',{},item.title),'. ',item.description || 'Different source claims remain unresolved.'),claimRecords(item.claims,remember))) : empty('No unresolved source differences were returned.'))];
  if (brief.warnings?.length) content.push(el('section',{class:'brief-section'},el('h3',{},'Record limitations'),el('div',{class:'warning-box'},brief.warnings.map(warning=>el('p',{},textValue(warning))))));
  content.push(el('div',{class:'print-sources'},el('strong',{},'Source references'),[...citations.values()].map(citation=>el('p',{},`${citation.title || titleFor(citation.pageId)}${citation.date ? ` (${dateLabel(citation.date)})` : ''} [${citation.pageId}]`))),el('p',{class:'brief-footer'},'All data is synthetic. This brief organizes recorded information and questions. A newer visit does not reconcile a different pharmacy claim. Confirm the record with the care team. Not medical advice.'));
  if (brief.traversal) content.push(el('details',{class:'brief-traversal'},el('summary',{},'How the source graph was followed'),el('pre',{},JSON.stringify(brief.traversal,null,2))));
  replace('#brief-content',content);
}

function modeLabel(mode) { return ({'local-simulation':'Local simulation','local-http-fetch':'Local HTTP lookup','deterministic':'Deterministic fallback','river':'River output','cached-replay':'River cached replay','not-connected':'Not connected','unavailable':'Unavailable'})[mode] || String(mode || 'Not connected').replaceAll('-',' '); }
function setMode(selector, mode) { $(selector).textContent = modeLabel(mode); $(selector).className = `pill ${['river','live','connected'].includes(mode) ? '' : 'warning'}`; }
function limitationsText(value) { return Array.isArray(value) ? value.map(textValue).join(' ') : textValue(value); }
function renderRiverMetrics(metrics) {
  if (!metrics) return el('p',{},'No verified base and trained model comparison yet.');
  const base = metrics.base?.counts, trained = metrics.trained?.counts;
  const comparable = metrics.paired === true && metrics.audit?.verified === true && Number.isInteger(base?.taskExact) && Number.isInteger(trained?.taskExact) && base.examples > 0 && base.examples === trained.examples;
  if (!comparable) return evidenceDetails(metrics,'View reported evaluation results');
  const budget = metrics.protocol?.generation?.max_tokens;
  const baseCapped = metrics.generationOutcomes?.base?.length;
  return el('div',{class:'evaluation-summary'},el('p',{class:'sponsor-line'},'Strict JSON task match'),el('div',{class:'metrics'},el('div',{class:'metric'},el('strong',{},`${base.taskExact}/${base.examples}`),el('span',{},'base model')),el('div',{class:'metric'},el('strong',{},`${trained.taskExact}/${trained.examples}`),el('span',{},'River trained'))),el('p',{},`Identical prompt${budget ? ` and ${Number(budget).toLocaleString()}-token completion limit` : ''}. ${Number.isInteger(baseCapped) ? `${baseCapped} base responses reached the token cap. ` : ''}Synthetic test only, not clinical accuracy.`),evidenceDetails({measurement:metrics.measurement,interpretation:metrics.interpretation,base:metrics.base?.counts,trained:metrics.trained?.counts,evaluatedAt:metrics.evaluatedAt},'Evaluation method and limitations'));
}
function renderRiverStatus(result) {
  const signature = JSON.stringify(result);
  if (state.riverStatusSignature === signature) return;
  const previousDetails = $$('details',$('#river-details'));
  const expanded = new Set(previousDetails.filter(item=>item.open).map(item=>$('summary',item)?.textContent));
  const focusedSummary = previousDetails.map(item=>$('summary',item)).find(item=>item === document.activeElement)?.textContent;
  const cached = result.extractionMode === 'cached-replay' || result.replay?.mode === 'cached-replay';
  setMode('#river-mode',cached ? 'cached-replay' : result.mode);
  const experiment = result.experiment || {};
  const trainingLabels = {training:'Training in progress',creating_model:'Creating the training model',evaluating:'Evaluating the trained model',completed:'Training run completed',failed:'Training run needs attention',not_started:'Training has not started'};
  const training = trainingLabels[result.trainingStatus] || textValue(result.trainingStatus).replaceAll('_',' ') || 'Training status not reported';
  const counts = result.corpus?.splits;
  replace('#river-details',el('p',{},el('strong',{},training)),Number.isFinite(experiment.completedSteps) && Number.isFinite(experiment.plannedSteps) && el('p',{},`${experiment.completedSteps} of ${experiment.plannedSteps} training steps reported.`),result.corpus?.total && el('div',{class:'metrics'},el('div',{class:'metric'},el('strong',{},result.corpus.total),el('span',{},'synthetic notes')),counts?.test?.count && el('div',{class:'metric'},el('strong',{},counts.test.count),el('span',{},'held-out examples'))),el('p',{},cached ? 'The exact sample note can replay a saved River prediction. No live inference occurs; other notes use the demo parser.' : result.extractionAvailable === true ? 'Model output is available. See the reported execution mode and limitations.' : 'Live model extraction is not available. Notes use the deterministic demo parser.'),renderRiverMetrics(result.metrics),el('details',{},el('summary',{},'Integration details and limitations'),el('p',{},limitationsText(result.limitations)),experiment.model && el('p',{},`Model: ${experiment.model}`)));
  for (const item of $$('details',$('#river-details'))) {
    const summary = $('summary',item);
    item.open = expanded.has(summary?.textContent);
    if (summary?.textContent === focusedSummary) summary.focus({preventScroll:true});
  }
  state.riverStatusSignature = signature;
}
async function loadRiverStatus() {
  try { renderRiverStatus(await api('river/status',{timeout:20000})); }
  catch(error) { state.riverStatusSignature = null; setMode('#river-mode','unavailable'); replace('#river-details',errorBlock(error,loadRiverStatus)); }
}
async function loadHelpersStatus() {
  const procedureVersion = state.procedureVersion || 0, clinicVersion = state.clinicVersion || 0;
  try {
    const result = await api('sponsors/status',{timeout:20000});
    if ((state.procedureVersion || 0) === procedureVersion) {
    setMode('#procedure-mode',result.memorable?.mode);
    replace('#procedure-details',el('p',{},result.memorable?.mode === 'local-simulation' ? 'A local synthetic checklist. No insurer is contacted, and no coverage decision is made.' : result.memorable?.status || 'Integration status not reported.'),result.memorable?.offlineRecallProof?.status === 'recorded-test' && el('p',{},'Official Memorable local recall was verified with a manually seeded procedure. Trace extraction and official replay did not run.'),el('details',{},el('summary',{},'Integration details and limitations'),el('p',{},limitationsText(result.memorable?.limitations))));
    }
    if ((state.clinicVersion || 0) === clinicVersion) {
    setMode('#clinic-mode',result.ufo?.mode);
    replace('#clinic-details',el('p',{},result.ufo?.mode === 'local-http-fetch' ? 'Reads the fictional clinic on this computer. Official UFO execution has not run.' : result.ufo?.status || 'Integration status not reported.'),result.ufo?.browserObservation?.officialUfoExecution === false && el('p',{},`A local browser check was recorded ${dateLabel(result.ufo.browserObservation.observedAt)}.`),el('details',{},el('summary',{},'Integration details and limitations'),el('p',{},limitationsText(result.ufo?.limitations)),result.ufo?.browserObservation && el('p',{},`Browser evidence: ${result.ufo.browserObservation.driver || 'local observation'}.`)));
    }
  } catch(error) {
    if ((state.procedureVersion || 0) === procedureVersion) { setMode('#procedure-mode','unavailable'); replace('#procedure-details',errorBlock(error,loadHelpersStatus)); }
    if ((state.clinicVersion || 0) === clinicVersion) { setMode('#clinic-mode','unavailable'); replace('#clinic-details',errorBlock(error,loadHelpersStatus)); }
  }
}
async function loadSponsorStatus() { await Promise.allSettled([loadRiverStatus(),loadHelpersStatus()]); }
async function procedureAction(action) {
  state.procedureVersion = (state.procedureVersion || 0) + 1;
  const button = $(`#${action}-procedure`); busy(button,true,action === 'capture' ? 'Capturing local steps...' : 'Replaying local steps...'); $('#capture-procedure').disabled = true; $('#replay-procedure').disabled = true;
  replace('#procedure-details',el('p',{},'Working through the synthetic local procedure...'));
  try { const result = await api(`sponsors/procedure/${action}`,{method:'POST',body:action === 'capture' ? {actorId:'people/ana-alvarez'} : {actorId:'people/ben-alvarez',...(state.procedureId ? {procedureId:state.procedureId} : {})}}); if (!result.procedureId || !Array.isArray(result.steps)) throw new Error('No completed procedure evidence was returned.'); state.procedureId = result.procedureId; setMode('#procedure-mode',result.mode); replace('#procedure-details',el('p',{},el('strong',{},action === 'capture' ? 'Local procedure captured with Ana.' : 'Local procedure replay returned for Ben.')),el('p',{},'Synthetic workflow. This is not evidence of Memorable learning or external execution.'),el('ol',{},result.steps.map(step=>el('li',{},typeof step === 'string' ? step : `${step.tool || step.title || `Step ${step.index || ''}`}${step.status ? `: ${step.status}` : ''}`))),result.result && el('p',{},textValue(result.result)),evidenceDetails({procedureId:result.procedureId,actorId:result.actorId,mode:result.mode,steps:result.steps,evidence:result.evidence})); }
  catch(error) { replace('#procedure-details',errorBlock(error)); }
  finally { busy(button,false); $('#capture-procedure').disabled = false; $('#replay-procedure').disabled = false; }
}
async function fetchClinic() {
  state.clinicVersion = (state.clinicVersion || 0) + 1;
  const button = $('#fetch-clinic'); busy(button,true,'Reading the local clinic site...'); replace('#clinic-details',el('p',{},'Fetching the fictional clinic source...'));
  try {
    const result = await api('sponsors/clinic/fetch',{method:'POST',body:{}}); if (!result.clinic?.name) throw new Error('No clinic details were returned.'); setMode('#clinic-mode',result.mode);
    let sourceUrl; try { const parsed = new URL(result.sourceUrl); if (parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port === '4706') sourceUrl = parsed.href; } catch {}
    const clinic = result.clinic;
    replace('#clinic-details',el('p',{},el('strong',{},clinic.name)),el('p',{},`Hours: ${textValue(clinic.hours)}`),el('p',{},`Phone: ${textValue(clinic.phone)}`),clinic.address && el('p',{},textValue(clinic.address)),el('p',{},'Fictional clinic. Local lookup, not an official UFO extension run.'),sourceUrl && el('a',{href:sourceUrl,target:'_blank',rel:'noopener noreferrer'},'Open the synthetic source ↗'),evidenceDetails(result.evidence || {sourceUrl:result.sourceUrl,fetchedAt:result.fetchedAt,mode:result.mode}));
  } catch(error) { replace('#clinic-details',errorBlock(error)); }
  finally { busy(button,false); }
}

$$('[data-graph-view]').forEach(button=>button.addEventListener('click',()=>{state.graphView=button.dataset.graphView;$$('[data-graph-view]').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected));});renderGraph();}));
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target === dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();}}));
$('#note-form').addEventListener('submit',reviewNote);
$('#note-input').addEventListener('input',invalidateNote);
$('#note-author').addEventListener('change',invalidateNote);
$('#sample-note').addEventListener('click',()=>{invalidateNote();$('#note-input').value=demoNote;$('#note-input').focus();});
$('#ask-medications').addEventListener('click',askMedications);
$('#generate-brief').addEventListener('click',generateBrief);
$('#print-brief').addEventListener('click',()=>window.print());
$('#capture-procedure').addEventListener('click',()=>procedureAction('capture'));
$('#replay-procedure').addEventListener('click',()=>procedureAction('replay'));
$('#fetch-clinic').addEventListener('click',fetchClinic);

try {
  const pending = JSON.parse(sessionStorage.getItem('care-circle-pending-note') || 'null');
  if (pending?.payload?.note && typeof pending.payload.note === 'string' && pending.payload.note.length <= 12000 && typeof pending.key === 'string' && pending.key.length <= 160) {
    $('#note-input').value = pending.payload.note;
    if ($$('#note-author option').some(option=>option.value === pending.payload.authorId)) $('#note-author').value = pending.payload.authorId;
    state.pendingSave = true; state.noteKey = pending.key; state.noteSnapshot = pending.payload; state.pendingAuthorId = pending.payload.authorId;
    setStatus('#note-status','A previous save was not confirmed in this browser. Check the family record, or review this same note to retry safely.');
  }
} catch {}

await Promise.allSettled([refreshData(),loadSponsorStatus()]);

setInterval(()=>{if(document.visibilityState === 'visible') loadRiverStatus();},20000);
