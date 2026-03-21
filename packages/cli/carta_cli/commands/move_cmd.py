"""move command — move and/or reorder a doc entry with automatic ref renumbering."""

import shutil
from pathlib import Path

import click

from ..entries import resolve_arg, list_numbered_entries
from ..numbering import get_slug
from ..planning import compute_all_moves, compute_rename_map, print_rename_map
from ..rewriter import collect_md_files, rewrite_refs
from ..frontmatter import write_frontmatter
from ..workspace import load_workspace, get_external_ref_paths
from ..regenerate_core import do_regenerate
from .regenerate import load_preamble


def _create_index_for_new_dir(dir_path: Path) -> None:
    """Create a 00-index.md with minimal frontmatter in a new directory."""
    slug = get_slug(dir_path.name)
    title = slug.replace("-", " ").title()
    write_frontmatter(dir_path / "00-index.md", {
        "title": title, "status": "draft",
        "summary": "", "tags": [], "deps": [],
    }, f"\n# {title}\n")


@click.command()
@click.argument("source")
@click.argument("destination")
@click.option("--order", type=int, default=None, metavar="N",
              help="Insert at position N (1-indexed). Default: append to end.")
@click.option("--mkdir", is_flag=True,
              help="Create destination directory if it doesn't exist.")
@click.option("--rename", "rename_slug", default=None, metavar="SLUG",
              help="Rename the entry's slug (the part after NN-).")
@click.option("--dry-run", is_flag=True,
              help="Print planned moves without executing.")
@click.pass_context
def move(ctx: click.Context, source: str, destination: str, order: int | None, mkdir: bool, rename_slug: str | None, dry_run: bool) -> None:
    """Move and/or reorder a doc entry with automatic ref renumbering."""
    if order is not None and order < 1:
        click.echo(
            "Error: --order must be >= 1 (position 0 is reserved for index files).",
            err=True,
        )
        raise SystemExit(1)

    # Resolve workspace root
    carta_root = ctx.obj["workspace"]

    # Resolve source and destination
    try:
        source_path = resolve_arg(source, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"Error resolving source {source!r}: {e}", err=True)
        raise SystemExit(1)

    if not source_path.exists():
        click.echo(f"Error: source does not exist: {source_path}", err=True)
        raise SystemExit(1)

    if rename_slug and source_path.name == "00-index.md":
        click.echo("Error: cannot rename 00-index.md files.", err=True)
        raise SystemExit(1)

    try:
        dest_path = resolve_arg(destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        if not mkdir:
            click.echo(f"Error resolving destination {destination!r}: {e}", err=True)
            raise SystemExit(1)
        # --mkdir: treat destination as relative path to carta_root
        dest_path = (carta_root / destination).resolve()

    mkdir_created = False
    if not dest_path.exists():
        if not mkdir:
            click.echo(f"Error: destination does not exist: {dest_path}", err=True)
            raise SystemExit(1)
        # --mkdir: create the directory (parent must exist)
        if not dest_path.parent.exists():
            click.echo(
                f"Error: parent directory does not exist: {dest_path.parent}\n"
                "--mkdir only creates one level of directory.",
                err=True,
            )
            raise SystemExit(1)
        mkdir_created = True
        dest_path.mkdir()
        _create_index_for_new_dir(dest_path)
        if dry_run:
            click.echo(f"Would create directory: {dest_path.relative_to(carta_root)}")

    if dest_path.exists() and not dest_path.is_dir():
        click.echo(
            f"Error: destination is not a directory: {dest_path}",
            err=True,
        )
        raise SystemExit(1)

    # Check destination capacity (skip if mkdir just created it — it's empty)
    if not mkdir_created:
        dest_entries = list_numbered_entries(dest_path)
        if len(dest_entries) >= 99:
            click.echo(f"Error: destination has >= 99 items: {dest_path}", err=True)
            raise SystemExit(1)

    # Compute all filesystem moves
    try:
        moves = compute_all_moves(source_path, dest_path, order, rename_slug=rename_slug)
    except ValueError as e:
        click.echo(f"Error computing moves: {e}", err=True)
        raise SystemExit(1)

    # Compute rename map from moves (before any filesystem operations)
    rename_map = compute_rename_map(moves, carta_root)

    if dry_run:
        print_rename_map(rename_map, moves)
        click.echo("\n(dry-run: no files modified)")
        if mkdir_created:
            shutil.rmtree(str(dest_path))
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
    do_regenerate(carta_root, load_preamble(carta_root.name))

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
