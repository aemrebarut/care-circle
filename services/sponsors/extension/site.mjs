export const clinic = Object.freeze({
  name: 'Maple Harbor Family Clinic (fictional)',
  hours: 'Monday-Friday 8:00 AM-5:00 PM; Saturday-Sunday closed',
  phone: '+1 (415) 555-0142',
  address: '100 Example Lane, Demo City, CA 00000',
});

export const pharmacy = Object.freeze({
  name: 'Demo Circle Pharmacy (fictional)',
  hours: 'Monday-Friday 9:00 AM-6:00 PM; Saturday 10:00 AM-2:00 PM; Sunday closed',
  phone: '+1 (415) 555-0189',
  address: '102 Example Lane, Demo City, CA 00000',
});

const details = (kind, record) => `<section aria-labelledby="${kind}-name" id="${kind}">
  <p class="eyebrow">Fictional ${kind}</p><h2 id="${kind}-name">${record.name}</h2>
  <dl><dt>Hours</dt><dd id="${kind}-hours">${record.hours}</dd>
  <dt>Phone</dt><dd id="${kind}-phone">${record.phone}</dd>
  <dt>Address</dt><dd id="${kind}-address">${record.address}</dd></dl></section>`;

export const siteHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Care Circle | Synthetic clinic directory</title>
<style>
  :root{font-family:system-ui,sans-serif;color:#183c35;background:#f7f5ef;line-height:1.6}
  body{margin:0}main{max-width:880px;margin:56px auto;padding:0 24px}h1{font-size:clamp(2rem,5vw,3.4rem);line-height:1.15;margin:.3em 0}
  .eyebrow{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#48675a}.notice{background:#e6eee2;padding:14px 18px;border-radius:12px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin:32px 0}section{background:white;border:1px solid #d5dfd4;border-radius:16px;padding:24px}
  h2{font-size:1.3rem;line-height:1.4}dt{font-size:.8rem;color:#48675a;font-weight:700;margin-top:20px}dd{margin:3px 0}footer{border-top:1px solid #d5dfd4;padding:20px 0;font-weight:600}
  code{font-size:.85rem;overflow-wrap:anywhere}
</style></head><body><main>
<p class="eyebrow">Care Circle / Demo directory</p><h1>A few details,<br>one less phone call.</h1>
<p>This local directory gives the family a source for clinic hours and pharmacy contact details.</p>
<p class="notice" id="synthetic-notice"><strong>Synthetic demo only.</strong> All people, providers, addresses and phone numbers are fictional. Do not use them to seek care.</p>
<div class="cards">${details('clinic', clinic)}${details('pharmacy', pharmacy)}</div>
<p id="source-note">Source: Care Circle synthetic fixture v1. These details are read from this page, not a real clinic website.</p>
<p>Automation reads the same fields shown above. Local source: <code>http://127.0.0.1:4706/</code></p>
<footer>Not medical advice</footer>
<script id="care-circle-directory" type="application/json">${JSON.stringify({ fixtureId: 'care-circle-clinic-v1', synthetic: true, clinic, pharmacy })}</script>
</main></body></html>`;
