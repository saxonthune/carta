---
name: rhidoc-setup
description: First-time setup and health diagnostics for a Rhidoc workspace. Run after `rhidoc init`, or any time the workspace feels out of sync.
---

# rhidoc-setup

First-time setup and health diagnostics for a Rhidoc workspace. Run this once after
`rhidoc init`, or any time the workspace feels out of sync. This skill is only loaded
when invoked, so it costs nothing on normal runs.

## When This Triggers

- `/rhidoc-setup`
- "set up rhidoc" / "wire up rhidoc" / "is my rhidoc workspace healthy?" / "diagnose rhidoc"

## What This Does

Walk these steps in order. Report findings as you go; only change files with the
user's go-ahead.

### 1. Locate the workspace

Find the `.rhidoc-workspace` marker and the workspace directory it points at (default
`.rhidoc/`). If there is no marker, the project has no workspace — offer to run
`rhidoc init`. Stop here if so.

### 2. Check the agent wiring

The workspace ships a generated `AGENTS.md` (e.g. `.rhidoc/AGENTS.md`) with the four
rules for working in it. Confirm it exists and is current:

```bash
rhidoc init --rehydrate --dry-run
```

If it reports the wiring or codex templates are stale, offer to run
`rhidoc init --rehydrate` (without `--dry-run`) to refresh them.

### 3. Check the CLAUDE.md / AGENTS.md pointer

The project's top-level `CLAUDE.md` (or `AGENTS.md`) should point agents at the
workspace. Grep it for a reference to `.rhidoc/AGENTS.md` or `MANIFEST.md`. If
missing, offer to add this pointer (do not duplicate the workspace's own rules —
just link to them):

```markdown
## Documentation
This repo uses a `.rhidoc/` spec workspace. Read `.rhidoc/AGENTS.md` for how to
navigate and edit it, and `.rhidoc/MANIFEST.md` for the doc index.
```

### 4. Verify the CLI is reachable

Confirm `rhidoc --version` runs. If `rhidoc` is not on PATH, check whether the
workspace is portable (a `rhidoc.py` shim inside the workspace dir) and tell the
user the `python3 <dir>/rhidoc.py` entry point. Offer `rhidoc portable` if neither
works.

### 5. Run a structural health check

```bash
rhidoc regenerate          # rebuild MANIFEST from current state
rhidoc orphans             # list attachments with no host doc
```

Surface any orphaned attachments or regeneration warnings. A clean regenerate with
no orphans means the workspace is internally consistent.

### 6. Summarize

Report: workspace location and title, doc count, whether wiring + pointer are in
place, CLI reachability, and any health warnings. Recommend next actions only for
the things that are actually wrong — a healthy workspace needs no changes.

## Growing this skill

This is the project's general-purpose Rhidoc diagnostics entry point. As new
failure modes surface (stale MANIFEST, broken refs, missing codex docs, version
skew between the installed CLI and the workspace), add a numbered check above
rather than spreading guidance across CLAUDE.md.
