# carta-cli

Reference for the `carta` CLI — structural operations on `.carta/` workspaces.

## When This Triggers
- "restructure the docs" / "move docs around" / "delete a section" / "create a new doc"
- "initialize a workspace" / "carta init"
- `/carta-cli`

## Key Principle
Structural changes via `carta` CLI. Content via Write/Edit. Always regenerate at end.

## Installation
```bash
pip install -e packages/cli   # development (editable)
pip install carta-cli          # production (future)
```

## Running Commands
```bash
carta <command> [options]
carta --help                # list all commands
carta <command> --help      # command-specific help
carta -w /path/.carta <cmd> # explicit workspace path
```

The CLI finds `.carta/` by walking up from cwd (like `git` finds `.git/`).

## Commands

### create

Create a new doc entry with blank frontmatter.

```
carta create <destination> <slug> [--order N] [--title "..."] [--dry-run]
```

- `<destination>` — ref or path to an existing directory (e.g. `doc01.03`, `01-product`)
- `<slug>` — slug for the new file (no numeric prefix). e.g. `my-feature`
- `--order N` — insert at position N (1-indexed). Position must be free. Default: append after highest.
- `--title` — override the title (default: derived from slug via title-case)
- Creates `NN-slug.md` with draft frontmatter and `# Title` heading
- Runs `regenerate` automatically

**Examples**:
```bash
carta create doc00 test-doc                        # append to 00-codex/
carta create doc01.03 new-feature --order 3           # create at position 03
carta create doc01.03.08 my-section --title "My Section" # custom title
carta create doc00 test-doc --dry-run              # preview only
```

### delete

Delete one or more doc entries with automatic gap-closing.

```
carta delete <target>... [--dry-run] [--output-mapping]
```

- Accepts refs (`doc01.03.02`) or paths (`01-product/02-features`)
- Deletes files and directories (recursive)
- Gap-closes siblings (renumbers sequentially)
- Rewrites refs for renumbered siblings
- Warns about orphaned refs (refs in prose pointing to deleted docs are left as-is)
- Runs `regenerate` automatically
- `--output-mapping` — print the computed rename map as JSON to stdout after execution

**Examples**:
```bash
carta delete doc01.03.08.01                                # delete a single doc
carta delete doc01.03.02 doc01.03.08                          # delete multiple entries
carta delete doc01.03.08.01 --dry-run                      # preview deletions + orphan warnings
carta delete doc01.03.08.01 --output-mapping > map.json    # capture rename map for rewrite
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
carta move doc01.03.05 doc01.03 --order 2                           # promote into parent
carta move doc01.03.05 . --rename diagramming                   # rename slug in place
carta move doc01.03.05 doc01.03 --order 2 --rename diagramming     # move + rename
carta move doc01.03.08 01-product --mkdir --order 3 --rename research  # move into new dir
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
carta punch doc01.01.04    # 01-canvas.md → 01-canvas/00-index.md
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
carta flatten doc01.03.02                # dissolve features/, promote children
carta flatten doc01.03.02 --keep-index   # same, but keep index as sibling
```

### rewrite

Rewrite doc refs across the workspace using user-supplied mappings.

```
carta rewrite --map old=new [--map old2=new2 ...] [--from-json mappings.json] [--dry-run]
```

- `--map` / `-m` — repeatable flag for individual ref mappings
- `--from-json` — read mappings from a JSON file `{"old_ref": "new_ref", ...}`
- Always use `--dry-run` first to preview changes

**When to use:** After restoring backup files into a restructured workspace, when refs in the restored files point to old locations.

### attach

Attach a non-md file as a sidecar to an existing doc, giving it the doc's numeric prefix.

```
carta attach <host> <source> [--rename SLUG] [--dry-run]
```

- `<host>` — doc ref or path to the host `.md` file (not a directory)
- `<source>` — path to the file to attach (may be outside the workspace)
- Places the source file alongside the host with prefix `NN-<slug>.<ext>`
- The attachment joins the host's bundle — it travels with the host through all structural ops
- `--rename SLUG` — override attachment slug (default: derived from source filename)
- Does NOT update MANIFEST.md (attachments are not indexed)

**Examples**:
```bash
carta attach doc01.03.02 /path/to/diagram.png         # attach as 02-diagram.png
carta attach doc01.03.02 /path/to/data.csv --rename model-data  # as 02-model-data.csv
carta attach doc01.03.02 /path/to/fig.svg --dry-run   # preview only
```

### copy

Copy a file into the workspace at a given position.

```
carta copy <source_file> <destination> [--order N] [--rename slug] [--dry-run]
```

- `<source_file>` — path to the file to copy (can be outside the workspace)
- `<destination>` — ref or path to an existing directory
- `--rename` — override the slug (default: derived from source filename)

**When to use:** Restoring a backup file into a new position in a restructured workspace.

### init

Initialize a new `.carta/` workspace in the current directory, or refresh an existing one.

```
carta init [--name "Project Name"] [--dir DIRNAME] [--portable]
carta init --rehydrate [--dry-run]
```

- Creates `.carta/` with `workspace.json`, `MANIFEST.md`, `00-codex/00-index.md`
- Hydrates `.claude/skills/carta-cli/SKILL.md` for AI agent integration
- `--name` — workspace title (default: parent directory name)
- `--rehydrate` — refresh `00-codex/` templates and skill files from installed carta version; preserves `workspace.json` and user-authored docs outside `00-codex/`
- `--dry-run` — with `--rehydrate`, show what would be updated without writing

**Examples**:
```bash
cd my-project
carta init --name "My Project"
carta init --rehydrate                # refresh after a carta-cli upgrade
carta init --rehydrate --dry-run      # preview what would change
```

### regenerate

Rebuild MANIFEST.md from filesystem and doc frontmatter.

```
carta regenerate [--dry-run]
```

All structural commands run `regenerate` automatically. Use manually only if you edited frontmatter directly.

### portable

Copy `carta.pyz` to the project root for pip-free usage.

```
carta portable
```

Updates the bundled zipapp so collaborators can use `python3 carta.pyz <command>` without pip.

## Behavioral Rules for Multi-Step Operations

- **Bundles travel as a unit**: A bundle is the set of siblings sharing a numeric prefix (`NN`). The `NN-<slug>.md` file is the root; all other `NN-*.<ext>` siblings are attachments. Structural ops (`move`, `delete`, `rename`, `punch`, `flatten`) move the whole bundle automatically.
- **Gap-closing is automatic**: When an entry is removed from a directory (via `move`, `delete`, `flatten`), all higher-numbered siblings are renumbered down. This means source paths change after each move — always check paths between sequential moves.
- **`--order` bumps siblings**: Inserting at position N shifts everything at N and above up by one in the destination directory.
- **`--no-regen` scope**: Skips MANIFEST rebuild only. Ref rewriting in doc content still happens. Use for batch operations, then `carta regenerate` once at the end.
- **`--rename` preserves extensions**: When renaming a `.md` file, the extension is carried over automatically. You can pass just the slug (e.g., `--rename canvas-state`).
- **`group` doesn't renumber**: Unlike `move`, `carta group` creates the directory without renumbering existing siblings, allowing temporary duplicate prefixes during restructures.
- **Attachments travel with their host**: Non-.md files sharing a numeric prefix with a root `.md` (e.g. `02-model.json` alongside `02-workflow.md`) are attachments and move/rename/delete as part of the bundle automatically. Use `carta attach` to add new ones. Orphaned sidecars (no matching root .md) are reported by `regenerate` but not moved.
- **Sequencing**: Run moves sequentially, not in parallel. Each move changes numbering for subsequent commands. Use `--dry-run` to verify.

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
deps: [doc01.03.08.05]
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Display name |
| `status` | yes | `active`, `draft`, `archived`, `implemented` |
| `summary` | yes | One-line description for MANIFEST |
| `tags` | yes | Keywords for retrieval (inline YAML list) |
| `deps` | no | Doc refs to check when this doc changes |

## Migration Patterns

### Backup-Delete-Rebuild

For large restructurings where `move` alone isn't sufficient:

1. **Backup** the `.carta/` directory
2. **Delete** sections with `carta delete` — use `--output-mapping` to capture ref changes
3. **Rebuild** the new structure with `carta create`, `carta punch`, etc.
4. **Restore** content from backup using `carta copy`
5. **Rewrite** stale refs using `carta rewrite` — use `--dry-run` first

Example workflow:
```bash
# Capture the ref mapping from deletion
carta delete doc01.03.02 --output-mapping > /tmp/delete-map.json

# ... rebuild structure ...

# Restore a file from backup
carta copy /tmp/backup/03-my-doc.md doc01.03.05 --rename my-doc

# Fix stale refs in restored files
carta rewrite --from-json /tmp/delete-map.json --dry-run
carta rewrite --from-json /tmp/delete-map.json
```

**Warning:** Backup files retain their original refs. Always run `carta rewrite` after restoring content from backup.
