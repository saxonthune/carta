"""portable command — dump editable scripts into the workspace."""

from importlib import resources
from pathlib import Path
import json

import click

from ..__version__ import __version__
from ..workspace import MARKER

# Library modules to copy (relative to carta_cli package)
_LIBRARY_MODULES = [
    "frontmatter.py",
    "entries.py",
    "numbering.py",
    "ref_convert.py",
    "rewriter.py",
    "planning.py",
    "manifest.py",
    "workspace.py",
    "__version__.py",
    "regenerate_core.py",
]

_DATA_FILES = [
    "manifest-preamble.md",
]


def copy_portable(carta_root: Path) -> bool:
    """Copy portable scripts into carta_root. Returns True on success."""
    pkg = resources.files("carta_cli")
    scripts_dir = carta_root / "_scripts"
    scripts_dir.mkdir(exist_ok=True)

    # Write __init__.py
    (scripts_dir / "__init__.py").write_text("", encoding="utf-8")

    # Copy library modules
    for module in _LIBRARY_MODULES:
        src = pkg.joinpath(module)
        (scripts_dir / module).write_bytes(src.read_bytes())

    # Copy data files
    for data_file in _DATA_FILES:
        src = pkg.joinpath(data_file)
        (scripts_dir / data_file).write_bytes(src.read_bytes())

    # Copy main dispatcher template
    main_template = pkg.joinpath("portable", "carta_main.py")
    (carta_root / "carta.py").write_bytes(main_template.read_bytes())

    # Update .carta.json with portable field
    marker_path = carta_root.parent / MARKER
    if marker_path.exists():
        config = json.loads(marker_path.read_text(encoding="utf-8"))
        root_prefix = config.get("root", ".carta/")
        config["portable"] = f"{root_prefix}carta.py"
        marker_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    return True


@click.command()
@click.pass_context
def portable(ctx: click.Context) -> None:
    """Dump editable scripts into the workspace for pip-free usage."""
    from ..workspace import find_workspace
    carta_root = find_workspace()

    copy_portable(carta_root)
    click.echo(f"Dumped portable scripts ({__version__}) into {carta_root}/")
    click.echo(f"  Entry point: {carta_root / 'carta.py'}")
    click.echo(f"  Modules:     {carta_root / '_scripts/'}")
    click.echo(f"  Usage:       python3 {carta_root / 'carta.py'} <command>")
    click.echo(f"\nThese are your scripts — edit freely.")
