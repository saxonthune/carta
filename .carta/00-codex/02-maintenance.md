---
title: Maintenance
status: active
summary: Doc lifecycle — unfolding philosophy, development loop, versioning, epochs
tags: [docs, maintenance, philosophy]
deps: []
---

# Maintenance

## Unfolding, Not Filling In

Docs differentiate over time, like embryonic development. A one-line entry in a list is a valid doc. A section with a title and three bullet points is a valid doc. Neither is "incomplete" — each represents the best current understanding at the level of detail the work has demanded so far.

Fleshing out happens when a project or user needs more detail, not proactively. Do not invent content to fill sparse docs. Do not treat brevity as a defect. A doc that says "Decision tables — spreadsheet-like editor for stateless branching logic" is finished until someone needs to design the editor.

This applies at every scale: a title can contain a single index file, a section can contain a single paragraph, a list item can stand alone without elaboration.

## The Development Loop

Docs develop through iteration, not completion. The rhythm is:

1. **Capture** — write a sparse doc from what is known right now. Don't elaborate beyond what was stated.
2. **Stress-test** — push on the edges. What's ambiguous? What are the options? What contradicts existing docs? Enumerate 2-4 concrete alternatives rather than asking open-ended questions.
3. **Update** — incorporate answers. Add decisions, refine open questions.
4. **Repeat** — go back to step 2 until the topic is stable enough for the work at hand.

This loop applies whether you're working alone, with a team, or with an AI agent. The goal is to draw knowledge out and make it explicit — not to fill in a template.

## Versioning

Git is the version system. No version numbers in documents.

- File history: `git log --follow .carta/03-product/features/canvas.md`
- Point-in-time snapshots: use git tags (`git tag docs-v1.0`)
- Blame for specific lines: `git blame .carta/02-system/01-overview.md`

## Epochs

Epochs are optional staleness markers. When a major architectural change happens, bump the epoch number in a central location and audit docs that reference the old epoch.

Add `epoch: N` to front matter of any doc you want tracked:

```yaml
---
title: Canvas
status: active
epoch: 1
---
```

Staleness audit:

```bash
grep -rn "epoch: 1" .carta/    # Find docs not yet reviewed for epoch 2
```

Epochs are coarse-grained — bump only on major shifts, not routine changes.

## Adding a Document

1. Identify the correct title by reader intent (see doc00.05)
2. Choose the next available number prefix
3. Add front matter with `status: draft`
4. Write content following conventions (doc00.03)
5. Add cross-references to/from related docs
6. Change status to `active` when reviewed

## Deprecating a Document

1. Set `status: deprecated` in front matter
2. Add a note at the top: "Superseded by docXX.YY"
3. Do not delete — git history is permanent, but grep should still find it
4. Update any docs that reference the deprecated doc

## Adding a Title

Almost never needed. The base titles (00-04) cover universal software documentation needs. If you need a project-specific title, use number 05 or higher and document the rationale in this file or doc00.05.
