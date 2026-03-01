"""punch command stub — expand a leaf file into a directory."""

import click


@click.command()
@click.argument("source")
@click.option("--dry-run", is_flag=True, help="Print planned changes without executing.")
def punch(source: str, dry_run: bool) -> None:
    """Expand a leaf file into a directory."""
    click.echo("Error: punch is not yet implemented.", err=True)
    raise SystemExit(1)
