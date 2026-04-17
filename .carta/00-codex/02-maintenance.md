---
title: Maintenance
summary: Doc lifecycle — unfolding philosophy, development loop, versioning, epochs
tags: [docs, maintenance, philosophy]
deps: []
---

# Maintenance

## Unfolding, Not Filling In

Docs differentiate over time, like embryonic development. A one-line entry in a list is a valid doc. A section with a title and three bullet points is a valid doc. Neither is "incomplete" — each represents the best current understanding at the level of detail the work has demanded so far.

Fleshing out happens when a project or user needs more detail, not proactively. Do not invent content to fill sparse docs. Do not treat brevity as a defect. A doc that says "Decision tables — spreadsheet-like editor for stateless branching logic" is finished until someone needs to design the editor.

This applies at every scale: a title can contain a single index file, a section can contain a single paragraph, a list item can stand alone without elaboration.

## Structure-Preserving Transformations

Every change to the workspace — adding a doc, splitting a section, refining a concept — should be a structure-preserving transformation (Alexander, *The Nature of Order*). A transformation is structure-preserving when:

1. **Existing centers are not destroyed.** A doc that existed before still exists after (or was deliberately deprecated, not accidentally broken).
2. **New structure emerges from what exists.** A new doc grows out of a section that outgrew its parent, not from an abstract plan.
3. **The whole is more coherent after.** The workspace is easier to navigate, clearer to read, more useful for the work at hand.

The opposite — restructuring the entire workspace to match a new taxonomy — is a structure-destroying transformation. It breaks cross-references, invalidates reader habits, and produces a workspace that looks clean but hasn't been tested by use.

Prefer additive changes: new docs over restructured docs, new sections over rewritten sections. A workspace refactor (move, punch, flatten) is a significant event, not a routine operation — the coherence smell must be real, not aesthetic.

## Where to Start

Start with what the product is for — one sentence in a purpose doc. Then write the first thing you'd build: the smallest action sequence that proves the idea works. Don't create titles for architecture or operations until you have something to architect or operate.

Titles unfold when the work demands them, not upfront. An empty title with just an index file is busywork — don't create it until you have a real doc to put in it.

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
3. Add front matter with title, summary, tags, and any deps
4. Write content following conventions (doc00.03)
5. Add cross-references to/from related docs

## Deprecating a Document

1. Add a note at the top: "Superseded by docXX.YY"
2. Archive the doc or remove it when it's no longer useful
3. Update any docs that reference the deprecated doc

## Adding a Title

Almost never needed. The base titles (00-04) cover universal software documentation needs. If you need a project-specific title, use number 05 or higher and document the rationale in this file or doc00.05.
