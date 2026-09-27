# Care Circle contract v1

Owner: cc-lead. Date: 2026-09-27. All HTTP binds are 127.0.0.1. JSON uses camelCase. No service reads another service's database. GBrain is the durable family record and source graph; do not replace it with a mock. UTC timestamps use ISO 8601; event dates use YYYY-MM-DD. Demo reference date is 2026-09-27.

## Ownership and ports

| Owner | Owned paths | Port | Purpose |
| --- | --- | --- | --- |
| cc-lead | contract/, docs/ root files, README.md, AGENTS.md, .gitignore, .dagr/ | none | Contract, integration decisions, progress, release |
| cc-world | packages/world/ | none | Synthetic markdown world and seed.json |
| cc-brain | services/brain/ | 4701 | Only family GBrain owner, typed pages and mutations |
| cc-ingest | services/ingest/ | 4702 | Safe extraction, deterministic fallback, committed ingest |
| cc-brief | services/brief/ | 4703 | Graph-grounded brief and contradiction detection |
| cc-web | services/web/ | 4700 | Family room UI and same-origin API proxy |
| cc-river | services/river/ | 4704 | Synthetic training corpus, held-out eval, optional River extractor |
| cc-sponsors | services/sponsors/ | 4705, 4706 | Procedure capture/replay and local synthetic clinic site |
| cc-runtime | scripts/ except brain and devbrain, packages/runtime/ | none | Start, stop, reset, all-service smoke, process receipts |
| cc-qa | tests/e2e/ | none | Independent acceptance and repeatability checks |
| cc-review | docs/reviews/ | none | Independent architecture and safety review |

Each HTTP service: `node services/<name>/server.mjs`, `GET /health` returns `{ok:true,service:"<name>",...}`. Package script `npm test` runs smoke checks; can also expose `smoke.mjs`. Use Node builtin APIs where practical. Python River training is optional, not required for its HTTP fallback. Errors: non-2xx `{error:{code,message}}`. Each request must have bounded body size and timeout. Allow loopback browser origin http://127.0.0.1:4700 only if CORS is necessary. Web proxies simplify this.

Temporary test port reservations: ingest 4713/4714, runtime 4715/4716, brief 4717/4718, web 4719. Coordinate 4707 through 4712 with cc-runtime before using them. Persistent service processes are started by runtime, with exact PID receipts; component owners coordinate restarts with runtime.

## Common objects

Page: `{id,type,title,body,fields,links,updatedAt}`. `id` is a slash-separated GBrain slug; `type` is patient, person, doctor, medication, visit, lab, insurer-call, question, or pharmacy. `body` is source markdown. `fields` carries typed data. `links` is an array of `{target,type}`. Use built-in GBrain mention/attended link types unless custom types were explicitly installed. Preserve app semantic types in fields and links even when GBrain extraction provides mentions.

Citation: `{pageId,title,quote,date?,attendeeIds?}`. Graph: `{nodes:[{id,type,title}],edges:[{source,target,type}]}`. All citations resolve through page lookup.

Seed package exports JSON at `packages/world/seed.json` with `{patientId,pages}`. Also ship one markdown file per page under `packages/world/pages/`. Brain imports those markdown pages with --no-embed and extracts links; structured metadata must survive GBrain persistence, e.g. JSON inside clearly delimited markdown. Brain may maintain a derived in-memory index but reset/restart must prove persistence.

Stable IDs: `people/rose-alvarez`, `people/ana-alvarez`, `people/ben-alvarez`, `people/celia-alvarez`; `doctors/nephrologist`, `doctors/cardiologist`, `doctors/primary-care`, `doctors/endocrinologist`; `medications/lisinopril` plus six others owned by world. Nephrologist last visit is 2026-09-15. Initial recorded lisinopril dose 10 mg daily, pharmacy record 10 mg daily. Demo cardiology visit on 2026-09-27 records 20 mg daily and potassium recheck. This is a fictional source claim, never a treatment instruction.

Medication fields: `{name,dose,frequency,status:"active",claims:[{dose,frequency,sourceId,date,attendeeIds,kind}]}`. Claims preserve old and conflicting source records. Doctor fields: `{specialty,lastVisitDate,nextVisitDate}`. Visit fields: `{date,doctorId,attendeeIds,summary,medicationChanges,followUps}`. Question fields: `{doctorId,text,status:"open",sourceId}`. Lab fields: `{date,name,value,unit,sourceId}`. No invented clinical interpretation.

A newer visit does not reconcile an unequal pharmacy claim. Every such discrepancy remains unresolved until a separate source-cited reconciliation action exists; v1 implements no reconciliation action. Latest recorded dose is a display of a visit source claim, never a recommendation or an assertion that the conflict is settled.

Temporal comparison rule: for each pharmacy claim, compare the latest visit claim at or before that pharmacy date and all subsequent visit claims. Preserve unequal pharmacy/visit pairs, including when a still-later visit returns to the pharmacy dose. Old visit-only changes do not create a conflict. A past unresolved discrepancy should be labeled as such, without implying it determines the current dose.

## Brain API, 4701

- `GET /v1/state` -> `{patientId,pages,graph,revision}`.
- `GET /v1/pages/:encodedId` -> `{page}`. Decode URL slug safely, including %2F.
- `GET /v1/medications` -> `{medications:[{id,name,dose,frequency,status,citations,claims}],revision}`. Most recent visit claim may be displayed as recorded, never silently erase conflicting pharmacy claims. UI labels it recorded dose.
- `GET /v1/graph` -> graph object above.
- `POST /v1/reset` with `{}` -> `{ok:true,revision}`. Only reset Care Circle demo pages, retaining safe repeatability. Runtime calls this endpoint, never opens brain storage.
- `POST /v1/ingest` with `{extraction,note,authorId,idempotencyKey}` -> `{ok:true,visitId,changedPageIds,revision}`. Atomic application at service level, writes visit, medication claim, questions and typed links. Repeated idempotency key must not duplicate anything. Validate against permitted IDs and never accept arbitrary executable commands.

## Extract and ingest API, 4702

Extraction: `{visit:{date,doctorId,attendeeIds,summary},medicationChanges:[{medicationId,name,dose,frequency}],questions:[{doctorId,text}],followUps:[{text,dueDate?}]}`. Preserve source phrasing and explicit uncertainty; reject or return warnings for unsupported notes instead of inventing facts.

- `POST /v1/extract` with `{note,authorId?,date?}` -> `{extraction,method:"deterministic"|"river",warnings:[]}`. No mutation.
- `POST /v1/ingest` with `{note,authorId?,date?,idempotencyKey?}` -> extraction response plus `{applied:{ok,visitId,changedPageIds,revision}}`. Calls brain. Default author Ana, default date 2026-09-27. Return upstream errors honestly.
- River is optional via 4704 `/v1/extract`; fallback must say deterministic and explain limitations.

Demo note: `Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg daily. Wants potassium rechecked before nephrology Tuesday. Ask the nephrologist about the potassium recheck.`

## Brief API, 4703

- `GET /v1/contradictions` -> `{contradictions:[{id,medicationId,title,description,claims:[{dose,sourceId,citation}],status:"unresolved"}]}`. Compare source claims and distinguish historical change from simultaneously unresolved visit/pharmacy discrepancy.
- `POST /v1/previsit` with `{doctorId:"doctors/nephrologist"}` -> `{doctorId,title,since,generatedAt,medicationChanges:[{text,citations}],otherVisits:[{text,citations}],openQuestions:[{text,citations}],contradictions,markdown}`. Get state and graph via brain HTTP; include traversal evidence in optional `traversal` field. One-page printable output; every substantive claim cites source pages. No treatment advice.
- `GET /v1/answer/medications` -> `{question,answer,medications,citations}`. Grounded medication list via brain HTTP.

## River API, 4704

- `GET /v1/status` -> `{mode:"deterministic"|"river",trainingStatus,externalSubmissionAuthorized:true,metrics,limitations}`. Metrics absent/null unless actually measured; base and trained scores require same held-out split and prompt, no leakage. River synthetic training/evaluation upload is authorized as of 14:53 Pacific; see AGENTS.md for the sole key-loading exception.
- `POST /v1/extract` same schema as ingest extract. If unavailable, explicit 503 so ingest fallback can take over. Training scripts opt-in, never automatically submit data externally.
- Corpus, split manifest, evaluation harness, honest local baseline, and intended exact external payload must be prepared for review. Report only env variable names, never values. Ask cc-lead for external approval via status, not user messages.

## Sponsors API, 4705 and local site 4706

- `GET /v1/status` -> `{memorable:{mode,status,limitations},ufo:{mode,status,limitations}}`; simulated modes explicit.
- `POST /v1/procedure/capture` with `{actorId?}` -> `{procedureId,steps,mode,evidence}`. Synthetic prior-auth tool trace only.
- `POST /v1/procedure/replay` with `{procedureId?,actorId?}` -> `{procedureId,actorId,steps,result,mode,evidence}`. Distinct sibling replay.
- `POST /v1/clinic/fetch` with `{}` -> `{clinic:{name,hours,phone,address?},sourceUrl,fetchedAt,mode,evidence}`. Fetch only allowlisted 127.0.0.1:4706 site. Actual browser trace if feasible. No real clinic scraping. UFO extension assets may be prepared; do not claim official extension execution unless verified.
- `POST /v1/reset` with `{}` -> `{ok:true}` clears ephemeral local procedure captures and replay state for repeatable demos.
- 4706 `GET /` synthetic clinic website and `/health`. Clinic and pharmacy details visibly fictional. External sponsor SDK interactions remain gated on approval.

## Web, runtime, and acceptance

Web same-origin proxies `/api/brain/*` to brain `/v1/*`, `/api/ingest/*` to ingest `/v1/*`, `/api/brief/*` to brief `/v1/*`, `/api/river/*` to river `/v1/*`, `/api/sponsors/*` to sponsors `/v1/*`. Warm readable UI, source drawer, graph, recorded med list, note paste, contradiction alert, printable brief, sponsor truth labels. Footer exactly `Not medical advice`. Never display a fabricated successful action.

Runtime provides `scripts/start`, `scripts/stop`, `scripts/smoke`, `scripts/demo-reset`. Start handles existing healthy services without killing unknown processes; store only own PID receipts under .runtime. Demo reset ensures services healthy, resets brain, and sponsor ephemeral demo state if needed, without deleting GBrain directories. Tests must allow GBrain CLI startup latency. Demo reset twice then full two-minute path must pass twice by freeze.

Cross-lane disagreements go to cc-lead immediately. Only cc-lead edits this contract. Additive optional fields are allowed; breaking changes require explicit contract update.
