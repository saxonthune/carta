"""init command — scaffold a new workspace."""

import json
from importlib import resources
from pathlib import Path

import click

from ..workspace import MARKER


def _read_template(name: str) -> str:
    """Read a template file from the package's templates/ directory."""
    return resources.files("carta_cli").joinpath("templates", name).read_text(encoding="utf-8")


@click.command()
@click.option("--name", default=None, help="Workspace title. Default: parent directory name.")
@click.option("--dir", "dirname", default=".carta", help="Name of the workspace directory. Default: .carta")
@click.option("--portable", is_flag=True, default=False, help="Copy carta.pyz to project root for pip-free usage.")
@click.pass_context
def init(ctx: click.Context, name: str | None, dirname: str, portable: bool) -> None:
    """Initialize a new workspace in the current directory."""
    project_root = Path.cwd().resolve()
    marker_path = project_root / MARKER
    carta_dir = project_root / dirname

    if marker_path.exists():
        click.echo(f"Workspace already exists: {marker_path}")
        click.echo("Use other carta commands to modify the existing workspace.")
        return

    title = name or project_root.name

    # Create workspace directory structure
    codex_dir = carta_dir / "00-codex"
    codex_dir.mkdir(parents=True, exist_ok=True)

    # Write .carta.json marker at project root
    marker_content = {
        "root": f"{dirname}/",
        "title": title,
        "description": "",
        "groups": {
            "00-codex": {
                "name": "Codex",
                "description": "Meta-documentation: how to read docs, cross-reference syntax, maintenance",
            }
        },
        "externalRefPaths": [
            "CLAUDE.md",
            ".claude/skills/**/*.md",
            ".cursor/**/*.md",
        ],
    }
    marker_path.write_text(json.dumps(marker_content, indent=2) + "\n", encoding="utf-8")

    # Write 00-codex/00-index.md from template
    index_content = _read_template("00-index.md").replace("{{title}}", title)
    (codex_dir / "00-index.md").write_text(index_content, encoding="utf-8")

    # Write empty MANIFEST.md (will be populated by regenerate)
    (carta_dir / "MANIFEST.md").write_text(
        f"# {dirname}/ Manifest\n\nMachine-readable index for AI navigation. "
        "Run `carta regenerate` to populate.\n",
        encoding="utf-8",
    )

    # Hydrate .claude/skills/carta-cli/SKILL.md for AI agent integration
    skill_dir = project_root / ".claude" / "skills" / "carta-cli"
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_path = skill_dir / "SKILL.md"
    if not skill_path.exists():
        skill_content = _read_template("skill.md").replace("{{dir_name}}", dirname)
        skill_path.write_text(skill_content, encoding="utf-8")
        click.echo(f"  Hydrated: .claude/skills/carta-cli/SKILL.md")
    else:
        click.echo(f"  Skipped:  .claude/skills/carta-cli/SKILL.md (already exists)")

    # Run regenerate to build the real MANIFEST
    # Import here to avoid circular dependency at module level
    from .regenerate import do_regenerate
    do_regenerate(carta_dir)

    click.echo(f"\nInitialized {dirname}/ workspace: {title}")
    click.echo(f"  Created:  {MARKER}")
    click.echo(f"  Created:  {dirname}/00-codex/00-index.md")
    click.echo(f"  Created:  {dirname}/MANIFEST.md")

    if portable:
        from .portable import copy_portable
        if copy_portable(project_root):
            click.echo(f"  Copied:   carta.pyz (portable CLI)")
            click.echo(f"  Usage:    python3 carta.pyz <command>")
        else:
            click.echo(
                "  Warning:  carta.pyz not found in package data. "
                "Build it with: python3 build_zipapp.py",
                err=True,
            )

    click.echo(f"\nNext steps:")
    click.echo(f"  carta create 00-codex my-first-doc   # add a document")
    click.echo(f"  carta --help                          # see all commands")
