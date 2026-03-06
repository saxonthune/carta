"""flatten command — dissolve a directory, hoisting children into the parent."""

import shutil
import tempfile
from pathlib import Path

import click

from ..entries import resolve_arg, list_numbered_entries
from ..numbering import get_numeric_prefix, get_slug
from ..planning import compute_rename_map
from ..rewriter import collect_md_files, rewrite_refs
from ..workspace import find_carta_root, load_workspace, get_external_ref_paths
from ..frontmatter import read_frontmatter
from .regenerate import do_regenerate


def _count_content_lines(path: Path) -> int:
    """Count non-blank body lines (after frontmatter) in a .md file."""
    _, body = read_frontmatter(path)
    return sum(1 for line in body.splitlines() if line.strip())


@click.command()
@click.argument("source")
@click.option("--keep-index", is_flag=True,
              help="Keep 00-index.md as a numbered file (using parent dir slug).")
@click.option("--force", is_flag=True,
              help="Discard 00-index.md even if it has significant content.")
@click.option("--at", "at_position", type=int, default=None, metavar="N",
              help="Insert children starting at position N. Default: flattened dir's position.")
@click.option("--dry-run", is_flag=True,
              help="Print planned changes without executing.")
def flatten(source: str, keep_index: bool, force: bool,
            at_position: int | None, dry_run: bool) -> None:
    """Dissolve a directory, hoisting children into the parent."""
    carta_root = find_carta_root()

    try:
        source_path = resolve_arg(source, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"Error resolving source {source!r}: {e}", err=True)
        raise SystemExit(1)

    if not source_path.exists():
        click.echo(f"Error: source does not exist: {source_path}", err=True)
        raise SystemExit(1)

    if not source_path.is_dir():
        click.echo(f"Error: source is not a directory: {source_path}", err=True)
        raise SystemExit(1)

    source_prefix = get_numeric_prefix(source_path.name)
    if source_prefix is None:
        click.echo(f"Error: source has no numeric prefix: {source_path.name}", err=True)
        raise SystemExit(1)

    parent_dir = source_path.parent
    insertion_start = at_position if at_position is not None else source_prefix

    # --- Handle 00-index.md ---
    index_file = source_path / "00-index.md"
    has_index = index_file.exists()

    if has_index and not keep_index:
        content_lines = _count_content_lines(index_file)
        if content_lines > 10 and not force:
            click.echo(
                f"Error: {index_file.relative_to(carta_root)} has {content_lines} "
                "content lines.\nUse --keep-index to preserve it, or --force to discard.",
                err=True,
            )
            raise SystemExit(1)

    # --- Build ordered list of items for parent after flatten ---
    # Partition existing parent entries (excluding source_path) into before/after
    parent_entries = list_numbered_entries(parent_dir)
    before: list[tuple[Path, str]] = []
    after: list[tuple[Path, str]] = []

    for entry in parent_entries:
        if entry.resolve() == source_path.resolve():
            continue  # the dir being flattened — omit
        pfx = get_numeric_prefix(entry.name)
        if pfx < insertion_start:
            before.append((entry, get_slug(entry.name)))
        else:
            after.append((entry, get_slug(entry.name)))

    # Build hoisted list (children of source_path to promote)
    hoisted: list[tuple[Path, str]] = []
    if has_index and keep_index:
        # Demote 00-index.md to a regular file using the parent dir's slug
        dir_slug = get_slug(source_path.name) + ".md"  # e.g. "decisions.md"
        hoisted.append((index_file, dir_slug))

    for child in list_numbered_entries(source_path):
        if child.name == "00-index.md":
            continue  # handled above (kept or discarded)
        hoisted.append((child, get_slug(child.name)))

    if not hoisted:
        click.echo("Error: no children to hoist.", err=True)
        raise SystemExit(1)

    # Final ordered list: before + hoisted + after
    final_order = before + hoisted + after

    # --- Compute logical moves for rename map (before executing) ---
    moves: list[tuple[Path, Path]] = []
    for idx, (item_path, slug) in enumerate(final_order):
        new_prefix = idx + 1  # start at 01
        new_name = f"{new_prefix:02d}-{slug}"
        new_path = parent_dir / new_name
        if item_path.resolve() != new_path.resolve():
            moves.append((item_path, new_path))

    rename_map = compute_rename_map(moves, carta_root)

    if dry_run:
        click.echo("=== Planned flatten ===")
        click.echo(f"Dissolving: {source_path.relative_to(carta_root)}")
        click.echo(f"Children to hoist: {len(hoisted)}")
        if has_index:
            if keep_index:
                click.echo(f"Index: kept as {get_slug(source_path.name)}.md")
            else:
                click.echo("Index: discarded")
        click.echo()
        click.echo("=== Filesystem moves ===")
        for old, new in moves:
            click.echo(f"  {old.relative_to(carta_root)} -> {new.relative_to(carta_root)}")
        click.echo()
        click.echo(f"=== Ref rename map ({len(rename_map)} entries) ===")
        for old_ref, new_ref in sorted(rename_map.items()):
            click.echo(f"  {old_ref} -> {new_ref}")
        click.echo("\n(dry-run: no files modified)")
        return

    # --- Execute: stage all items to temp dir, then place at final positions ---
    # Staging avoids rename collisions when items shift around in the same directory.
    with tempfile.TemporaryDirectory(dir=parent_dir) as staging:
        staging_path = Path(staging)

        staged: list[tuple[Path, str, int]] = []
        for idx, (item_path, slug) in enumerate(final_order):
            final_prefix = idx + 1
            stage_name = f"{final_prefix:02d}-{slug}"
            stage_path = staging_path / stage_name
            shutil.move(str(item_path), str(stage_path))
            staged.append((stage_path, slug, final_prefix))

        # Delete index if discarding (was not moved to staging, still in source_path)
        if has_index and not keep_index:
            remaining_index = source_path / "00-index.md"
            if remaining_index.exists():
                remaining_index.unlink()

        # Remove the now-empty source directory
        if source_path.exists():
            shutil.rmtree(str(source_path))

        # Place staged items at final positions
        for stage_path, slug, final_prefix in staged:
            final_name = f"{final_prefix:02d}-{slug}"
            final_path = parent_dir / final_name
            shutil.move(str(stage_path), str(final_path))

    # --- Rewrite refs ---
    manifest_path = carta_root / "MANIFEST.md"
    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]
    rewrite_results = rewrite_refs(md_files, rename_map)

    # Rebuild manifest
    do_regenerate(carta_root)

    # --- Summary ---
    click.echo(f"Flattened: {source_path.name} ({len(hoisted)} children hoisted)")
    click.echo(f"Refs updated: {sum(rewrite_results.values())} replacement(s) across {len(rewrite_results)} file(s)")
    if rename_map:
        click.echo(f"Rename map ({len(rename_map)} entries):")
        for old_ref, new_ref in sorted(rename_map.items()):
            click.echo(f"  {old_ref} -> {new_ref}")
