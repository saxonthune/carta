"""punch command — expand a leaf file into a directory."""

import shutil
from pathlib import Path

import click

from ..entries import resolve_arg
from ..numbering import get_numeric_prefix
from ..workspace import find_carta_root


@click.command()
@click.argument("source")
@click.option("--dry-run", is_flag=True, help="Print planned changes without executing.")
def punch(source: str, dry_run: bool) -> None:
    """Expand a leaf file into a directory.

    Turns NN-slug.md into NN-slug/00-index.md. The doc ref remains stable.
    """
    carta_root = find_carta_root()

    try:
        source_path = resolve_arg(source, carta_root)
    except (FileNotFoundError, ValueError) as e:
        click.echo(f"Error resolving source {source!r}: {e}", err=True)
        raise SystemExit(1)

    if not source_path.exists():
        click.echo(f"Error: source does not exist: {source_path}", err=True)
        raise SystemExit(1)

    if source_path.is_dir():
        click.echo(f"Error: source is already a directory: {source_path}", err=True)
        raise SystemExit(1)

    if not source_path.name.endswith(".md"):
        click.echo(f"Error: source is not a .md file: {source_path}", err=True)
        raise SystemExit(1)

    prefix = get_numeric_prefix(source_path.name)
    if prefix is None:
        click.echo(f"Error: source has no numeric prefix: {source_path.name}", err=True)
        raise SystemExit(1)

    # Compute new directory path: strip .md extension
    dir_name = source_path.name[:-3]  # e.g. "01-canvas.md" → "01-canvas"
    new_dir = source_path.parent / dir_name
    new_index = new_dir / "00-index.md"

    if dry_run:
        click.echo(f"Would punch: {source_path.name} → {dir_name}/00-index.md")
        click.echo("\n(dry-run: no files modified)")
        return

    # Create directory and move file
    new_dir.mkdir()
    shutil.move(str(source_path), str(new_index))

    click.echo(f"Punched: {source_path.name} → {dir_name}/00-index.md")
