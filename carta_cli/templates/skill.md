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

## Frontmatter Schema

Every workspace doc has YAML frontmatter:

```yaml
---
title: My Document
status: draft
summary: One-line description for MANIFEST
tags: [keyword1, keyword2]
deps: [doc01.02]
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Display name |
| `status` | yes | `active`, `draft`, `archived`, `implemented` |
| `summary` | yes | One-line description for MANIFEST |
| `tags` | yes | Keywords for retrieval |
| `deps` | no | Doc refs to check when this doc changes |
