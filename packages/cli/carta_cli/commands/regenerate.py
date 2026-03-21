"""regenerate command — rebuild MANIFEST.md from doc frontmatter."""
from importlib import resources
from pathlib import Path

import click

from ..regenerate_core import do_regenerate


def load_preamble(dir_name: str) -> str:
    """Read manifest-preamble.md and substitute {{dir_name}}."""
    preamble = (
        resources.files("carta_cli")
        .joinpath("manifest-preamble.md")
        .read_text(encoding="utf-8")
    )
    return preamble.replace("{{dir_name}}", dir_name)


@click.command()
@click.option("--dry-run", is_flag=True, help="Print generated MANIFEST.md to stdout instead of writing.")
@click.pass_context
def regenerate(ctx: click.Context, dry_run: bool) -> None:
    """Rebuild MANIFEST.md from doc frontmatter."""
    carta_root = ctx.obj["workspace"]
    try:
        preamble = load_preamble(carta_root.name)
    except FileNotFoundError:
        click.echo("Error: manifest-preamble.md not found in carta_cli package data", err=True)
        raise SystemExit(1)
    do_regenerate(carta_root, preamble, dry_run=dry_run)
