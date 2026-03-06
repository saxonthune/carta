"""init command — scaffold a new .carta/ workspace."""

import json
from importlib import resources
from pathlib import Path

import click


def _read_template(name: str) -> str:
    """Read a template file from the package's templates/ directory."""
    return resources.files("carta_cli").joinpath("templates", name).read_text(encoding="utf-8")


@click.command()
@click.option("--name", default=None, help="Workspace title. Default: parent directory name.")
@click.pass_context
def init(ctx: click.Context, name: str | None) -> None:
    """Initialize a new .carta/ workspace in the current directory."""
    project_root = Path.cwd().resolve()
    carta_dir = project_root / ".carta"

    if (carta_dir / "workspace.json").exists():
        click.echo(f"Workspace already exists: {carta_dir / 'workspace.json'}")
        click.echo("Use other carta commands to modify the existing workspace.")
        return

    title = name or project_root.name

    # Create .carta/ directory structure
    codex_dir = carta_dir / "00-codex"
    codex_dir.mkdir(parents=True, exist_ok=True)

    # Write workspace.json from template
    ws_content = _read_template("workspace.json").replace("{{title}}", title)
    (carta_dir / "workspace.json").write_text(ws_content, encoding="utf-8")

    # Write 00-codex/00-index.md from template
    index_content = _read_template("00-index.md").replace("{{title}}", title)
    (codex_dir / "00-index.md").write_text(index_content, encoding="utf-8")

    # Write empty MANIFEST.md (will be populated by regenerate)
    (carta_dir / "MANIFEST.md").write_text(
        "# .carta/ Manifest\n\nMachine-readable index for AI navigation. "
        "Run `carta regenerate` to populate.\n",
        encoding="utf-8",
    )

    # Hydrate .claude/skills/carta-cli/SKILL.md for AI agent integration
    skill_dir = project_root / ".claude" / "skills" / "carta-cli"
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_path = skill_dir / "SKILL.md"
    if not skill_path.exists():
        skill_path.write_text(_read_template("skill.md"), encoding="utf-8")
        click.echo(f"  Hydrated: .claude/skills/carta-cli/SKILL.md")
    else:
        click.echo(f"  Skipped:  .claude/skills/carta-cli/SKILL.md (already exists)")

    # Run regenerate to build the real MANIFEST
    # Import here to avoid circular dependency at module level
    from .regenerate import do_regenerate
    do_regenerate(carta_dir)

    click.echo(f"\nInitialized .carta/ workspace: {title}")
    click.echo(f"  Created:  .carta/workspace.json")
    click.echo(f"  Created:  .carta/00-codex/00-index.md")
    click.echo(f"  Created:  .carta/MANIFEST.md")
    click.echo(f"\nNext steps:")
    click.echo(f"  carta create 00-codex my-first-doc   # add a document")
    click.echo(f"  carta --help                          # see all commands")
