---
title: Maintenance
summary: Doc lifecycle — unfolding philosophy, development loop, versioning, epochs
tags: [docs, maintenance, philosophy]
deps: []
---

# Maintenance

## Unfolding, Not Filling In

Docs differentiate over time, like embryonic development. A one-line entry is a valid doc. A section with a title and three bullet points is a valid doc. Neither is "incomplete" — each represents the best current understanding at the level of detail the work has demanded so far.

Fleshing out happens when a project or person needs more detail, not proactively. Do not invent content to fill sparse docs. Do not treat brevity as a defect. A doc that says "Payment processing — Stripe integration for subscription billing" is finished until someone needs to design the billing flow.

This applies at every scale: a group can contain a single index file, a section can contain a single paragraph, a list item can stand alone without elaboration.

## Where to Start

Start with what the product is for — one sentence in a purpose doc. Then write the first thing you'd build: the smallest action sequence that proves the idea works. Don't create groups for architecture or operations until you have something to architect or operate.

Groups unfold when the work demands them, not upfront. An empty group with just an index file is busywork — don't create it until you have a real doc to put in it.

## The Development Loop

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

## Epochs

Epochs are optional staleness markers. When a major change happens, bump the epoch number in a central location and audit docs that reference the old epoch.

Add `epoch: N` to frontmatter of any doc you want tracked:

```yaml
---
title: Authentication
epoch: 1
---
```

Staleness audit:

```bash
grep -rn "epoch: 1" {{dir_name}}/    # Find docs not yet reviewed for epoch 2
```

Epochs are coarse-grained — bump only on major shifts, not routine changes.

## Adding a Document

1. Identify the correct group by reader intent
2. Choose the next available number prefix
3. Add frontmatter with title, summary, tags, and any deps
4. Write content following conventions (doc00.03)
5. Add cross-references to/from related docs

## Deprecating a Document

1. Add a note at the top: "Superseded by docXX.YY"
2. Archive the doc or remove it when it's no longer useful
3. Update any docs that reference the deprecated doc
