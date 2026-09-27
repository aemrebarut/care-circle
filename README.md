# Care Circle

**A shared brain. A closer family.**

Three siblings care for Rose Alvarez, 81. Four specialists leave notes in different places. A pharmacy record and a cardiology visit disagree. Before the next appointment, someone has to reconstruct the whole story.

Care Circle gives that family a source-cited record in GBrain: who was there, what each source says, what changed, and which questions remain open. The hero is a one-page brief for the nephrologist that includes changes made by the other doctors since the last visit.

All people, providers, records, calls, and websites are synthetic. Care Circle organizes information and cites sources. It never recommends doses or treatments. **Not medical advice.**

Built from scratch during the Own Your Intelligence Hackathon on September 27, 2026. Public history begins that afternoon. Build status and outstanding approvals are in [STATUS](docs/STATUS.md); code freeze is 16:40 Pacific.

## Run the local demo

Requirements: Node 22 or newer, Python 3, Bun 1.3.11 or newer on PATH, a POSIX shell with `ps`, and GBrain 0.59 installed as `gbrain`. Install GBrain from its [official GitHub instructions](https://github.com/garrytan/gbrain#install); the npm package named `gbrain` is unrelated. The hackathon machine uses Node 26. The core app has no dependency install or build step.

```sh
git clone https://github.com/aemrebarut/care-circle.git
cd care-circle
scripts/setup
```

On a new machine, initialize the dedicated family brain once using the guarded commands in [the brain runbook](services/brain/README.md). The existing hackathon brain is already initialized. Never reinitialize it or run plain `gbrain`; the wrappers keep this project separate from the user's other brain.

```sh
scripts/start
scripts/smoke
scripts/demo-reset
```

Open **http://127.0.0.1:4700**. Startup may take tens of seconds while GBrain repairs its page projections. `scripts/stop` gracefully stops only processes started by this runtime. All service listeners bind to 127.0.0.1.

## Try it

1. Explore Rose's circle and open a medication's source. The seed has 30 pages: three adult children, four doctors, seven medications, six visits, labs, questions, pharmacy evidence, and two insurer calls.
2. Choose **Try the sample note**, then **Review note**. Review the structured visit, medication claim, question, and follow-up before saving.
3. Save the note. Ask **What is Mom taking now?** and inspect the cited recorded dose. The old pharmacy claim remains visible.
4. Open **Worth a closer look** to compare the 10 mg pharmacy record with the 20 mg cardiology record. Care Circle does not decide which dose Rose should take.
5. Choose **Prepare a visit brief**, then **Print brief**. The nephrology brief starts after September 15 and includes actual medication changes, other visits, open questions, and both conflict sources.
6. In **A few little helpers**, capture the synthetic administrative procedure with Ana, replay it with Ben, and look up the local fictional clinic. Read the integration labels and measured River results.

The canonical note is:

> Cardiology today with Ana. Dr. Chen increased lisinopril to 20 mg daily. Wants potassium rechecked before nephrology Tuesday. Ask the nephrologist about the potassium recheck.

`scripts/demo-reset` restores the synthetic seed over HTTP and clears local procedure state. It does not delete the brain directory. Coordinate resets with anyone else testing the shared demo.

## What is real

| Component | Implemented behavior and limits |
| --- | --- |
| **GBrain** | Real local storage, native Markdown import, native link extraction, an atomic GBrain snapshot page, and recoverable native source pages. Baseline and post-ingest restart persistence are verified. The UI graph and brief traverse typed links reconstructed from the durable snapshot. |
| **Note ingest** | A conservative deterministic extractor with source evidence checks, explicit warnings, bounded HTTP, and restart-safe retry keys. Unsupported or uncertain changes are rejected. Future visits cannot change the current record. Optional trained output must pass the same evidence gate. |
| **River** | Real Qwen/Qwen3.5-9B LoRA training, saved checkpoint, and independently audited paired evaluation. Scores and limitations are below. Two separate canonical-note predictions failed source or JSON validation, so the app uses its deterministic extractor. No live or cached model extraction is claimed. |
| **Memorable** | A real local proof captures Ana's trace, serializes it into a local store, uses official CLI 0.5.30 lexical recall to select its ID, and passes that ID to Ben's simulated replay. Serialization is authored by Care Circle; Memorable did not learn or extract the procedure. The app buttons remain local simulation. Remote extraction was declined. No insurer is contacted. |
| **UFO** | A Python extension using the pinned official SDK passed entry-point discovery, schema construction, and a direct tool-handler call through the real local clinic HTTP adapter. Source hashes, local MCP tests, and separate Chrome rendering are verified. No full UFO runtime, hosted model, or UFO browser automation was executed. |

The [Memorable local bridge receipt](services/sponsors/procedure/assets/memorable-live-bridge-proof.json) and [UFO SDK local tool receipt](services/sponsors/extension/ufo-package/evidence/sdk-live.json) preserve the exact scope of those proofs. They do not turn the app's simulation or HTTP fetch into a hosted sponsor run.

## River experiment

One fixed experiment used Qwen/Qwen3.5-9B, LoRA rank 8, one epoch over 336 synthetic training examples, and 21 optimizer steps. The corpus also has 72 development examples and 72 held-out test examples across six held-out wording families. Template families, case IDs, and checked entity groups do not overlap across splits. Both inference arms used the same prompt, test inputs, decoding settings, and 1,024-token output cap, with no chat template. Test gold was never sent to training or included in evaluation prompts.

| Measured result on 72 held-out synthetic notes | Base | Trained |
| --- | --- | --- |
| Valid JSON and extraction schema | 0/72 | 72/72 |
| Exact structured extraction | 0/72 | 72/72 |
| Full task, including warnings | 0/72 | 71/72 (98.61%) |

**This measures strict output success under a particular prompt and token budget.** The base model reached the token cap in 54 of 72 outputs; raw completion mode did not produce the required JSON. These numbers do not show that the base lacks medical knowledge, and they do not establish general or clinical accuracy. The trained model's one full-task miss was a warning mismatch. Its 48 predicted medication claims matched the synthetic gold.

An independent audit checked all 144 prediction rows, matching prompt and generation provenance, training batch hashes, sample receipt membership, and score arithmetic. The run recorded no request failures. Training loss is not presented as accuracy. [Measured comparison](services/river/results/comparison.json), [experiment receipts](services/river/results/README.md), and [River review](services/river/review/REVIEW.md) provide the evidence and limits.

The canonical demo note is separate from that frozen test set. Its first trained prediction invented a follow-up date; a second prediction under a stricter product-only prompt had malformed JSON. Both were rejected and preserved as failure evidence. The benchmark was not changed, and the application's source guard was not relaxed to make the demo pass.

## Architecture

| Package or service | Port | Responsibility |
| --- | --- | --- |
| [World](packages/world/README.md) | none | Deterministic synthetic Markdown, typed seed, exact citation quotes |
| [Web](services/web/README.md) | 4700 | Family room, graph, source drawer, note review, printable brief, fixed HTTP proxies |
| [Brain](services/brain/README.md) | 4701 | Sole family GBrain owner, serialized writes, source pages, durable retry receipts |
| [Ingest](services/ingest/README.md) | 4702 | Extraction, evidence validation, committed note ingestion |
| [Brief](services/brief/README.md) | 4703 | Graph traversal, source conflicts, medication answer, pre-visit brief |
| [River](services/river/README.md) | 4704 | Experiment status and optional verified model extraction |
| [Sponsors](services/sponsors/README.md) | 4705, 4706 | Procedure capture/replay, fictional clinic, integration evidence |
| [Runtime](packages/runtime/README.md) | none | Exact-PID startup/shutdown, health checks, HTTP-only reset |

Services communicate only over loopback HTTP. The brain service alone opens the family database. Development agents maintain a separate GBrain code map through `scripts/devbrain`. Shared interfaces and ownership are in [CONTRACT](docs/CONTRACT.md); milestones are in [PLAN](docs/PLAN.md).

## Verification

```sh
scripts/smoke
npm test --prefix packages/world
node tests/e2e/acceptance.mjs --read-only
```

Each component has its own smoke or unit checks. Independent acceptance tests cover literal source quotes, actual versus unchanged medication claims, persistent pharmacy discrepancies, unsupported notes, concurrent first-write retry keys, future dates, sponsor evidence, and repeated reset-to-demo runs. [Acceptance evidence](tests/e2e/ACCEPTANCE.md) and [review findings](docs/reviews/findings.md) distinguish verified results from pending work. The mutating two-cycle command is documented in [the acceptance runbook](tests/e2e/README.md).

This is a single-machine synthetic hackathon demo, with a fixed reference date of September 27, 2026. It is not a production clinical system, and it implements no medication reconciliation or treatment decisions.
