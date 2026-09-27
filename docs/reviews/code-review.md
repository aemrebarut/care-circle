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
- docs/reviews/code-review.md: source for this code map page.

## API

No service or HTTP API. Review outputs are prioritized findings with source locations, reproduction evidence and fix status.

## Depends on

[[code/brain]], [[code/world]], [[code/ingest]], [[code/brief]], [[code/web]], [[code/river]], [[code/sponsors]], [[code/runtime]], [[code/qa]].

## Gotchas

Only docs/reviews/ is writable by this lane. Do not mutate the shared demo or access family GBrain storage. Use scripts/devbrain for code-map updates and link extraction. River has a narrowly scoped synthetic training/evaluation authorization; reviewers have no credential exception. Recorded medication dose does not settle a pharmacy discrepancy. No implementation defect is inferred merely because an acceptance test is pending.
