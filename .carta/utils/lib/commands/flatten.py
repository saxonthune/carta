"""flatten command stub — dissolve a directory, hoisting children."""

import click


@click.command()
@click.argument("source")
@click.option("--dry-run", is_flag=True, help="Print planned changes without executing.")
def flatten(source: str, dry_run: bool) -> None:
    """Dissolve a directory, hoisting children into the parent."""
    click.echo("Error: flatten is not yet implemented.", err=True)
    raise SystemExit(1)
