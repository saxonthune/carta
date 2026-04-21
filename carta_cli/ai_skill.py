"""AI-skill documentation constants and generation logic for `carta ai-skill`."""
import argparse
import sys
from pathlib import Path

_PACKAGE_DIR = Path(__file__).resolve().parent

from .frontmatter import read_frontmatter
from .entries import list_numbered_entries
from .numbering import get_slug
from .workspace import load_workspace, get_external_ref_paths
from . import bundle as _bundle_mod

_BUNDLES_AND_ATTACHMENTS = """\
## Bundles and Attachments

A **bundle** is the set of siblings in a directory that share a two-digit numeric prefix (`NN`).

- **Bundle root**: the `NN-<slug>.md` file in that directory.
- **Attachment** (sidecar): any other file in the same directory whose name begins with the same `NN` prefix and is not a directory.
- Attachment regex: `^(\\d{2})-[^/]+\\.[^./]+$` excluding `\\.md$`.

Attachments carry no frontmatter. Membership is determined by prefix alone, not by filename content or any declaration.

Every structural operation (`move`, `delete`, `rename`, `punch`, `flatten`) treats the bundle as a unit: when the root travels, all same-prefix siblings travel with it automatically.

**Orphans**: a file whose `NN` prefix has no corresponding `.md` root, or whose prefix matches a directory rather than a file, is an orphan. `carta regenerate` prints orphan warnings to stderr but never blocks operation.

Use `carta attach` to place a new non-md artifact alongside its host doc.

**Sidecar display refs**: `carta tree --refs` and `carta bundle` display sidecars using the ref format `docXX.YY.ZZ/<slug>.<ext>`, where `docXX.YY.ZZ` is the host doc ref. These refs are for display only — no command accepts sidecar refs as input arguments.
"""

_COMMAND_DOCS: dict[str, str] = {
    "regenerate": """\
### regenerate

Rebuild `MANIFEST.md` from frontmatter across all docs in the workspace.

```
carta regenerate [--dry-run]
```

Side effects:
  - Overwrites `MANIFEST.md` entirely from current doc state.
  - No file moves or ref rewrites.

Flags:
  --dry-run    Print what would be written without modifying MANIFEST.md.

When to use:
  - After batch moves using `--no-regen` on each move command.
  - When MANIFEST.md is stale or missing.
""",

    "create": """\
### create

Create a new numbered `.md` file at a given position in a directory.

```
carta create <destination> <slug> [--order N] [--title TEXT] [--summary TEXT] [--tags CSV] [--deps CSV] [--dry-run]
```

Arguments:
  destination  Directory path relative to workspace root (e.g., `01-product/02-features`).
               Also accepts doc refs (e.g., `doc01.02`).
  slug         Filename stem without prefix (e.g., `my-doc` → `03-my-doc.md`).
               Must NOT include a numeric prefix.

Side effects:
  - Writes a new `.md` file with draft frontmatter.
  - Regenerates MANIFEST.md.
  - Does NOT renumber siblings — only appends or inserts at `--order`.

Flags:
  --order N    Insert at position N (1-based). Without this, appends after the last entry.
  --title TEXT Title in frontmatter. Default: derived from slug.
  --summary TEXT  Summary in frontmatter. Default: empty.
  --tags CSV      Comma-separated tags (e.g., "api,auth,server"). Default: empty list.
  --deps CSV      Comma-separated dep refs (e.g., "doc01.02,doc01.03"). Default: empty list.
  --dry-run    Print the planned file path without creating it.
""",

    "delete": """\
### delete

Delete one or more entries with gap-closing renumbering of siblings.

```
carta delete <target> [<target> ...] [--dry-run] [--output-mapping]
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
""",

    "move": """\
### move

Move or reorder a file or directory within the workspace.

```
carta move <source> <destination> [--order N] [--mkdir] [--rename SLUG] [--no-regen] [--no-gap-close] [--dry-run]
```

Arguments:
  source       Path or doc ref to move. Accepts files (.md) and directories.
  destination  Target directory. Must exist unless --mkdir is used.

Side effects:
  - Operates on bundles — non-md siblings sharing the target's numeric prefix travel with it.
  - Removes source from its parent, gap-closes source siblings (unless --no-gap-close).
  - Inserts at destination, bumps destination siblings at or above --order.
  - Rewrites all cross-references in workspace + externalRefPaths.
  - Regenerates MANIFEST.md (unless --no-regen).

Flags:
  --order N       Insert at position N. Without this, appends after the last entry.
  --mkdir         Create destination directory if missing (also creates 00-index.md).
  --rename SLUG   Change the slug during the move. Extension is preserved automatically.
  --no-regen      Skip MANIFEST regeneration. Ref rewriting still happens.
  --no-gap-close  Skip gap-closing of source siblings after the move. Source directory
                  will have a numbering gap. Use with --no-regen for batch operations,
                  then run `carta regenerate` at the end.
  --dry-run       Print planned moves without executing.

Sequencing notes:
  - Each move changes numbering for subsequent commands — run sequentially, not in parallel.
  - When moving many entries out of a directory, use --no-gap-close --no-regen on each move
    to avoid invalidating subsequent source paths, then run `carta regenerate` at the end.
  - Without --no-gap-close, move the highest-numbered entry first to avoid gap-closing
    invalidating subsequent source paths. Or check paths between moves.
""",

    "punch": """\
### punch

Expand a leaf `.md` file into a directory by converting it to `NN-slug/00-index.md`.

```
carta punch <target> [--as-child] [--dry-run]
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
""",

    "flatten": """\
### flatten

Dissolve a directory by hoisting its children into the parent.

```
carta flatten <target> [--keep-index] [--force] [--at N] [--dry-run]
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
  --keep-index  Preserve 00-index.md as a sibling file (named `NN-<dir-slug>.md`).
  --force       Discard index even if it has significant content (>10 lines).
  --at N        Insert hoisted children starting at position N. Default: source position.
  --dry-run     Print planned moves without executing.
""",

    "attach": """\
### attach

Attach a non-md file as a sidecar to an existing doc, giving it the doc's numeric prefix.

```
carta attach <host> <source> [--rename SLUG] [--dry-run]
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
  - To verify the bundle after attaching, run `carta bundle <host>`.
""",

    "copy": """\
### copy

Copy an external file into the workspace at a numbered position.

```
carta copy <source> <destination> [--order N] [--rename SLUG] [--dry-run]
```

Arguments:
  source       Path to a file outside the workspace.
  destination  Directory path relative to workspace root.

Side effects:
  - Copies the file with a numbered prefix into the destination directory.
  - Regenerates MANIFEST.md.
  - Does NOT renumber siblings.

Flags:
  --order N       Insert at position N. Default: appends after the last entry.
  --rename SLUG   Override the destination slug. Default: derived from source filename.
  --dry-run       Print the planned copy without executing.
""",

    "rewrite": """\
### rewrite

Rewrite doc refs across the workspace using explicit old=new mappings.

```
carta rewrite <old>=<new> [<old>=<new> ...] [--dry-run]
```

Arguments:
  mappings  One or more `old=new` pairs (e.g., `doc01.02=doc01.05`).

Side effects:
  - Rewrites all matching refs in workspace `.md` files and externalRefPaths.
  - Does NOT regenerate MANIFEST.md.

Flags:
  --dry-run  Show which files and how many replacements would be made.
""",

    "group": """\
### group

Create a title group directory with a `00-index.md` file.

```
carta group <target> [--title TEXT] [--no-regen]
```

Arguments:
  target  Directory path relative to workspace root with NN- prefix
          (e.g., `05-new-section`). Parent directory must exist.

Side effects:
  - Creates the directory and `00-index.md` with draft frontmatter.
  - Regenerates MANIFEST.md (unless --no-regen).

Flags:
  --title TEXT  Title for the index. Default: derived from slug.
  --no-regen    Skip MANIFEST regeneration.
""",

    "rename": """\
### rename

Rename a file or directory slug without changing its numeric position.

```
carta rename <target> <new-slug> [--no-regen]
```

Arguments:
  target    Path or doc ref of the entry to rename.
  new-slug  New slug (the part after NN-). Do not include the prefix.

Side effects:
  - Operates on bundles — non-md siblings sharing the target's numeric prefix travel with it.
  - Renames the file/directory on disk (and renames attachment files to match the new slug).
  - Does NOT rewrite cross-references (use `carta rewrite` for that).
  - Regenerates MANIFEST.md (unless --no-regen).

Flags:
  --no-regen  Skip MANIFEST regeneration.
""",

    "init": """\
### init

Initialize a new `.carta/` workspace in the current directory, or refresh an existing one.

```
carta init [--name TEXT] [--dir DIRNAME] [--portable]
carta init --rehydrate [--dry-run]
```

Side effects (without --rehydrate):
  - Creates `.carta.json` marker in the current directory.
  - Creates `DIRNAME/00-codex/00-index.md` and `DIRNAME/MANIFEST.md`.
  - Hydrates `.claude/skills/carta-cli/SKILL.md` (skips if exists).
  - Runs initial MANIFEST regeneration.

Side effects (with --rehydrate):
  - Overwrites `00-codex/*.md` with latest templates from installed carta.
  - Overwrites `.claude/skills/carta-cli/SKILL.md` and `.claude/skills/docs-development/SKILL.md`.
  - Skips files that already match the latest version.
  - Does NOT touch user-created docs outside 00-codex.
  - Does NOT overwrite workspace.json fields (title, description, externalRefPaths).

Flags:
  --name TEXT    Workspace title. Default: parent directory name.
  --dir DIRNAME  Workspace directory name. Default: `.carta`.
  --portable     Also copy editable Python scripts into workspace (pip-free usage).
  --rehydrate    Refresh templates and skills in an existing workspace.
  --dry-run      With --rehydrate: show what would be updated without writing.

When to use --rehydrate:
  - After upgrading carta (`pip install -e .` or `pip install --upgrade carta-cli`).
  - To push template improvements to existing workspaces.

Example:
  carta init --rehydrate              # refresh after a carta-cli upgrade
  carta init --rehydrate --dry-run    # preview what would change
""",

    "portable": """\
### portable

Copy the carta CLI source into the workspace for pip-free usage.

```
carta portable
```

Side effects:
  - Creates `WORKSPACE/_scripts/` with all library modules.
  - Creates `WORKSPACE/carta.py` entry point shim.
  - Updates `.carta.json` with `portable` key pointing to the shim.

After running, use `python3 .carta/carta.py <command>` instead of `carta`.
""",

    "cat": """\
### cat

Print document contents to stdout by doc ref or path.

```
carta cat <ref>
```

Arguments:
  ref  Doc ref (e.g., `doc02.03`) or workspace-relative path.
       If the ref resolves to a directory, prints `00-index.md` from that directory.

Side effects:
  - Read-only. Prints file contents to stdout. No files modified.
""",

    "tree": """\
### tree

Print workspace structure as a visual tree with titles from frontmatter.

```
carta tree [target] [--refs] [--no-title] [--no-sidecars]
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
""",

    "ls": """\
### ls

List entries in a directory (docs, subdirectories, sidecars, and non-numbered files).

```
carta ls [target] [--no-sidecars]
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
""",

    "bundle": """\
### bundle

Show a doc's bundle: the host .md file and all its sidecar attachments with sizes.

```
carta bundle <ref-or-path>
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
  - To verify a bundle after `carta attach`.
  - To inspect what non-md artifacts travel with a doc during restructuring.
""",

    "orphans": """\
### orphans

List all orphaned attachments across the workspace.

```
carta orphans
```

Side effects:
  - Read-only. Prints one path per line to stdout. Summary line on stderr. No files modified.

Output:
  - One workspace-relative path per line (stdout, pipe-clean).
  - `Total: N orphan(s)` on stderr.
  - Exit 0 always — orphans are findings, not errors.

When to use:
  - To find sidecar files whose host .md was deleted or never created.
  - As an alternative to triggering `carta regenerate` just to see orphan warnings.
""",

    "ai-skill": """\
### ai-skill

Print this comprehensive AI agent reference to stdout.

```
carta ai-skill [--workspace PATH]
```

Side effects:
  - Read-only. Prints markdown to stdout. No files modified.

Output sections:
  1. Command Reference — usage, arguments, side effects, flags for every command
  2. Behavioral Rules — cross-cutting rules (gap-closing, ref rewriting, etc.)
  3. Common Patterns — cookbook for multi-step operations
  4. Workspace State — live summary of current workspace structure

Per-command alternative:
  `carta <command> --help-ai` prints only that command's section.
  Example: `carta move --help-ai` prints the move reference.
""",
}

_BEHAVIORAL_RULES = """\
- **Gap-closing**: When an entry is removed from a directory (`move`, `delete`, `flatten`),
  all higher-numbered siblings are renumbered down to fill the gap.
- **Ref rewriting**: All commands that change file positions rewrite `docXX.YY.ZZ` refs
  across all `.md` files in the workspace and in `externalRefPaths` from `.carta.json`.
- **Bundles**: Structural operations treat a bundle (root `.md` + same-prefix siblings) as a
  unit. Non-md sidecars travel with their host automatically — no declaration required.
- **Orphan warnings**: `carta regenerate` prints a stderr warning for any sidecar file whose
  numeric prefix has no corresponding `.md` root, or whose prefix matches a directory. Orphan
  warnings never block operation; the MANIFEST is still written.
- **Argument resolution**: `source`/`target`/`destination` args accept either workspace-relative
  paths (e.g., `01-product/02-features`) or doc refs (e.g., `doc01.02`).
- **`--no-regen` scope**: Skips MANIFEST.md rebuild only. Ref rewriting in doc content still
  happens. Useful for batch operations — run many moves with `--no-regen`, then one final
  `carta regenerate`.
- **Index files**: `00-index.md` files mark a directory as a title group. They cannot be
  renamed via `move --rename`. Use `rename` to change the directory slug instead.
- **Position 0 is reserved**: `--order` must be >= 1. Position 0 is always the index file.
"""

_COMMON_PATTERNS = """\
- **Batch restructure**: Use `--no-gap-close --no-regen` on all moves, then `carta regenerate` once at end.
  ```
  carta move doc01.02 01-strategy --no-gap-close --no-regen
  carta move doc01.03 01-strategy --no-gap-close --no-regen
  carta regenerate
  ```
- **Dissolve a group**: Move children out one by one (check paths between moves), then delete
  the empty index file and remove the empty directory.
  ```
  carta move 02-old-group/01-child.md 03-new-home --no-regen
  carta move 02-old-group/02-child.md 03-new-home --no-regen
  carta delete 02-old-group
  ```
- **Create a new title group**: `carta group NN-slug --title "Title"` creates the directory
  with `00-index.md`. Then use `carta move` or `carta create` to populate it.
- **Expand a file into a group**: `carta punch <target>` converts `NN-slug.md` into
  `NN-slug/00-index.md`. The doc ref is unchanged — no ref rewriting needed.
- **Flatten a subdirectory**: `carta flatten <target>` hoists children into parent, removing
  the directory. Use `--keep-index` to preserve the index as a sibling file.
- **Rename a slug**: `carta rename <target> new-slug` renames on disk. Then use
  `carta rewrite old-ref=new-ref` to update references if needed (rename does not rewrite refs).
"""


def generate_skill_content(dir_name: str) -> str:
    """Generate carta-cli SKILL.md content from template header + AI skill docs."""
    template = (_PACKAGE_DIR / "templates" / "skill.md").read_text(encoding="utf-8")
    template = template.replace("{{dir_name}}", dir_name)

    sections = [template.rstrip()]
    sections.append(_BUNDLES_AND_ATTACHMENTS)
    sections.append("## Command Reference\n")
    for doc in _COMMAND_DOCS.values():
        sections.append(doc)
    sections.append("## Behavioral Rules\n")
    sections.append(_BEHAVIORAL_RULES)
    sections.append("## Common Patterns\n")
    sections.append(_COMMON_PATTERNS)

    return "\n".join(sections) + "\n"


def _count_sidecars(directory: Path) -> int:
    """Count non-md numbered attachments in a directory tree (excluding orphans)."""
    count = 0
    for bndl in _bundle_mod.list_bundles(directory):
        if bndl.is_directory_bundle:
            count += _count_sidecars(bndl.attachments[0])
        elif bndl.root is not None:
            count += len(bndl.attachments)
    return count


def _workspace_state_section(carta_root: Path) -> list[str]:
    """Generate Section 4: live workspace state summary."""
    lines: list[str] = []

    try:
        ws = load_workspace(carta_root)
    except FileNotFoundError:
        ws = {}

    lines.append(f"Workspace root: `{carta_root.name}/`")
    lines.append("")

    top_entries = list_numbered_entries(carta_root)
    total_docs = 0
    total_sidecars = 0

    rows: list[tuple[str, str, int, int]] = []
    for entry in top_entries:
        if entry.is_dir():
            # Get title from 00-index.md frontmatter
            title = get_slug(entry.name).replace("-", " ").title()
            index_file = entry / "00-index.md"
            if index_file.exists():
                try:
                    fm, _ = read_frontmatter(index_file)
                    title = fm.get("title", title)
                except Exception:
                    pass
            # Count all .md files and sidecars under this directory
            count = sum(1 for _ in entry.rglob("*.md"))
            sidecars = _count_sidecars(entry)
            total_docs += count
            total_sidecars += sidecars
            rows.append((entry.name, title, count, sidecars))
        elif entry.suffix == ".md":
            total_docs += 1
            title = get_slug(entry.name).replace("-", " ").title()
            rows.append((entry.name, title, 1, 0))

    if rows:
        lines.append("| Directory | Title | Docs | Sidecars |")
        lines.append("|-----------|-------|------|----------|")
        for name, title, count, sidecars in rows:
            lines.append(f"| `{name}` | {title} | {count} | {sidecars} |")
        lines.append("")

    lines.append(f"**Total docs**: {total_docs}")
    lines.append(f"**Total sidecars**: {total_sidecars}")
    lines.append("")

    ext_paths = ws.get("externalRefPaths", [])
    if ext_paths:
        lines.append("**externalRefPaths** (ref rewriting also applies to these):")
        for p in ext_paths:
            lines.append(f"  - `{p}`")
    else:
        lines.append("**externalRefPaths**: none configured")

    return lines


def cmd_ai_skill(args: argparse.Namespace, carta_root: Path) -> None:
    """Generate comprehensive AI agent context for the carta CLI."""
    from .__version__ import __version__

    lines: list[str] = []

    lines.append(f"# carta AI Reference — v{__version__}")
    lines.append("")
    lines.append(
        "Complete semantic reference for AI agents driving the carta CLI. "
        "Covers command behavior, side effects, sequencing rules, and live workspace state."
    )
    lines.append("")

    # Bundles and Attachments overview
    lines.append("---")
    lines.append("")
    lines.append(_BUNDLES_AND_ATTACHMENTS)

    # Section 1: Command Reference
    lines.append("---")
    lines.append("")
    lines.append("## 1. Command Reference")
    lines.append("")
    for doc in _COMMAND_DOCS.values():
        lines.append(doc)

    # Section 2: Behavioral Rules
    lines.append("---")
    lines.append("")
    lines.append("## 2. Behavioral Rules")
    lines.append("")
    lines.append(_BEHAVIORAL_RULES)

    # Section 3: Common Patterns
    lines.append("---")
    lines.append("")
    lines.append("## 3. Common Patterns")
    lines.append("")
    lines.append(_COMMON_PATTERNS)

    # Section 4: Workspace State
    lines.append("---")
    lines.append("")
    lines.append("## 4. Workspace State")
    lines.append("")
    lines.extend(_workspace_state_section(carta_root))

    print("\n".join(lines))
