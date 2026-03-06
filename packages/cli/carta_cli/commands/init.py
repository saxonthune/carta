"""init command — initialize workspace.json with externalRefPaths."""

import json
from pathlib import Path

import click


DEFAULT_EXTERNAL_REF_PATHS = [
    "CLAUDE.md",
    ".claude/skills/**/*.md",
    ".cursor/**/*.md",
]


@click.command()
@click.pass_context
def init(ctx: click.Context) -> None:
    """Initialize workspace.json with externalRefPaths."""
    carta_root = ctx.obj["workspace"]

    ws_path = carta_root / "workspace.json"
    ws = json.loads(ws_path.read_text(encoding="utf-8"))

    if "externalRefPaths" in ws:
        click.echo(f"workspace.json already has externalRefPaths: {ws['externalRefPaths']}")
        return

    ws["externalRefPaths"] = DEFAULT_EXTERNAL_REF_PATHS
    ws_path.write_text(json.dumps(ws, indent=2) + "\n", encoding="utf-8")
    click.echo(f"Added externalRefPaths to {ws_path}")
    click.echo(json.dumps({"externalRefPaths": ws["externalRefPaths"]}, indent=2))
