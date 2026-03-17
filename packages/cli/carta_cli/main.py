"""carta — workspace tools for managing documentation structure.

Usage:
    carta <command> [options]

Commands:
    create               Create a new doc entry
    delete               Delete doc entries with gap-closing
    move                 Move and/or reorder a doc entry
    punch                Expand a leaf file into a directory
    flatten              Dissolve a directory, hoisting children
    copy                 Copy a file into the workspace at a given position
    rewrite              Rewrite doc refs using user-supplied mappings
    regenerate           Rebuild MANIFEST.md from doc frontmatter
    migrate-frontmatter  Inject MANIFEST data into doc frontmatter (one-time)
    init                 Initialize a new workspace
"""

from pathlib import Path

import click

from .__version__ import __version__
from .workspace import find_workspace
from .commands.create import create
from .commands.delete import delete
from .commands.move_cmd import move
from .commands.regenerate import regenerate
from .commands.migrate import migrate_frontmatter
from .commands.init import init
from .commands.punch import punch
from .commands.flatten import flatten
from .commands.rewrite import rewrite
from .commands.copy import copy


@click.group()
@click.version_option(version=__version__, prog_name="carta-cli")
@click.option(
    "--workspace", "-w",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=None,
    help="Path to the workspace directory. Default: auto-detect from cwd.",
)
@click.pass_context
def cli(ctx: click.Context, workspace: Path | None) -> None:
    """Workspace tools for managing documentation structure."""
    ctx.ensure_object(dict)
    # `init` doesn't require an existing workspace — skip discovery for it
    if ctx.invoked_subcommand == "init":
        ctx.obj["workspace"] = None
        return
    if workspace is not None:
        ctx.obj["workspace"] = workspace
    else:
        try:
            ctx.obj["workspace"] = find_workspace()
        except FileNotFoundError as e:
            click.echo(f"Error: {e}", err=True)
            raise SystemExit(1)


cli.add_command(create)
cli.add_command(delete)
cli.add_command(move)
cli.add_command(regenerate)
cli.add_command(migrate_frontmatter, name="migrate-frontmatter")
cli.add_command(init)
cli.add_command(punch)
cli.add_command(flatten)
cli.add_command(rewrite)
cli.add_command(copy)


if __name__ == "__main__":
    cli()
