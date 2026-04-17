# carta-cli

Reference for the `carta` CLI — structural operations on `{{dir_name}}/` workspaces.

## When This Triggers
- "restructure the docs" / "move docs around" / "delete a section" / "create a new doc"
- `/carta-cli`

## Key Principle
Structural changes via `carta` CLI. Content via Write/Edit. Always regenerate at end.

## Running Commands
```bash
carta <command> [options]
carta --help                # list all commands
carta <command> --help      # command-specific help
carta -w /path/{{dir_name}} <cmd> # explicit workspace path
```

The CLI finds the workspace by walking up from cwd (like `git` finds `.git/`).

## Bundles and Attachments

A **bundle** is a group of siblings sharing a two-digit numeric prefix. The `NN-<slug>.md` file is the root; any other `NN-*.<ext>` siblings are attachments (sidecars — e.g., `02-model.json` alongside `02-workflow.md`).

Structural ops (`move`, `delete`, `rename`, `punch`, `flatten`) treat a bundle as a unit — attachments travel with their host automatically. Use `carta attach <source> <host>` to add a new sidecar. Orphaned sidecars (no matching root) are reported on stderr during `regenerate` but do not block it.

## Frontmatter Schema

Every workspace doc has YAML frontmatter:

```yaml
---
title: My Document
summary: One-line description for MANIFEST
tags: [keyword1, keyword2]
deps: [doc01.02]
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Display name |
| `summary` | yes | One-line description for MANIFEST |
| `tags` | yes | Keywords for retrieval |
| `deps` | no | Doc refs to check when this doc changes |
