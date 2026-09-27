---
title: Synthetic Rose world package
---

# code/world

## Purpose

Supply a self-contained fictional Rose Alvarez source graph and deterministic seed for the Care Circle family brain. Thirty pages cover one patient, three adult children, four doctors, seven medications, six baseline visits, two insurer calls, three original lab reports, one pharmacy record, and three open questions. Every page states synthetic and non-advice framing.

## Run

`node packages/world/build.mjs` regenerates checked-in artifacts. `npm test --prefix packages/world` validates them offline. This static package opens no service, port, or database.

## Files

`packages/world/build.mjs` authors the fixtures. `seed.json` is the consumer contract. `pages/<page-id>.md` contains human source text and durable metadata. `smoke.mjs` verifies references, dates, quotes, metadata parity, baseline source agreement, counts, and framing. `README.md` documents chronology and consumption. This file is the local source for the code map.

## API

Seed JSON is `{patientId,pages}`. Each page has `{id,type,title,body,fields,links,updatedAt}`. A single `care-circle-page` Markdown fence carries the same metadata excluding body. Seed body is human Markdown only. The brain imports actual Markdown with no embeddings and extracts links. Each medication claim has a matching exact quote in `fields.citations`. Labs use a self-referencing sourceId for the original report and associatedVisitId for visit context.

## Depends on

[[code/contract]] defines stable IDs and shapes. [[code/brain]] is the only consumer allowed to import the static world and the only owner of the product GBrain. [[code/brief]] consumes brain HTTP state and distinguishes amlodipine history from unresolved source conflicts. [[code/ingest]] adds the contract's September 27 cardiology note; that event is absent from the baseline seed.

## Gotchas

The initial recorded lisinopril and pharmacy claims are both 10 mg daily. September 27 ingestion supplies the 20 mg source claim and potassium recheck, exposing a later visit/pharmacy discrepancy. Older amlodipine 2.5 mg is retained history; September 23 visit and September 24 pharmacy agree on 5 mg daily. No interpretations, treatment instructions, actual insurer calls, or sponsor integrations occur in this package. Never open the product brain or invoke plain GBrain. Use scripts/devbrain for this map. Owned paths are packages/world/ only.

## Milestone evidence

Early seed committed and pushed as d3c5a0b: 30 pages, 120 resolving links, 21 exact medication citations; smoke passes. Astra xhigh reviewer cc-world-review confirmed a clean recheck after three initial findings were fixed before that commit. See packages/world/REVIEW.md for scope and receipts. Product import/restart evidence belongs to cc-brain.
