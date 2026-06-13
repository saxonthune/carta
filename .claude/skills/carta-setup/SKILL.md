---
name: carta-setup
description: First-time setup and health diagnostics for a Carta workspace. Run after `carta init`, or any time the workspace feels out of sync.
---

# carta-setup

First-time setup and health diagnostics for a Carta workspace. Run this once after
`carta init`, or any time the workspace feels out of sync. This skill is only loaded
when invoked, so it costs nothing on normal runs.

## When This Triggers

- `/carta-setup`
- "set up carta" / "wire up carta" / "is my carta workspace healthy?" / "diagnose carta"

## What This Does

Walk these steps in order. Report findings as you go; only change files with the
user's go-ahead.

### 1. Locate the workspace

Find the `.carta-workspace` marker and the workspace directory it points at (default
`.carta/`). If there is no marker, the project has no workspace — offer to run
`carta init`. Stop here if so.

### 2. Check the agent wiring

The workspace ships a generated `AGENTS.md` (e.g. `.carta/AGENTS.md`) with the four
rules for working in it. Confirm it exists and is current:

```bash
carta init --rehydrate --dry-run
```

If it reports the wiring or codex templates are stale, offer to run
`carta init --rehydrate` (without `--dry-run`) to refresh them.

### 3. Check the CLAUDE.md / AGENTS.md pointer

The project's top-level `CLAUDE.md` (or `AGENTS.md`) should point agents at the
workspace. Grep it for a reference to `.carta/AGENTS.md` or `MANIFEST.md`. If
missing, offer to add this pointer (do not duplicate the workspace's own rules —
just link to them):

```markdown
## Documentation
This repo uses a `.carta/` spec workspace. Read `.carta/AGENTS.md` for how to
navigate and edit it, and `.carta/MANIFEST.md` for the doc index.
```

### 4. Verify the CLI is reachable

Confirm `carta --version` runs. If `carta` is not on PATH, check whether the
workspace is portable (a `carta.py` shim inside the workspace dir) and tell the
user the `python3 <dir>/carta.py` entry point. Offer `carta portable` if neither
works.

### 5. Run a structural health check

```bash
carta regenerate          # rebuild MANIFEST from current state
carta orphans             # list attachments with no host doc
```

Surface any orphaned attachments or regeneration warnings. A clean regenerate with
no orphans means the workspace is internally consistent.

### 6. Summarize

Report: workspace location and title, doc count, whether wiring + pointer are in
place, CLI reachability, and any health warnings. Recommend next actions only for
the things that are actually wrong — a healthy workspace needs no changes.

## Growing this skill

This is the project's general-purpose Carta diagnostics entry point. As new
failure modes surface (stale MANIFEST, broken refs, missing codex docs, version
skew between the installed CLI and the workspace), add a numbered check above
rather than spreading guidance across CLAUDE.md.
