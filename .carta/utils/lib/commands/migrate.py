"""migrate command — inject MANIFEST.md metadata into doc frontmatter (one-time)."""

import re
from pathlib import Path

import click

from ..workspace import find_carta_root
from ..manifest import parse_manifest, ManifestRow
from ..ref_convert import ref_to_path
from ..frontmatter import read_frontmatter, write_frontmatter


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_tags_string(s: str) -> list[str]:
    """Parse a tags/deps string into a list.

    Handles: "canvas, lod, zoom", "—", "", "[a, b]"
    """
    s = s.strip()
    if not s or s == "—":
        return []
    # Inline list format
    if s.startswith("[") and s.endswith("]"):
        content = s[1:-1].strip()
        if not content:
            return []
        return [item.strip() for item in content.split(",") if item.strip()]
    # Comma-separated
    return [item.strip() for item in s.split(",") if item.strip()]


def resolve_row_path(row: ManifestRow, carta_root: Path) -> Path | None:
    """Resolve a ManifestRow's ref to the .md file that should hold frontmatter.

    For file refs: returns the file path.
    For directory refs: returns the 00-index.md inside the directory.
    Returns None if the path cannot be resolved or the index file is absent.
    """
    try:
        path = ref_to_path(row.ref, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"WARN: cannot resolve {row.ref}: {e}", err=True)
        return None

    if path.is_dir():
        index = path / "00-index.md"
        if not index.exists():
            click.echo(
                f"WARN: {row.ref} → {path.relative_to(carta_root)}/ "
                f"has no 00-index.md, skipping",
                err=True,
            )
            return None
        return index

    return path


def inject_row_frontmatter(
    path: Path,
    carta_root: Path,
    row: ManifestRow,
    dry_run: bool,
) -> bool:
    """Inject summary, tags, deps from a ManifestRow into a file's frontmatter.

    Returns True if changes were made (or would be in dry-run mode).
    Does not overwrite existing non-empty values.
    """
    fm, body = read_frontmatter(path)

    new_summary = row.summary
    new_tags = parse_tags_string(row.tags)
    new_deps = parse_tags_string(row.deps)

    changed = False
    updated = dict(fm)

    if "summary" not in fm or not fm["summary"]:
        updated["summary"] = new_summary
        changed = True
    if "tags" not in fm:
        updated["tags"] = new_tags
        changed = True
    if "deps" not in fm:
        updated["deps"] = new_deps
        changed = True

    if not changed:
        return False

    rel = path.relative_to(carta_root)
    if dry_run:
        click.echo(f"  [dry-run] would update {rel}")
        if "summary" not in fm or not fm["summary"]:
            click.echo(f"    summary: {new_summary!r}")
        if "tags" not in fm:
            click.echo(f"    tags: {new_tags}")
        if "deps" not in fm:
            click.echo(f"    deps: {new_deps}")
    else:
        write_frontmatter(path, updated, body)

    return True


def inject_placeholder_frontmatter(
    path: Path,
    carta_root: Path,
    dry_run: bool,
) -> bool:
    """Add empty summary/tags/deps to a doc that has no MANIFEST row.

    Returns True if changes were made.
    """
    fm, body = read_frontmatter(path)

    changed = False
    updated = dict(fm)

    if "summary" not in fm:
        updated["summary"] = ""
        changed = True
    if "tags" not in fm:
        updated["tags"] = []
        changed = True
    if "deps" not in fm:
        updated["deps"] = []
        changed = True

    if not changed:
        return False

    if dry_run:
        rel = path.relative_to(carta_root)
        click.echo(f"  [dry-run] would add placeholders to {rel}")
    else:
        write_frontmatter(path, updated, body)

    return True


# ---------------------------------------------------------------------------
# Click command
# ---------------------------------------------------------------------------

@click.command(name="migrate-frontmatter")
@click.option("--dry-run", is_flag=True, help="Print what would change without writing.")
def migrate_frontmatter(dry_run: bool) -> None:
    """Inject MANIFEST.md metadata into doc frontmatter (one-time migration)."""
    carta_root = find_carta_root()
    manifest_path = carta_root / "MANIFEST.md"

    if not manifest_path.exists():
        click.echo(f"Error: MANIFEST.md not found at {manifest_path}", err=True)
        raise SystemExit(1)

    # Parse MANIFEST.md into rows
    manifest_data = parse_manifest(manifest_path)
    rows_by_ref: dict[str, ManifestRow] = {}
    for section in manifest_data.sections:
        for chunk in section.chunks:
            if isinstance(chunk, ManifestRow):
                rows_by_ref[chunk.ref] = chunk

    click.echo(f"Found {len(rows_by_ref)} MANIFEST rows")

    # Inject metadata from MANIFEST rows into doc frontmatter
    updated_count = 0
    for ref, row in sorted(rows_by_ref.items()):
        path = resolve_row_path(row, carta_root)
        if path is None:
            continue
        if inject_row_frontmatter(path, carta_root, row, dry_run=dry_run):
            updated_count += 1

    click.echo(f"{'Would update' if dry_run else 'Updated'} {updated_count} files from MANIFEST rows")

    # Walk all .md files without MANIFEST rows and add empty placeholders
    excluded = {carta_root / "utils"}
    placeholder_count = 0

    for md in sorted(carta_root.rglob("*.md")):
        if any(excl in md.parents for excl in excluded):
            continue
        if md.name == "MANIFEST.md":
            continue
        # Only process files with numeric prefix
        if not re.match(r'^\d{2}-', md.name):
            continue

        if inject_placeholder_frontmatter(md, carta_root, dry_run=dry_run):
            placeholder_count += 1

    click.echo(f"{'Would add' if dry_run else 'Added'} placeholders to {placeholder_count} unlisted files")

    if dry_run:
        click.echo("\n(dry-run: no files modified)")
