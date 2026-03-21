"""copy command — copy a file into the workspace at a given position."""

import re
import shutil
from pathlib import Path

import click

from ..entries import resolve_arg, list_numbered_entries
from ..numbering import get_numeric_prefix, compute_insertion_prefix
from ..regenerate_core import do_regenerate
from .regenerate import load_preamble


@click.command()
@click.argument("source_file", type=click.Path(exists=True))
@click.argument("destination")
@click.option("--order", type=int, default=None, metavar="N",
              help="Insert at position N (1-indexed). Default: append to end.")
@click.option("--rename", "rename_slug", default=None, metavar="SLUG",
              help="Slug for the copied file (default: derived from source filename).")
@click.option("--dry-run", is_flag=True, help="Print planned changes without executing.")
@click.pass_context
def copy(ctx: click.Context, source_file: str, destination: str, order: int | None,
         rename_slug: str | None, dry_run: bool) -> None:
    """Copy a file into the workspace at a given position.

    Copies SOURCE_FILE into DESTINATION directory with automatic numbering.
    Useful for restoring files from backup into a restructured workspace.
    """
    carta_root = ctx.obj["workspace"]
    source_path = Path(source_file).resolve()

    if order is not None and order < 1:
        click.echo("Error: --order must be >= 1.", err=True)
        raise SystemExit(1)

    # Resolve destination directory
    try:
        dest_path = resolve_arg(destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"Error resolving destination {destination!r}: {e}", err=True)
        raise SystemExit(1)

    if not dest_path.is_dir():
        click.echo(f"Error: destination is not a directory: {dest_path}", err=True)
        raise SystemExit(1)

    # Derive slug from source filename if not provided
    if rename_slug is None:
        stem = source_path.stem  # e.g. "03-my-doc" or "my-doc"
        # Strip any existing numeric prefix
        m = re.match(r'^\d{2}-(.*)', stem)
        rename_slug = m.group(1) if m else stem

    # Compute insertion prefix
    entries = list_numbered_entries(dest_path)
    prefix = compute_insertion_prefix(entries, order)

    # Check if position is occupied
    occupied = {get_numeric_prefix(e.name) for e in entries}
    if prefix in occupied:
        click.echo(
            f"Error: position {prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
            f"Occupied positions: {sorted(occupied)}",
            err=True,
        )
        raise SystemExit(1)

    # Build target filename
    ext = source_path.suffix or ".md"
    new_name = f"{prefix:02d}-{rename_slug}{ext}"
    new_path = dest_path / new_name

    if dry_run:
        click.echo(f"Would copy: {source_path.name} -> {new_path.relative_to(carta_root)}")
        click.echo(f"  Position: {prefix:02d}")
        click.echo(f"  Slug: {rename_slug}")
        click.echo("\n(dry-run: no files modified)")
        return

    shutil.copy2(str(source_path), str(new_path))

    # Regenerate manifest
    do_regenerate(carta_root, load_preamble(carta_root.name))

    click.echo(f"Copied: {source_path.name} -> {new_path.relative_to(carta_root)}")
    click.echo(f"  Position: {prefix:02d}")
