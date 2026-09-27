# Care Circle execution plan

Build date: Sunday 2026-09-27, Pacific time. Lead: cc-lead in herdr session carecircle. All lanes and subagents use gpt-6-astra xhigh. Code freeze 16:40; demo prep only 16:40 to 16:55.

## Milestones

| Time | Testable result | Gate |
| --- | --- | --- |
| 15:15 M1 | Public repo, contract, synthetic world, service health endpoints, initial family screen | Start and health checks; GBrain seed import proven |
| 15:35 M2 | Paste note, cited medication list, preserved 10 vs 20 mg source conflict | HTTP path ingest -> brain -> brief and UI refresh |
| 15:55 M3 | Printable nephrologist brief, procedure replay, local clinic fetch, River corpus and honest eval | End-to-end acceptance; independent review |
| 16:15 M4 | All demo steps integrated, sponsor reality labels, runtime/reset reliable | First full demo from clean reset; review fixes |
| 16:35 M5 | Repeated demo, final README, code map and push | Two consecutive reset-to-demo passes |
| 16:40 | Freeze code and record exact commit | Final health check; 2-minute script in STATUS |

## Work organization

Ten lanes: world, brain, ingest, brief, web, River, sponsors, runtime, acceptance QA, independent review. Lead owns shared contract, integration decisions and release. Components have disjoint folders and communicate over loopback HTTP. World is the static seed package consumed by brain. Subagents may plan, implement a strictly delegated subfolder, or review; lane owner retains integration ownership and exact model restriction. Do not delegate shared paths casually.

The core path is world -> GBrain -> ingest -> cited answer and contradiction -> previsit -> UI. Prioritize a real GBrain workflow over optional sponsor breadth. River lane prepares corpus, same-prompt evaluation, and opt-in training submission. Sponsors lane builds the local procedure and site while checking official integration feasibility. No external data submissions until Emre authorizes the exact payload.

Review continuously: contract mismatches, source citations, truthful sponsor claims, unsupported note behavior, double-submit idempotency, reset safety, loopback binding, and secrets. QA owns tests, reviewers own findings, component owners apply fixes. Lead updates STATUS at least every 20 minutes, starting at kickoff. Every lane updates its code/<component> devbrain page at each milestone.
