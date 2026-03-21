"""create command — create a new doc entry at a given position."""

import re
from pathlib import Path

import click

from ..entries import resolve_arg, list_numbered_entries
from ..numbering import get_numeric_prefix, compute_insertion_prefix
from ..frontmatter import write_frontmatter
from ..regenerate_core import do_regenerate
from .regenerate import load_preamble


@click.command()
@click.argument("destination")
@click.argument("slug")
@click.option("--order", type=int, default=None, metavar="N",
              help="Insert at position N (1-indexed). Default: append to end.")
@click.option("--title", default=None, help="Title for the new doc. Default: derived from slug.")
@click.option("--dry-run", is_flag=True, help="Print planned changes without executing.")
@click.pass_context
def create(ctx: click.Context, destination: str, slug: str, order: int | None, title: str | None, dry_run: bool) -> None:
    """Create a new doc entry with blank frontmatter at a given position."""
    carta_root = ctx.obj["workspace"]

    # Validate slug has no numeric prefix
    if re.match(r'^\d{2}-', slug):
        click.echo("Error: slug must not contain a numeric prefix (NN-). Provide just the slug part.", err=True)
        raise SystemExit(1)

    if order is not None and order < 1:
        click.echo("Error: --order must be >= 1 (position 0 is reserved for index files).", err=True)
        raise SystemExit(1)

    # Resolve destination
    try:
        dest_path = resolve_arg(destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"Error resolving destination {destination!r}: {e}", err=True)
        raise SystemExit(1)

    if not dest_path.exists():
        click.echo(f"Error: destination does not exist: {dest_path}", err=True)
        raise SystemExit(1)

    if not dest_path.is_dir():
        click.echo(f"Error: destination is not a directory: {dest_path}", err=True)
        raise SystemExit(1)

    # Compute insertion prefix
    prefix = compute_insertion_prefix(list_numbered_entries(dest_path), order)

    # Check if position is occupied
    entries = list_numbered_entries(dest_path)
    occupied = {get_numeric_prefix(e.name) for e in entries}
    if prefix in occupied:
        click.echo(
            f"Error: position {prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
            f"Occupied positions: {sorted(occupied)}",
            err=True,
        )
        raise SystemExit(1)

    # Derive title from slug if not provided
    if title is None:
        title = slug.replace("-", " ").title()

    new_name = f"{prefix:02d}-{slug}.md"
    new_path = dest_path / new_name

    if dry_run:
        click.echo(f"Would create: {new_path.relative_to(carta_root)}")
        click.echo(f"  Title: {title}")
        click.echo(f"  Position: {prefix:02d}")
        click.echo("\n(dry-run: no files created)")
        return

    # Write the file
    frontmatter = {
        "title": title,
        "status": "draft",
        "summary": "",
        "tags": [],
        "deps": [],
    }
    write_frontmatter(new_path, frontmatter, f"\n# {title}\n")

    # Regenerate manifest
    do_regenerate(carta_root, load_preamble(carta_root.name))

    click.echo(f"Created: {new_path.relative_to(carta_root)}")
    click.echo(f"  Title: {title}")
    click.echo(f"  Position: {prefix:02d}")
