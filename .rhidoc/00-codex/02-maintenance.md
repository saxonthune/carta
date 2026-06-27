---
title: Maintenance
summary: Doc philosophy — docs convert volatile source signals into stable intent; declarative intent, banned patterns, prefer facts to prose (purposed terms, splits with criteria, directional facts), author freely then structure separately, when to grow detail
tags: [docs, maintenance, philosophy, relational-facts]
deps: []
---

# Maintenance

## Docs Convert Signals

A doc converts one signal into another. The source signal is the code and structure: high-volume, volatile, machine-truth. The output signal is human-legible intent: stable, durable, the team's articulated description of what the artifact is for.

The conversion's whole job is to **encode the invariant and discard the snapshot**. Most doc-writing failures are one error under this lens — leaking the volatile source signal into the stable artifact. A derived count ("14 commands"), a line number, a transient total, a current-state tally: these belong to the generator's output, not the prose. They rot silently the moment the source moves. Write the invariant the snapshot was an instance of ("`id` is the most-shared positional — a candidate for shared grammar"), never the snapshot itself.

The two rules below — declarative intent and the banned patterns — are corollaries of this thesis, not separate decrees.

## Docs Are Declarative Intent

Docs describe what the artifact intends to be, in literary present tense. They are not timelines, design briefs, or sequencing plans. Code is the concrete reality; docs are the team's articulated description of what the artifact is for and what it does.

Reconciliation compares docs (intent) against code (reality) and surfaces the gap. The human decides which side moved — whether the code drifted from the intent, or the intent was revised and the docs need updating. Timelines, phases, and sequencing plans belong in `.todo-tasks/`, git history, or ADRs — not in docs.

## Banned Patterns

An agent or human can grep for these before committing a doc:

- **Volatile snapshots**: exact counts, totals, line numbers, sizes, or any value derived from the current state of the source. These belong to the generator/output, not the prose. State the invariant, not the snapshot.
- **Future modals**: "will", "won't", "is going to", "going to", "shall", "would" (when describing planned behavior, not conditional logic)
- **Phase / version language**: "v0", "v1", "MVP", "POC", "Phase 1", "Phase 2", "next iteration", "first pass"
- **Deferral language**: "Deferred", "TODO", "PENDING", "Not yet", "Coming soon", "in the future", "for now"
- **Dated postscripts**: `## Status (YYYY-MM-DD)`, `## Update (YYYY-MM-DD)`, "as of YYYY-MM-DD" within prose
- **Retrospective framing**: "originally", "previously this said", "we used to"

**Allowed**: present-tense statements of fact about the artifact's intended behavior; conditional logic ("if X, the system rejects Y"); cross-references to other docs; the glossary.

**Exception**: ADRs in a decisions directory are explicitly dated, immutable records of decisions and may contain dated or historical language. Research session docs likewise record a dated inquiry.

**Examples:**

| ✗ Leaked signal | ✓ Stable intent |
|---|---|
| "The pipeline will emit a structured error object." | "The pipeline emits a structured error object." |
| "Deferred for v1 — currently returns 404." | "The endpoint returns 404 when the resource does not exist." |
| "As of 2024-03-01, auth uses JWT." | "Auth uses JWT." |
| "The `id` positional recurs across 14 commands." | "`id` is the most-shared positional — a candidate for shared grammar." |

## Prefer Facts to Prose

Banned patterns say what to strip; this says what form the surviving content takes. The stable signal a doc encodes is carried best as relational facts, not loose explanation — the same discipline as code comments, where a fact moved into the code (a named constant, a type) beats a sentence describing it. Three shapes carry almost everything a spec needs:

- **Purposed terms** — a term with a one-line *purpose* (why it exists), not a restatement of its name. The purpose is the part a reader cannot recover from the word itself, so it is the part worth writing.
- **Named splits with a criterion** — "X vs Y — split by ⟨criterion⟩". A split with a crisp criterion is a boundary stated in prose: it tells a reader, or an agent generating code, where a type, enum, or state seam falls, without code being written.
- **Directional facts** — "A ⟨verb⟩s B", with direction; the verbs are the operations. A fact gives its reverse reading for free, and facts chain, so the derived ones need not be written. State only the load-bearing facts and cardinalities.

Reserve prose for the irreducible *why* — the rationale, invariant, or surprise no fact captures. When a loose sentence can become a fact, a split, or a purposed term, convert it; prose is the residue, not the default. A reader and an agent both act more reliably on a fact than on a paragraph: a fact is re-stated without invention, where prose invites it.

## Author Freely, Structure Separately

Compose reasoning and prose in free form, then commit it to the doc through a separate placement step — a normalization pass over the draft — rather than composing directly into the document's structure.

The order matters for quality. Forcing generation *into* a structured form taxes reasoning and writing; drafting freely and structuring afterward avoids that cost. Length and density are enforced when the draft is committed, not while it is written: the commit step is the gate that caps, trims, and de-duplicates, so prose is less likely to run long because the gate holds the bound — not because structure makes the model terse. Reason in the open; let the artifact be a normalized copy of the draft, not a straitjacket on the writing.

## When the Artifact Changes

When the artifact changes, rewrite the doc in place to reflect what is intended now. Never append a `## Status` section, a dated update, or an "originally" note — these turn docs into layered diaries.

If the previous intent is historically significant, record it in an ADR. If the change is not yet implemented, it belongs in `.todo-tasks/`, not in the doc.

## Growing a Doc

Docs differentiate over time, like embryonic development. A one-line entry is a valid doc. A section with three bullet points is a valid doc. Neither is "incomplete" — each represents the best current understanding at the level of detail the work has demanded so far.

Fleshing out happens when a project or person needs more detail, not proactively. Do not invent content to fill sparse docs. Do not treat brevity as a defect. A doc that says "Payment processing — Stripe integration for subscription billing" is finished until someone needs to design the billing flow.

This applies at every scale: a group can contain a single index file, a section can contain a single paragraph, a list item can stand alone without elaboration.

### Where to Start

Start with what the product is for — one sentence in a purpose doc. Then write the first thing you'd build: the smallest action sequence that proves the idea works. Don't create groups for architecture or operations until you have something to architect or operate.

Groups unfold when the work demands them, not upfront. An empty group with just an index file is busywork — don't create it until you have a real doc to put in it.

### The Development Loop

Docs develop through iteration, not completion. The rhythm is:

1. **Capture** — write a sparse doc from what is known right now. Don't elaborate beyond what was stated.
2. **Stress-test** — push on the edges. What's ambiguous? What are the options? What contradicts existing docs? Enumerate 2-4 concrete alternatives rather than asking open-ended questions.
3. **Update** — incorporate answers. Add decisions, refine open questions.
4. **Repeat** — go back to step 2 until the topic is stable enough for the work at hand.

This loop applies whether you're working alone, with a team, or with an AI agent. The goal is to draw knowledge out and make it explicit — not to fill in a template.

## Versioning

Git is the version system. No version numbers in documents.

- File history: `git log --follow .rhidoc/01-context/01-mission.md`
- Point-in-time snapshots: use git tags (`git tag docs-v1.0`)
- Blame for specific lines: `git blame .rhidoc/02-system/01-overview.md`

## Adding a Document

1. Identify the correct group by reader intent
2. Choose the next available number prefix
3. Add frontmatter with title, summary, tags, and any deps
4. Write content following conventions (doc00.03)
5. Add cross-references to/from related docs
