# Workspace Operations

Reference for structural changes to `.carta/` workspaces.

## When This Triggers
- "restructure the docs" / "move docs around" / "delete a section" / "create a new doc"
- `/workspace-ops`

## Key Principle
Structural changes via `carta` CLI. Content via Write/Edit. Always regenerate at end.

## Running Commands
```bash
python3 .carta/utils/carta <command> [options]
python3 .carta/utils/carta --help           # list all commands
python3 .carta/utils/carta <command> --help  # command-specific help
```

## Commands

### create

Create a new doc entry with blank frontmatter.

```
carta create <destination> <slug> [--order N] [--title "..."] [--dry-run]
```

- `<destination>` — ref or path to an existing directory (e.g. `doc01`, `01-product`)
- `<slug>` — slug for the new file (no numeric prefix). e.g. `my-feature`
- `--order N` — insert at position N (1-indexed). Position must be free. Default: append after highest.
- `--title` — override the title (default: derived from slug via title-case)
- Creates `NN-slug.md` with draft frontmatter and `# Title` heading
- Runs `regenerate` automatically

**Examples**:
```bash
carta create doc00 test-doc                        # append to 00-codex/
carta create doc01 new-feature --order 3           # create at position 03
carta create doc02 my-section --title "My Section" # custom title
carta create doc00 test-doc --dry-run              # preview only
```

### delete

Delete one or more doc entries with automatic gap-closing.

```
carta delete <target>... [--dry-run]
```

- Accepts refs (`doc01.02`) or paths (`01-product/02-features`)
- Deletes files and directories (recursive)
- Gap-closes siblings (renumbers sequentially)
- Rewrites refs for renumbered siblings
- Warns about orphaned refs (refs in prose pointing to deleted docs are left as-is)
- Runs `regenerate` automatically

**Examples**:
```bash
carta delete doc04.01                    # delete a single doc
carta delete doc01.02 doc01.03           # delete multiple entries
carta delete doc04.01 --dry-run          # preview deletions + orphan warnings
```

### move

Move and/or rename a doc entry with automatic ref renumbering.

```
carta move <source> <destination> [--order N] [--rename <slug>] [--mkdir] [--dry-run]
```

- `--order N` — insert at position N (1-indexed). Default: append.
- `--rename SLUG` — change the slug (part after `NN-`)
- `--mkdir` — create destination directory if it doesn't exist (one level only; parent must exist). Creates `00-index.md` with minimal frontmatter.
- Bumps destination siblings, gap-closes source siblings
- Rewrites all `docXX.YY` refs across workspace

**Examples**:
```bash
carta move doc01.02.01 doc01 --order 2                           # promote into parent
carta move doc01.02.01 . --rename diagramming                   # rename slug in place
carta move doc01.02.01 doc01 --order 2 --rename diagramming     # move + rename
carta move doc04 01-product --mkdir --order 3 --rename research  # move into new dir
```

### punch

Expand a leaf file into a directory.

```
carta punch <source> [--dry-run]
```

- Turns `NN-slug.md` into `NN-slug/00-index.md`
- Doc ref remains stable
- No sibling renumbering needed

**Example**:
```bash
carta punch doc01.02.01.01    # 01-canvas.md → 01-canvas/00-index.md
```

### flatten

Dissolve a directory, hoisting children into the parent.

```
carta flatten <source> [--keep-index] [--force] [--at N] [--dry-run]
```

- `--keep-index` — preserve `00-index.md` as a numbered sibling
- `--force` — discard index even if it has significant content (>10 lines)
- `--at N` — insert children starting at position N (default: flattened dir's position)

**Examples**:
```bash
carta flatten doc01.02                # dissolve features/, promote children
carta flatten doc01.02 --keep-index   # same, but keep index as sibling
```

### regenerate

Rebuild MANIFEST.md from filesystem and doc frontmatter.

```
carta regenerate [--dry-run]
```

All structural commands run `regenerate` automatically. Use manually only if you edited frontmatter directly.

## Common Workflows

### Creating a new doc
```bash
carta create <destination-ref> <slug> [--order N] [--title "..."]
```
Position must be free. Appends by default.

### Adding content to an existing doc
Use Write or Edit tools directly, then `carta regenerate` if frontmatter changed.

### Restructuring a tree
1. Plan target structure
2. Use move/punch/flatten/delete/create (each auto-regenerates)

### Deleting a section
1. `carta delete <ref>`
2. Check orphan warnings in output
3. Clean up orphaned refs in affected files manually

## Frontmatter Schema

Every `.carta/` doc has YAML frontmatter:

```yaml
---
title: Canvas
status: draft
summary: Pan, zoom, LOD rendering
tags: [canvas, lod, zoom]
deps: [doc02.07]
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Display name |
| `status` | yes | `active`, `draft`, `archived`, `implemented` |
| `summary` | yes | One-line description for MANIFEST |
| `tags` | yes | Keywords for retrieval (inline YAML list) |
| `deps` | no | Doc refs to check when this doc changes |
