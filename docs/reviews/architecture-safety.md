# Care Circle independent review

Owner: cc-review. Scope: docs/reviews/ only. Date: 2026-09-27.

## Current verdict

15:16 Pacific: the first live canonical-note read-only audit passes at revision 2. No open P0, P1 or P2 finding remains. R8's live-unknown lock edge is fixed with two absent-PID checks; independent source review and owner-reported 17/17 lifecycle tests support closure. Extraction, citation, persistent-discrepancy, future-date, UI and evaluation-verifier findings are fixed and verified. See findings.md and milestones.md for evidence tiers. Post-ingest restart, repeated reset-to-demo and browser/print evidence remain release gates, so this is not final release sign-off.

Recorded dose is a source claim, never conflict resolution or a treatment instruction. Each pharmacy claim is compared with the latest visit at or before its date and all subsequent visits. Unequal evidence persists even after a later matching visit. V1 has no reconciliation action. Future visits after the fixed September 27 reference date must reject before mutation; future follow-up dates remain allowed.

## Review gates

| Area | Evidence required | Owner |
| --- | --- | --- |
| GBrain reality | Seed pages imported into real GBrain; typed links extracted; state reconstructed after restart | cc-brain |
| Single writer | Family brain access belongs only to brain service; concurrent reset and ingest serialize | cc-brain, cc-runtime |
| Safe reset | HTTP reset restores only Care Circle pages; no database directory removal; no unknown-process stops | cc-brain, cc-runtime |
| Durable ingest | Interrupted writes do not leave partial visible state; duplicate keys survive restart without duplicate claims | cc-brain |
| Source truth | Every medication line and substantive brief claim cites an existing page whose text supports it | cc-brain, cc-brief |
| Uncertainty | Negated, ambiguous and unsupported note content is rejected or warned about; no invented confirmation | cc-ingest, cc-web |
| Contradictions | Historical visit changes are distinguished from unresolved visit/pharmacy disagreement | cc-brief, cc-web |
| Safety framing | Recorded source claims, synthetic identities and exact Not medical advice footer; no treatment instructions | cc-web, cc-world, cc-brief |
| River honesty | Same held-out split and prompt; measured results only; fallback named deterministic | cc-river, cc-ingest |
| Sponsor honesty | Local capture/replay and clinic fetching accurately labeled; no claim of official execution without evidence | cc-sponsors, cc-web |
| Network boundaries | Loopback binds and allowed ports; bounded requests; local fetch allowlist; no unauthorized submission | All service owners |
| Repeatability | Two reset-to-demo runs, with citations and contradictions checked after each | cc-qa, cc-runtime |

## Authorization interpretation

Synthetic River note/JSON uploads for training and evaluation are authorized. Only the River lane may load the single named RIVER_API_KEY variable from the approved forge environment file. Reviewers never read that file or other credentials. Memorable/UFO remote submission and account creation remain unapproved. Package installation and public technical documentation reads do not prove an integration ran.

## Initial observations

- scripts/brain and scripts/devbrain explicitly set separate brain homes and working directories and use per-brain mkdir locks. Lock interruption and recovery require runtime evidence because the lock has no owner receipt.
- Contract citations are page-addressable and medication claims preserve source IDs, dates and attendees. This supports an honest source-first implementation.
- No service implementation existed at the initial review. Planned risks above are acceptance gates, not asserted code defects.

## Review method

Read governing documents fully, inspect owner changes without editing them, and send prioritized findings with reproduction evidence to owners and cc-lead. Independent gpt-6-astra xhigh subreviewers cover brain/runtime, clinical information semantics, and sponsor/network honesty. Only synthetic fixtures and non-mutating service reads are permitted unless mutation tests are coordinated with their owners.

Milestone entries will distinguish direct test evidence, code inspection, owner reports, and remaining uncertainty.
