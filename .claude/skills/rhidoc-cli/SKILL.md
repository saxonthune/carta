# rhidoc-cli

Reference for the `rhidoc` CLI — structural operations on `.rhidoc/` workspaces.

## When This Triggers
- "restructure the docs" / "move docs around" / "delete a section" / "create a new doc"
- `/rhidoc-cli`

## Key Principle
Structural changes via `rhidoc` CLI. Content via Write/Edit. Always regenerate at end.

## Running Commands
```bash
rhidoc <command> [options]
rhidoc --help                # list all commands
rhidoc <command> --help      # command-specific help
rhidoc -w /path/.rhidoc <cmd> # explicit workspace path
```

The CLI finds the workspace by walking up from cwd (like `git` finds `.git/`).

## Bundles and Attachments

A **bundle** is a group of siblings sharing a two-digit numeric prefix. The `NN-<slug>.md` file is the root; any other `NN-*.<ext>` siblings are attachments (sidecars — e.g., `02-model.json` alongside `02-workflow.md`).

Structural ops (`move`, `delete`, `rename`, `punch`, `flatten`) treat a bundle as a unit — attachments travel with their host automatically. Use `rhidoc attach <host> <source>` to add a new sidecar. Orphaned sidecars (no matching root) are reported on stderr during `regenerate` but do not block it.

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
## Bundles and Attachments

A **bundle** is the set of siblings in a directory that share a two-digit numeric prefix (`NN`).

- **Bundle root**: the `NN-<slug>.md` file in that directory.
- **Attachment** (sidecar): any other file in the same directory whose name begins with the same `NN` prefix and is not a directory.
- Attachment regex: `^(\d{2})-[^/]+\.[^./]+$` excluding `\.md$`.

Attachments carry no frontmatter. Membership is determined by prefix alone, not by filename content or any declaration.

Every structural operation (`move`, `delete`, `rename`, `punch`, `flatten`) treats the bundle as a unit: when the root travels, all same-prefix siblings travel with it automatically.

**Orphans**: a file whose `NN` prefix has no corresponding `.md` root, or whose prefix matches a directory rather than a file, is an orphan. `rhidoc regenerate` prints orphan warnings to stderr but never blocks operation.

Use `rhidoc attach` to place a new non-md artifact alongside its host doc.

**Sidecar display refs**: `rhidoc tree --refs` and `rhidoc bundle` display sidecars using the ref format `docXX.YY.ZZ/<slug>.<ext>`, where `docXX.YY.ZZ` is the host doc ref. These refs are for display only — no command accepts sidecar refs as input arguments.

## Command Reference

### regenerate

Rebuild `MANIFEST.md` from frontmatter across all docs in the workspace.

```
rhidoc regenerate [--dry-run]
```

Side effects:
  - Overwrites `MANIFEST.md` entirely from current doc state.
  - No file moves or ref rewrites.

Flags:
  --dry-run    Print what would be written without modifying MANIFEST.md.

When to use:
  - After batch moves using `--no-regen` on each move command.
  - When MANIFEST.md is stale or missing.

### make

Create a new numbered `.md` file (doc) or directory + `00-index.md` (group) at a position.

```
rhidoc make [PARENT] SLUG [-g] [--at REF] [--dry-run] [--no-regen]
```

Arguments:
  PARENT  (optional) Directory to place the new entry in. Accepts doc refs (e.g., `doc01.02`)
          or workspace-relative paths. Omit to create a top-level title.
  SLUG    Filename stem without prefix (e.g., `my-doc` → `03-my-doc.md`).
          Must NOT include a numeric prefix.

Addressing modes (four ways to specify where to place the entry):
  1. `rhidoc make SLUG`              — single positional: creates at root level, appends after last entry
  2. `rhidoc make PARENT SLUG`       — two positionals: creates inside PARENT, appends after last entry
  3. `rhidoc make --at REF SLUG`     — strict slot: creates at exact position REF; errors if occupied
  4. `rhidoc make --before REF SLUG` — displacing insert: shifts that sibling and all higher ones up by one,
                                      then writes the new entry at REF's coordinate

Side effects:
  - Writes a new `.md` file (or directory + `00-index.md` with `-g`) with skeleton frontmatter.
  - Frontmatter title is derived from slug (slug → "Title Case"). No frontmatter flags — author
    real frontmatter in the same pass where you write the body.
  - Regenerates MANIFEST.md (unless --no-regen).
  - `--before` only: renumbers siblings (bump up) and rewrites their cross-references before writing.
  - append / `--at`: does NOT renumber siblings.

Flags:
  -g, --group     Create a directory + `00-index.md` instead of a leaf `.md`.
  --at REF        Exact target ref (e.g. `doc01.02.03.04`). Writes iff the slot is free, else errors.
                  Do NOT combine with a PARENT positional — REF encodes the full coordinate.
  --before REF    Displacing insert at REF. Bumps that sibling and all higher siblings up by one,
                  rewrites their refs, then writes the new entry at REF's coordinate. Mutually
                  exclusive with `--at`. Do NOT combine with a PARENT positional.
  --dry-run       Print the planned file path (and shift plan for --before) without creating anything.
  --no-regen      Skip MANIFEST regeneration.

Output:
  Prints the canonical ref and workspace-relative path of the created entry.
  With --before, also prints: `Shifted: N sibling(s) renumbered`
  Example: `Created: doc01.02.03.04  (03-product-design/.../04-architecture-guidelines.md)`

Notes:
  - `--at` is non-displacing (errors on occupied slot); `--before` is displacing (shifts siblings up).
  - Do NOT combine `--before` with `--at` or with a two-positional target.
  - Do NOT add `--title`, `--summary`, `--tags`, `--deps` flags to this command. Frontmatter is
    authored by the agent in the same file write as the body. The skeleton is valid as-is.

### delete

Delete one or more entries with gap-closing renumbering of siblings.

```
rhidoc delete <target> [<target> ...] [--dry-run] [--output-mapping]
```

Arguments:
  targets  One or more paths or doc refs to delete. Files or directories.

Side effects:
  - Deletes target file(s) or directory trees.
  - Operates on bundles — non-md siblings sharing the target's numeric prefix are deleted with it.
  - Gap-closes: siblings with higher prefixes are renumbered down.
  - Rewrites all cross-references in workspace + externalRefPaths.
  - Regenerates MANIFEST.md.
  - Reports orphaned refs (refs to deleted entries still found in surviving files).

Flags:
  --dry-run         Show planned deletions and renumbering without executing.
  --output-mapping  Print JSON ref rename map to stdout (useful for chaining).

### move

Move or reorder a file or directory within the workspace.

```
rhidoc move <source> [<destination>] [--at REF | --before REF] [--mkdir] [--rename SLUG] [--no-regen] [--no-gap-close] [--dry-run]
```

Arguments:
  source       Path or doc ref to move. Accepts files (.md) and directories.
  destination  Target directory for append mode. Omit when using --at or --before.

Addressing modes:
  Append (positional destination, no --at/--before):
    Move source to the destination directory, appending after the last existing entry.
    Accepted forms for destination: path or doc ref to an existing directory.
    --mkdir creates the directory if it is missing (also creates 00-index.md).

  --at REF (strict / non-displacing):
    Move source to the exact position named by REF.  The slot must be free; if occupied,
    the command errors without moving anything.  No sibling renumbering at the destination.
    Source-side gap-close still applies (unless --no-gap-close).
    Accepted ref forms: docXX.YY.ZZ | dXX.YY | XX.YY

  --before REF (displacing):
    Insert source at the position named by REF, bumping that sibling and every sibling
    with a higher prefix up by one, rewriting refs for all shifted entries.
    Source-side gap-close still applies (unless --no-gap-close).
    Accepted ref forms: docXX.YY.ZZ | dXX.YY | XX.YY

  --at and --before are mutually exclusive, and each is also mutually exclusive with a
  positional destination argument — the ref carries the destination.

  Slot-0 rule: within any directory that contains a 00-index.md, prefix 00 is reserved.
  At the workspace root (no 00-index.md present), prefix 00 is a normal group position
  and may be targeted freely (e.g. `rhidoc move doc01 --before doc00` promotes a group
  into root slot 0, bumping the former 00-group to 01).

Side effects:
  - Operates on bundles — non-md siblings sharing the source's numeric prefix travel with it.
  - Removes source from its parent; gap-closes source siblings (unless --no-gap-close).
  - Rewrites all cross-references in workspace + externalRefPaths.
  - Regenerates MANIFEST.md (unless --no-regen).

Flags:
  --at REF        Strict placement at REF; errors if slot is occupied.
  --before REF    Displacing insert at REF; bumps all siblings at or above REF.
  --mkdir         (append mode only) Create destination directory if missing.
  --rename SLUG   Change the slug during the move. Extension is preserved automatically.
  --no-regen      Skip MANIFEST regeneration. Ref rewriting still happens.
  --no-gap-close  Skip gap-closing of source siblings after the move. Source directory
                  will have a numbering gap. Use with --no-regen for batch operations,
                  then run `rhidoc regenerate` at the end.
  --dry-run       Print planned moves without executing.

Sequencing notes:
  - Each move changes numbering for subsequent commands — run sequentially, not in parallel.
  - When moving many entries out of a directory, use --no-gap-close --no-regen on each move
    to avoid invalidating subsequent source paths, then run `rhidoc regenerate` at the end.
  - Without --no-gap-close, move the highest-numbered entry first to avoid gap-closing
    invalidating subsequent source paths. Or check paths between moves.

### punch

Expand a leaf `.md` file into a directory by converting it to `NN-slug/00-index.md`.

```
rhidoc punch <target> [--as-child] [--dry-run]
```

Arguments:
  target  Path or doc ref to a numbered `.md` file.

Side effects:
  - Operates on bundles — non-md siblings sharing the target's numeric prefix move into the new directory with it.
  - Creates a directory with the same name (minus `.md` extension).
  - Moves the file into that directory as `00-index.md`.
  - Does NOT renumber siblings or rewrite refs (the doc ref is unchanged).

Flags:
  --as-child  Put original content in `01-{slug}.md` and generate a skeleton
              group index in `00-index.md`. Use this when turning a leaf into
              a group — the original content becomes the first child doc.
  --dry-run   Print planned operation without executing.

### flatten

Dissolve a directory by hoisting its children into the parent.

```
rhidoc flatten <target> [--keep-index] [--force] [--before REF] [--dry-run]
```

Arguments:
  target  Path or doc ref to a numbered directory.

Side effects:
  - Operates on bundles — non-md siblings sharing a child's numeric prefix are hoisted with it.
  - Removes the directory, hoists numbered children into the parent.
  - Renumbers all siblings in the parent to close/fill gaps.
  - Discards 00-index.md (unless --keep-index).
  - Rewrites all cross-references in workspace + externalRefPaths.
  - Regenerates MANIFEST.md.

Flags:
  --keep-index   Preserve 00-index.md as a sibling file (named `NN-<dir-slug>.md`).
  --force        Discard index even if it has significant content (>10 lines).
  --before REF   Insert hoisted children before REF (a doc ref) in the parent.
                 Default: the dissolved directory's old position.
  --dry-run      Print planned moves without executing.

### attach

Attach a non-md file as a sidecar to an existing doc, giving it the doc's numeric prefix.

```
rhidoc attach <host> <source> [--rename SLUG] [--dry-run]
```

Arguments:
  host    Doc ref or path of the host `.md` doc (e.g., `doc01.03.02`).
  source  Path to the file to attach (outside or inside the workspace).

Side effects:
  - Copies the source file into the same directory as the host doc.
  - Renames it to share the host's numeric prefix: `NN-<slug>.<ext>`.
  - The file becomes part of the host's bundle — it will travel with the host
    through all future structural operations (move, delete, rename, punch, flatten).
  - Regenerates MANIFEST.md (Attachments column updated).

Flags:
  --rename SLUG  Override the attachment slug. Default: derived from source filename.
  --dry-run      Print the planned attachment path without writing anything.

When to use:
  - Adding a diagram, data file, or other artifact that belongs alongside a spec doc.
  - Any time a non-md file should travel with a doc through workspace restructuring.

Notes:
  - The host must be a `.md` file (not a directory).
  - Attachments are identified by prefix, not by declaration — no frontmatter needed.
  - The slug must be unique within the bundle across all extensions. If a different
    extension already uses the same slug, the command errors with a hint to --rename.
  - To verify the bundle after attaching, run `rhidoc bundle <host>`.

### copy

Copy an external file into the workspace at a numbered position.

```
rhidoc copy <source> [<destination>] [--at REF | --before REF] [--rename SLUG] [--dry-run]
```

Arguments:
  source       Path to a file outside the workspace.
  destination  Target directory (append mode). Omit when using --at/--before.

Addressing modes:
  Append (positional destination, no --at/--before):
    Copies the file into the destination directory, appending after the last existing entry.

  --at REF (strict / non-displacing):
    Copies the file to the exact position named by REF. The slot must be free; if occupied,
    the command errors without copying anything. No sibling renumbering.
    Accepted ref forms: docXX.YY.ZZ | dXX.YY | XX.YY

  --before REF (displacing):
    Copies the file at the position named by REF, bumping that sibling and every sibling
    with a higher prefix up by one, rewriting refs for all shifted entries.
    Accepted ref forms: docXX.YY.ZZ | dXX.YY | XX.YY

Side effects:
  - Copies the file with a numbered prefix into the destination directory.
  - `--before` only: renumbers siblings (bump up) and rewrites their cross-references before copying.
  - append / `--at`: does NOT renumber siblings.
  - Regenerates MANIFEST.md.

Flags:
  --at REF        Strict placement at REF; errors if slot is occupied.
  --before REF    Displacing insert at REF; bumps all siblings at or above REF.
  --rename SLUG   Override the destination slug. Default: derived from source filename.
  --dry-run       Print the planned copy without executing.

### rewrite

Rewrite doc refs across the workspace using explicit old=new mappings.

```
rhidoc rewrite <old>=<new> [<old>=<new> ...] [--dry-run]
```

Arguments:
  mappings  One or more `old=new` pairs. Both sides accept the three input forms
            (docXX.YY | dXX.YY | XX.YY) and are normalized to canonical `docXX.YY`
            before substitution. Example: `d04.08=04.09` → rewrites `doc04.08` → `doc04.09`.

Side effects:
  - Normalizes both sides of each mapping to canonical form.
  - Rewrites all canonical ref occurrences in workspace `.md` files and externalRefPaths.
  - Does NOT regenerate MANIFEST.md.

Flags:
  --dry-run  Show which files and how many replacements would be made.

### rename

Rename a file or directory slug without changing its numeric position.

```
rhidoc rename <target> <new-slug> [--no-regen]
```

Arguments:
  target    Path or doc ref of the entry to rename.
  new-slug  New slug (the part after NN-). Do not include the prefix.

Side effects:
  - Operates on bundles — non-md siblings sharing the target's numeric prefix travel with it.
  - Renames the file/directory on disk (and renames attachment files to match the new slug).
  - Does NOT rewrite cross-references (use `rhidoc rewrite` for that).
  - Regenerates MANIFEST.md (unless --no-regen).

Flags:
  --no-regen  Skip MANIFEST regeneration.

### init

Initialize a new `.rhidoc/` workspace in the current directory, or refresh an existing one.

```
rhidoc init [--name TEXT] [--dir DIRNAME] [--portable]
rhidoc init --rehydrate [--dry-run]
```

Side effects (without --rehydrate):
  - Creates `.rhidoc.json` marker in the current directory.
  - Creates `DIRNAME/00-codex/00-index.md` and `DIRNAME/MANIFEST.md`.
  - Hydrates `.claude/skills/rhidoc-cli/SKILL.md` (skips if exists).
  - Runs initial MANIFEST regeneration.

Side effects (with --rehydrate):
  - Overwrites `00-codex/*.md` with latest templates from installed rhidoc.
  - Overwrites `.claude/skills/rhidoc-cli/SKILL.md` and `.claude/skills/docs-development/SKILL.md`.
  - Skips files that already match the latest version.
  - Does NOT touch user-created docs outside 00-codex.
  - Does NOT overwrite workspace.json fields (title, description, externalRefPaths).

Flags:
  --name TEXT    Workspace title. Default: parent directory name.
  --dir DIRNAME  Workspace directory name. Default: `.rhidoc`.
  --portable     Also copy editable Python scripts into workspace (pip-free usage).
  --rehydrate    Refresh templates and skills in an existing workspace.
  --dry-run      With --rehydrate: show what would be updated without writing.

When to use --rehydrate:
  - After upgrading rhidoc (`pip install -e .` or `pip install --upgrade rhidoc`).
  - To push template improvements to existing workspaces.

Example:
  rhidoc init --rehydrate              # refresh after a rhidoc-cli upgrade
  rhidoc init --rehydrate --dry-run    # preview what would change

### portable

Copy the rhidoc CLI source into the workspace for pip-free usage.

```
rhidoc portable
```

Side effects:
  - Creates `WORKSPACE/_scripts/` with all library modules.
  - Creates `WORKSPACE/rhidoc.py` entry point shim.
  - Updates `.rhidoc.json` with `portable` key pointing to the shim.

After running, use `python3 .rhidoc/rhidoc.py <command>` instead of `rhidoc`.

### cat

Print document contents to stdout by doc ref or path.

```
rhidoc cat <ref>
```

Arguments:
  ref  Doc ref (e.g., `doc02.03`) or workspace-relative path.
       If the ref resolves to a directory, prints `00-index.md` from that directory.

Side effects:
  - Read-only. Prints file contents to stdout. No files modified.

### tree

Print workspace structure as a visual tree with titles from frontmatter.

```
rhidoc tree [target] [--refs] [--no-title] [--no-sidecars]
```

Arguments:
  target  Optional directory to tree (doc ref or workspace-relative path).
          Default: workspace root.

Side effects:
  - Read-only. Prints tree to stdout. No files modified.

Flags:
  --refs         Show docXX.YY refs next to each entry. Sidecars show as docXX.YY/<slug>.<ext>.
  --no-title     Show filenames instead of frontmatter titles.
  --no-sidecars  Hide sidecar attachment lines (show only .md docs and directories).

Rendering:
  - Sidecar attachments appear as indented children of their host doc, prefixed with 📎.
  - Example:
    ├── 02-principles — Principles
    │   └── 📎 02-diagram.mmd

When to use:
  - To get an overview of workspace structure before planning moves.
  - To verify structure after batch operations.

### ls

List entries in a directory (docs, subdirectories, sidecars, and non-numbered files).

```
rhidoc ls [target] [--no-sidecars]
```

Arguments:
  target  Directory to list (doc ref or workspace-relative path). Default: workspace root.

Side effects:
  - Read-only. Prints one entry per line to stdout. No files modified.

Output format:
  - `.md` files: `NN-slug — Title` (title from frontmatter, stem without .md)
  - Subdirectories: `NN-slug — Title` (title from 00-index.md frontmatter)
  - Non-md numbered attachments (sidecars): `NN-slug.ext`
  - Non-numbered files: bare filename

Flags:
  --no-sidecars  Omit non-md numbered attachments. Docs and directories still shown.

When to use:
  - To inspect the direct children of a directory without a full recursive tree.
  - Before planning `create`, `move`, or `attach` operations.

### bundle

Show a doc's bundle: the host .md file and all its sidecar attachments with sizes.

```
rhidoc bundle <ref-or-path>
```

Arguments:
  ref-or-path  Doc ref (e.g., `doc01.02`) or path of a `.md` leaf doc.

Side effects:
  - Read-only. Prints bundle members to stdout. No files modified.

Output format:
  - First line: `NN-slug.md  <size>  (docXX.YY)` (host doc)
  - Subsequent lines: `  NN-slug.ext  <size>  (docXX.YY/<slug>.<ext>)` (each attachment)
  - Size is human-readable (B, KB, MB).

When to use:
  - To verify a bundle after `rhidoc attach`.
  - To inspect what non-md artifacts travel with a doc during restructuring.

### orphans

List all orphaned attachments across the workspace.

```
rhidoc orphans
```

Side effects:
  - Read-only. Prints one path per line to stdout. Summary line on stderr. No files modified.

Output:
  - One workspace-relative path per line (stdout, pipe-clean).
  - `Total: N orphan(s)` on stderr.
  - Exit 0 always — orphans are findings, not errors.

When to use:
  - To find sidecar files whose host .md was deleted or never created.
  - As an alternative to triggering `rhidoc regenerate` just to see orphan warnings.

### ai-skill

Print this comprehensive AI agent reference to stdout.

```
rhidoc ai-skill [--workspace PATH]
```

Side effects:
  - Read-only. Prints markdown to stdout. No files modified.

Output sections:
  1. Command Reference — usage, arguments, side effects, flags for every command
  2. Behavioral Rules — cross-cutting rules (gap-closing, ref rewriting, etc.)
  3. Common Patterns — cookbook for multi-step operations
  4. Workspace State — live summary of current workspace structure

Per-command alternative:
  `rhidoc <command> --help-ai` prints only that command's section.
  Example: `rhidoc move --help-ai` prints the move reference.

## Behavioral Rules

- **Gap-closing**: When an entry is removed from a directory (`move`, `delete`, `flatten`),
  all higher-numbered siblings are renumbered down to fill the gap.
- **Ref rewriting**: All commands that change file positions rewrite `docXX.YY.ZZ` refs
  across all `.md` files in the workspace and in `externalRefPaths` from `.rhidoc.json`.
- **Bundles**: Structural operations treat a bundle (root `.md` + same-prefix siblings) as a
  unit. Non-md sidecars travel with their host automatically — no declaration required.
- **Orphan warnings**: `rhidoc regenerate` prints a stderr warning for any sidecar file whose
  numeric prefix has no corresponding `.md` root, or whose prefix matches a directory. Orphan
  warnings never block operation; the MANIFEST is still written.
- **Argument resolution**: `source`/`target`/`destination` args accept either a doc ref or a
  real existing filesystem path (relative to workspace root). Three ref input forms are accepted
  and normalized to canonical `docXX.YY` on entry: `doc04.08` (full), `d04.08` (short), `04.08`
  (bare coordinate). Fuzzy stem/prefix guessing is NOT supported — misspelled paths do not
  silently resolve. The slug after `NN-` is descriptive and never part of a reference.
- **`--no-regen` scope**: Skips MANIFEST.md rebuild only. Ref rewriting in doc content still
  happens. Useful for batch operations — run many moves with `--no-regen`, then one final
  `rhidoc regenerate`.
- **Index files**: `00-index.md` files mark a directory as a title group. They cannot be
  renamed via `move --rename`. Use `rename` to change the directory slug instead.
- **Position 0 is reserved**: When a directory contains a `00-index.md`, slot 00 is reserved for it.
  Targeting slot 00 with `--at` or `--before` in such a directory is an error. At the workspace root
  (which has no `00-index.md`), slot 00 is a normal group position and may be targeted freely.

## Common Patterns

- **Batch restructure**: Use `--no-gap-close --no-regen` on all moves, then `rhidoc regenerate` once at end.
  ```
  rhidoc move doc01.02 01-strategy --no-gap-close --no-regen
  rhidoc move doc01.03 01-strategy --no-gap-close --no-regen
  rhidoc regenerate
  ```
- **Dissolve a group**: Move children out one by one (check paths between moves), then delete
  the empty index file and remove the empty directory.
  ```
  rhidoc move 02-old-group/01-child.md 03-new-home --no-regen
  rhidoc move 02-old-group/02-child.md 03-new-home --no-regen
  rhidoc delete 02-old-group
  ```
- **Create a new title group**: `rhidoc make -g PARENT slug` creates the directory
  with `00-index.md`. Then use `rhidoc move` or `rhidoc make` to populate it.
- **Expand a file into a group**: `rhidoc punch <target>` converts `NN-slug.md` into
  `NN-slug/00-index.md`. The doc ref is unchanged — no ref rewriting needed.
- **Flatten a subdirectory**: `rhidoc flatten <target>` hoists children into parent, removing
  the directory. Use `--keep-index` to preserve the index as a sibling file.
- **Rename a slug**: `rhidoc rename <target> new-slug` renames on disk. Then use
  `rhidoc rewrite old-ref=new-ref` to update references if needed (rename does not rewrite refs).

