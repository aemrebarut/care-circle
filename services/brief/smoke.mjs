import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:4703';
const brain = 'http://127.0.0.1:4701';
const get = async (url, init = {}) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), redirect: 'error' });
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
};

assert.equal((await get(`${base}/health`)).service, 'brief');
const answer = await get(`${base}/v1/answer/medications`);
assert.ok(answer.medications.length > 0);
for (const med of answer.medications) assert.ok(med.citations.length > 0, `No citation for ${med.id}`);
const brief = await get(`${base}/v1/previsit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ doctorId: 'doctors/nephrologist' }) });
assert.equal(brief.since, '2026-09-15');
assert.match(brief.markdown, /Not medical advice/);
assert.ok(brief.traversal.visitedPageIds.length > 0);
for (const item of [...brief.citations, ...answer.medications.flatMap((med) => med.citations)]) {
  const { page } = await get(`${brain}/v1/pages/${encodeURIComponent(item.pageId)}`);
  assert.ok(page.body.includes(item.quote), `Quote mismatch for ${item.pageId}`);
}
const { contradictions } = await get(`${base}/v1/contradictions`);
for (const conflict of contradictions) {
  assert.equal(conflict.status, 'unresolved');
  assert.ok(conflict.claims.length >= 2);
  for (const claim of conflict.claims) assert.equal(claim.citation.pageId, claim.sourceId);
}
console.log(`brief smoke passed: ${answer.medications.length} recorded medications, ${brief.medicationChanges.length} changes, ${contradictions.length} unresolved discrepancies; source quotes verified`);
