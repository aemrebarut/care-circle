---
title: Care Circle independent review
---

# code/review

## Purpose

Independent architecture, safety and honesty review of Care Circle. Reviewers record findings and validate owner fixes without changing implementation.

## Run

Read docs/reviews/architecture-safety.md. Inspect relevant owner code and run only coordinated, bounded checks. Send findings through herdr session carecircle to cc-lead and the relevant cc- owner.

## Files

- docs/reviews/architecture-safety.md: review gates, evidence and verdict.
- docs/reviews/findings.md: reproducible findings, owner disposition and direct fix verification.
- docs/reviews/milestones.md: milestone receipts with direct versus owner-reported evidence.
- docs/reviews/code-review.md: source for this code map page.

## API

No service or HTTP API. Review outputs are prioritized findings with source locations, reproduction evidence and fix status.

## Depends on

[[code/brain]], [[code/world]], [[code/ingest]], [[code/brief]], [[code/web]], [[code/river]], [[code/sponsors]], [[code/runtime]], [[code/qa]].

## Gotchas

Only docs/reviews/ is writable by this lane. Do not mutate the shared demo or access family GBrain storage. Use scripts/devbrain for code-map updates and link extraction. River has a narrowly scoped synthetic training/evaluation authorization; reviewers have no credential exception. Recorded medication dose does not settle a pharmacy discrepancy. No implementation defect is inferred merely because an acceptance test is pending.

## Milestone evidence

M1: independent live read-only audit passed at revision 2 with 32 pages, 132 links, seven medications, 40 checked citation instances and the unresolved 20 mg visit versus 10 mg pharmacy claim. R1 through R13 are closed after the R8 live-unknown lock follow-up. Baseline restart is owner-reported; post-ingest restart and two reset-to-demo passes remain pending. No trained-model success or official Memorable/UFO execution is claimed. See docs/reviews/milestones.md for precise test receipts.

15:25 follow-up: runtime and ingest report the post-ingest restart and unchanged retry passed. Real River comparison receipts support 72/72 structured and 71/72 full-task trained success on the fixed synthetic holdout, with base truncation and raw-completion caveats. The separate demo sample failed its source guard. R14 requires receipt-bound provenance before any accepted replay is published. Official Memorable offline recall is manually seeded, not learned trace extraction; remote approval remains pending. QA owns the live mutation/UI window.
