"""AI-skill documentation constants and generation logic for `carta ai-skill`."""
import argparse
import sys
from pathlib import Path

from .frontmatter import read_frontmatter
from .entries import list_numbered_entries
from .numbering import get_slug
from .workspace import load_workspace, get_external_ref_paths

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
carta create <destination> <slug> [--order N] [--title TEXT] [--dry-run]
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
carta move <source> <destination> [--order N] [--mkdir] [--rename SLUG] [--no-regen] [--dry-run]
```

Arguments:
  source       Path or doc ref to move. Accepts files (.md) and directories.
  destination  Target directory. Must exist unless --mkdir is used.

Side effects:
  - Removes source from its parent, gap-closes source siblings.
  - Inserts at destination, bumps destination siblings at or above --order.
  - Rewrites all cross-references in workspace + externalRefPaths.
  - Regenerates MANIFEST.md (unless --no-regen).

Flags:
  --order N      Insert at position N. Without this, appends after the last entry.
  --mkdir        Create destination directory if missing (also creates 00-index.md).
  --rename SLUG  Change the slug during the move. Extension is preserved automatically.
  --no-regen     Skip MANIFEST regeneration. Ref rewriting still happens.
  --dry-run      Print planned moves without executing.

Sequencing notes:
  - Each move changes numbering for subsequent commands — run sequentially, not in parallel.
  - When moving many entries out of a directory, move the highest-numbered first to avoid
    gap-closing invalidating subsequent source paths. Or check paths between moves.
  - Use --no-regen on all moves in a batch, then run `carta regenerate` once at the end.
""",

    "punch": """\
### punch

Expand a leaf `.md` file into a directory by converting it to `NN-slug/00-index.md`.

```
carta punch <target> [--dry-run]
```

Arguments:
  target  Path or doc ref to a numbered `.md` file.

Side effects:
  - Creates a directory with the same name (minus `.md` extension).
  - Moves the file into that directory as `00-index.md`.
  - Does NOT renumber siblings or rewrite refs (the doc ref is unchanged).

Flags:
  --dry-run  Print planned operation without executing.
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
  - Renames the file/directory on disk.
  - Does NOT rewrite cross-references (use `carta rewrite` for that).
  - Regenerates MANIFEST.md (unless --no-regen).

Flags:
  --no-regen  Skip MANIFEST regeneration.
""",

    "init": """\
### init

Initialize a new `.carta/` workspace in the current directory.

```
carta init [--name TEXT] [--dir DIRNAME] [--portable]
```

Side effects:
  - Creates `.carta.json` marker in the current directory.
  - Creates `DIRNAME/00-codex/00-index.md` and `DIRNAME/MANIFEST.md`.
  - Hydrates `.claude/skills/carta-cli/SKILL.md` (skips if exists).
  - Runs initial MANIFEST regeneration.

Flags:
  --name TEXT    Workspace title. Default: parent directory name.
  --dir DIRNAME  Workspace directory name. Default: `.carta`.
  --portable     Also copy editable Python scripts into workspace (pip-free usage).
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
""",
}

_BEHAVIORAL_RULES = """\
- **Gap-closing**: When an entry is removed from a directory (`move`, `delete`, `flatten`),
  all higher-numbered siblings are renumbered down to fill the gap.
- **Ref rewriting**: All commands that change file positions rewrite `docXX.YY.ZZ` refs
  across all `.md` files in the workspace and in `externalRefPaths` from `.carta.json`.
- **Non-.md files**: Commands only operate on numbered entries (`NN-slug` or `NN-slug.md`).
  Sidecar files (`.canvas.json`, images) must be moved manually.
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
- **Batch restructure**: Use `--no-regen` on all moves, then `carta regenerate` once at end.
  ```
  carta move doc01.02 01-strategy --no-regen
  carta move doc01.03 01-strategy --no-regen
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

    rows: list[tuple[str, str, int]] = []
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
            # Count all .md files under this directory
            count = sum(1 for _ in entry.rglob("*.md"))
            total_docs += count
            rows.append((entry.name, title, count))
        elif entry.suffix == ".md":
            total_docs += 1
            title = get_slug(entry.name).replace("-", " ").title()
            rows.append((entry.name, title, 1))

    if rows:
        lines.append("| Directory | Title | Docs |")
        lines.append("|-----------|-------|------|")
        for name, title, count in rows:
            lines.append(f"| `{name}` | {title} | {count} |")
        lines.append("")

    lines.append(f"**Total docs**: {total_docs}")
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
