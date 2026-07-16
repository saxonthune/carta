---
title: Drift
summary: Why docs drift and the rules that prevent it — the two-copies condition, the reason-to-write test, the generate-or-type escape for shared facts, timeless writing, and the banned-pattern list
tags: [docs, drift, maintenance, style]
deps: []
---

# Drift

Drift is a doc falling out of step with the thing it describes. The rules here are not house taste. The timeless-writing rules follow the **Google developer documentation style guide** ("write timeless documentation") and the **Wikipedia Manual of Style** (avoid statements that date quickly). The duplication rules are the **DRY rule** — Hunt & Thomas: every piece of knowledge has one authoritative representation — applied across the doc–code boundary, with **Lehman's laws** of software evolution as the reason it matters: a system under continuing change desynchronizes any fact held in two places. The generate-or-type escape follows model-driven practice and Martraire's **Living Documentation**: volatile knowledge is generated from the source; only stable knowledge is written by hand.

## Why Docs Drift

A doc and its subject fall out of step only when both state the same fact. Two copies of one fact desynchronize as the system changes, because only one copy gets maintained — and a stale copy is worse than no copy, because a reader (human or agent) trusts it. A doc that states only intent — what must hold, not how it is done — has no second copy to collide with, so it cannot drift this way. Code implements a doc's intent the way a class implements an interface: many implementations can satisfy one stated intent, and the intent stays true while the code moves.

Every rule below is this one rule seen from a different side: write only what the source cannot show.

## The Reason-to-Write Test

Before writing a fact into a doc, ask: could a reader recover this fact from the code in front of them? If yes, it is mechanism — leave it in the code; writing it down creates the second copy that will drift. If no, it is intent — the why, the invariant, the deliberate surprise — and the doc is where it lives. This is the comment rule ("say only what the code can't") applied to every design artifact.

## When Both Must State a Fact

Some facts must appear in the doc and in the code — a wire format, a field order, a threshold. Here the second copy is forced and drift returns. Two escapes, either better than maintaining the fact by hand in two places:

- **Generate** one artifact from the other, so there is one source and one derived view.
- **Promote** the fact into a type, schema, or test the tools check, so a desync is a visible error instead of silent rot.

## Timeless Writing

Docs state current truth in present tense. History lives in git and in ADRs; plans live in the task tracker. A doc that narrates its own past ("renamed from", "we used to") or its future ("will", "phase 2") holds copies of facts whose real sources are the repository's history and its plans — the same two-copies failure, in time instead of in code.

## Banned Patterns

An agent or human can grep for these before committing a doc:

- **Volatile snapshots**: exact counts, totals, line numbers, sizes, or any value derived from the current state of the source. These belong to the generator's output, not the prose. State the invariant, not the snapshot.
- **Future modals**: "will", "won't", "is going to", "shall", "would" (when describing planned behavior, not conditional logic)
- **Phase / version language**: "v0", "v1", "MVP", "POC", "Phase 1", "Phase 2", "next iteration", "first pass"
- **Deferral language**: "Deferred", "TODO", "TBD", "PENDING", "Not yet", "Coming soon", "in the future", "for now"
- **Open-questions sections**: an "Open Questions", "TODO", or "research seed" section in a doc body. It records a passing state of knowledge, and a later reader cannot tell a live question from one already answered elsewhere. Raise open questions with the user, or file them in the task tracker. (A deliberate openness — a choice the artifact intentionally leaves free — is intent; state it as a decided fact.)
- **Dated postscripts**: `## Status (YYYY-MM-DD)`, `## Update (YYYY-MM-DD)`, "as of YYYY-MM-DD" within prose
- **Retrospective framing**: "originally", "previously this said", "we used to", "we decided"
- **Rename narration**: "renamed from", "formerly", "previously called". The old name lives in git, and a doc carrying both names asserts two truths at once.

**Allowed**: present-tense statements of fact about the artifact's intended behavior; conditional logic ("if X, the system rejects Y"); cross-references to other docs; the glossary.

**Exception**: ADRs in a decisions directory are explicitly dated, immutable records of decisions and may contain dated or historical language. Research session docs likewise record a dated inquiry.

**Examples:**

| ✗ Drifts | ✓ Holds |
|---|---|
| "The pipeline will emit a structured error object." | "The pipeline emits a structured error object." |
| "Deferred for v1 — currently returns 404." | "The endpoint returns 404 when the resource does not exist." |
| "As of 2024-03-01, auth uses JWT." | "Auth uses JWT." |
| "The `id` positional recurs across 14 commands." | "`id` is the most-shared positional — a candidate for shared grammar." |
| "Open question: should retries be capped?" | Ask the user or file a task; the doc states the decided behavior. |
| "Session (renamed from Connection) wraps the socket." | "Session wraps the socket." |

## When the Artifact Changes

When the artifact changes, rewrite the doc in place to say what is intended now. Never append a `## Status` section, a dated update, or an "originally" note — these turn docs into layered diaries.

If the previous intent is historically significant, record it in an ADR. If the change is not yet implemented, it belongs in the task tracker, not in the doc.
