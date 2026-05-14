---
title: Maintenance
summary: Doc philosophy — declarative intent, banned patterns, when to grow detail
tags: [docs, maintenance, philosophy]
deps: []
---

# Maintenance

## Docs Are Declarative Intent

Docs describe what the artifact intends to be, in literary present tense. They are not timelines, design briefs, or sequencing plans. Code is the concrete reality; docs are the team's articulated description of what the artifact is for and what it does.

Reconciliation compares docs (intent) against code (reality) and surfaces the gap. The human decides which side moved — whether the code drifted from the intent, or the intent was revised and the docs need updating. Timelines, phases, and sequencing plans belong in `.todo-tasks/`, git history, or ADRs — not in docs.

## Banned Patterns

An agent or human can grep for these before committing a doc:

- **Future modals**: "will", "won't", "is going to", "going to", "shall", "would" (when describing planned behavior, not conditional logic)
- **Phase / version language**: "v0", "v1", "MVP", "POC", "Phase 1", "Phase 2", "next iteration", "first pass"
- **Deferral language**: "Deferred", "TODO", "PENDING", "Not yet", "Coming soon", "in the future", "for now"
- **Dated postscripts**: `## Status (YYYY-MM-DD)`, `## Update (YYYY-MM-DD)`, "as of YYYY-MM-DD" within prose
- **Retrospective framing**: "originally", "previously this said", "we used to"

**Allowed**: present-tense statements of fact about the artifact's intended behavior; conditional logic ("if X, the system rejects Y"); cross-references to other docs; the glossary.

**Exception**: ADRs in a decisions directory are explicitly dated, immutable records of decisions and may contain dated or historical language.

**Examples:**

| ✗ Temporal prose | ✓ Declarative intent |
|---|---|
| "The pipeline will emit a structured error object." | "The pipeline emits a structured error object." |
| "Deferred for v1 — currently returns 404." | "The endpoint returns 404 when the resource does not exist." |
| "As of 2024-03-01, auth uses JWT." | "Auth uses JWT." |

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

- File history: `git log --follow {{dir_name}}/01-context/01-mission.md`
- Point-in-time snapshots: use git tags (`git tag docs-v1.0`)
- Blame for specific lines: `git blame {{dir_name}}/02-system/01-overview.md`

## Adding a Document

1. Identify the correct group by reader intent
2. Choose the next available number prefix
3. Add frontmatter with title, summary, tags, and any deps
4. Write content following conventions (doc00.03)
5. Add cross-references to/from related docs
