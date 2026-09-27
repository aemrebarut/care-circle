# Care Circle web

The family room presents synthetic care records, linked source pages, recorded medication claims, contradictions, and printable pre-visit briefs. Care Circle organizes information and cites sources. It never recommends doses or treatments. All patients, people, providers, notes, and clinic details are fictional. Not medical advice.

## Run

From the repository root:

```sh
node services/web/server.mjs
```

Open `http://127.0.0.1:4700`. The service binds only to `127.0.0.1:4700`. Start the other Care Circle services for the complete demo. No dependency install or build step is required.

```sh
npm test --prefix services/web
```

The suite includes browser-state regression tests in an in-memory DOM, including stale-response protection and reload-safe pending saves. The smoke test uses isolated synthetic upstream replies, checks proxy routing and error handling, and never mutates the running family brain. It also checks a real HTTP round trip through a synthetic stub. Test servers bind only `127.0.0.1:4719` for web and `127.0.0.1:4712` for the stub, and close on completion. These ports are reserved for web smoke; run one instance at a time. Importing `createServer` does not start a listener.

## Files

- `server.mjs`: static asset allowlist, health endpoint, and same-origin JSON proxy.
- `smoke.mjs`: isolated server, routing, request validation, and upstream failure checks.
- `public/index.html`, `public/styles.css`, `public/app.js`, `public/favicon.svg`: browser app assets.

## API

`GET /health` returns `{ "ok": true, "service": "web", "syntheticData": true }`. This describes the web process only, not the availability of downstream services.

The proxy allows only the methods and endpoints in `docs/CONTRACT.md`:

| Browser prefix | Fixed loopback target |
| --- | --- |
| `/api/brain/` | `http://127.0.0.1:4701/v1/` |
| `/api/ingest/` | `http://127.0.0.1:4702/v1/` |
| `/api/brief/` | `http://127.0.0.1:4703/v1/` |
| `/api/river/` | `http://127.0.0.1:4704/v1/` |
| `/api/sponsors/` | `http://127.0.0.1:4705/v1/` |

Page lookup accepts encoded slash-separated IDs, such as `/api/brain/pages/medications%2Flisinopril`. POST requests require a JSON object and `Content-Type: application/json`. Request bodies are limited to 64 KiB with a 15-second body timeout. Upstream JSON is limited to 4 MiB with a 120-second total timeout, allowing time for local GBrain writes. Unknown routes, query parameters, unsupported methods, unsafe page IDs, and foreign browser origins are rejected. Targets never come from browser-supplied URLs, headers, or bodies. Incoming credentials and cookies are not forwarded.

The proxy preserves valid upstream error codes and messages. Ingest commit errors also preserve validated retry metadata: a 1 to 128 character safe `idempotencyKey`, `outcome` (`unknown` or `rejected`), boolean `retryable`, and an integer `upstreamStatus` from 400 through 599. Other error fields are omitted. This lets the browser retry an uncertain write with the same key. Unavailable, malformed, oversized, or timed-out upstream responses become explicit JSON errors. The proxy does not manufacture successful actions or silently retry mutations.

## Sponsor reality

The web service is a local presentation and transport layer. The brain service owns GBrain persistence. Ingest and River responses identify whether extraction used a deterministic parser or a River model. Metrics are displayed only when the River service reports measured results. Sponsor status, evidence, and limitations identify simulated or local procedures and clinic fetches. The web service performs no training, account creation, telemetry submission, or external sponsor requests.

## Family room flow

The circle and medication table read live HTTP data. A medication row highlights the source for its recorded visit dose and preserves other source records in a disclosure. Discrepancies remain visible until the source record explicitly reconciles them; v1 has no reconciliation workflow. Sources open in a keyboard-accessible dialog.

Use Try the sample note, then Review note. Inspect the extracted claims and warnings before Save to the family brain. A pending save retains its payload and idempotency key in browser session storage across a reload. Confirmed saves clear that pending entry; editing the note starts a new review.

Prepare a visit brief opens the cited structured result. Each unresolved discrepancy includes every claim's dose, frequency, date, and source. Print brief includes those claims, record limitations, and full source references. Graph traversal JSON is available on screen and excluded from print. River status polls every 20 seconds while the page is visible; corpus counts and training progress are reported separately from verified model evaluation.
