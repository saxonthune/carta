# carta-cli

Reference for the `carta` CLI — structural operations on `.carta/` workspaces.

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
carta -w /path/.carta <cmd> # explicit workspace path
```

The CLI finds `.carta/` by walking up from cwd (like `git` finds `.git/`).

## Commands

### init
Initialize a new `.carta/` workspace. Already done for this project.

### create
```
carta create <destination> <slug> [--order N] [--title "..."] [--dry-run]
```
Create a new doc entry with blank frontmatter. Appends by default.

### delete
```
carta delete <target>... [--dry-run] [--output-mapping]
```
Delete entries with automatic gap-closing and ref rewriting.

### move
```
carta move <source> <destination> [--order N] [--rename <slug>] [--mkdir] [--dry-run]
```
Move/reorder/rename a doc entry with automatic ref renumbering.

### punch
```
carta punch <source> [--dry-run]
```
Expand a leaf file into a directory (`NN-slug.md` -> `NN-slug/00-index.md`).

### flatten
```
carta flatten <source> [--keep-index] [--force] [--at N] [--dry-run]
```
Dissolve a directory, hoisting children into the parent.

### copy
```
carta copy <source_file> <destination> [--order N] [--rename slug] [--dry-run]
```
Copy a file into the workspace at a given position.

### rewrite
```
carta rewrite --map old=new [--map old2=new2 ...] [--from-json mappings.json] [--dry-run]
```
Rewrite doc refs across the workspace using user-supplied mappings.

### regenerate
```
carta regenerate [--dry-run]
```
Rebuild MANIFEST.md from filesystem and doc frontmatter. All structural commands run this automatically.

## Frontmatter Schema

Every `.carta/` doc has YAML frontmatter:

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
