"""move command — move and/or reorder a doc entry with automatic ref renumbering."""

import sys
import shutil
from pathlib import Path

import click

from ..move import (
    resolve_arg,
    compute_all_moves,
    print_rename_map,
    list_numbered_entries,
)
from ..refs import compute_rename_map, collect_md_files, rewrite_refs
from ..workspace import find_carta_root, load_workspace, get_external_ref_paths
from .regenerate import do_regenerate


@click.command()
@click.argument("source")
@click.argument("destination")
@click.option("--order", type=int, default=None, metavar="N",
              help="Insert at position N (1-indexed). Default: append to end.")
@click.option("--mkdir", is_flag=True,
              help="Create destination if it doesn't exist (NOT IMPLEMENTED).")
@click.option("--dry-run", is_flag=True,
              help="Print planned moves without executing.")
def move(source: str, destination: str, order: int | None, mkdir: bool, dry_run: bool) -> None:
    """Move and/or reorder a doc entry with automatic ref renumbering."""
    if mkdir:
        click.echo("Error: --mkdir is not implemented.", err=True)
        raise SystemExit(1)

    if order is not None and order < 1:
        click.echo(
            "Error: --order must be >= 1 (position 0 is reserved for index files).",
            err=True,
        )
        raise SystemExit(1)

    # Resolve .carta/ root
    carta_root = find_carta_root()

    # Resolve source and destination
    try:
        source_path = resolve_arg(source, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"Error resolving source {source!r}: {e}", err=True)
        raise SystemExit(1)

    if not source_path.exists():
        click.echo(f"Error: source does not exist: {source_path}", err=True)
        raise SystemExit(1)

    try:
        dest_path = resolve_arg(destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"Error resolving destination {destination!r}: {e}", err=True)
        raise SystemExit(1)

    if not dest_path.exists():
        click.echo(f"Error: destination does not exist: {dest_path}", err=True)
        raise SystemExit(1)

    if not dest_path.is_dir():
        click.echo(
            f"Error: destination is not a directory: {dest_path}\n"
            "Use --mkdir to create it (not implemented).",
            err=True,
        )
        raise SystemExit(1)

    # Check destination capacity
    dest_entries = list_numbered_entries(dest_path)
    if len(dest_entries) >= 99:
        click.echo(f"Error: destination has >= 99 items: {dest_path}", err=True)
        raise SystemExit(1)

    # Compute all filesystem moves
    try:
        moves = compute_all_moves(source_path, dest_path, order)
    except ValueError as e:
        click.echo(f"Error computing moves: {e}", err=True)
        raise SystemExit(1)

    # Compute rename map from moves (before any filesystem operations)
    rename_map = compute_rename_map(moves, carta_root)

    if dry_run:
        print_rename_map(rename_map, moves)
        click.echo("\n(dry-run: no files modified)")
        return

    # Execute filesystem moves
    for old_path, new_path in moves:
        if old_path.exists():
            shutil.move(str(old_path), str(new_path))

    # Rewrite refs across all .md files (MANIFEST.md will be fully regenerated below)
    manifest_path = carta_root / "MANIFEST.md"
    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]
    rewrite_results = rewrite_refs(md_files, rename_map)

    # Rebuild MANIFEST.md from scratch (replaces incremental manifest manipulation)
    do_regenerate(carta_root)

    # Print summary
    click.echo(f"Moved {len(moves)} item(s):")
    for old, new in moves:
        click.echo(f"  {old.name} -> {new}")

    refs_touched = len(rewrite_results)
    total_replacements = sum(rewrite_results.values())
    click.echo(f"Refs updated: {total_replacements} replacement(s) across {refs_touched} file(s)")
    click.echo(f"Rename map ({len(rename_map)} entries):")
    for old_ref, new_ref in sorted(rename_map.items()):
        click.echo(f"  {old_ref} -> {new_ref}")
