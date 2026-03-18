"""portable command — copy carta.pyz to the project root."""

from importlib import resources
from pathlib import Path

import click

from ..__version__ import __version__


def copy_portable(dest_dir: Path) -> bool:
    """Copy bundled carta.pyz to dest_dir. Returns True on success."""
    bundled = resources.files("carta_cli").joinpath("carta.pyz")
    dest = dest_dir / "carta.pyz"

    try:
        dest.write_bytes(bundled.read_bytes())
        return True
    except FileNotFoundError:
        return False


@click.command()
@click.pass_context
def portable(ctx: click.Context) -> None:
    """Copy carta.pyz to the project root for pip-free usage."""
    project_root = Path.cwd().resolve()

    if copy_portable(project_root):
        click.echo(f"Copied carta.pyz ({__version__}) to {project_root / 'carta.pyz'}")
        click.echo(f"Usage: python3 carta.pyz <command>")
    else:
        click.echo(
            "Error: carta.pyz not found in package data. "
            "Build it with: python3 build_zipapp.py",
            err=True,
        )
        raise SystemExit(1)
