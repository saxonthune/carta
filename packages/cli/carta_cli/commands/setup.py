"""carta — setup commands: init, portable, and supporting infrastructure."""
import argparse
import json
import sys
from pathlib import Path

from ..__version__ import __version__
from ..workspace import MARKER
from ..regenerate_core import do_regenerate


_PACKAGE_DIR = Path(__file__).resolve().parent.parent


def _load_preamble(dir_name: str) -> str:
    """Read manifest-preamble.md from the package directory and substitute {{dir_name}}."""
    preamble_path = _PACKAGE_DIR / "manifest-preamble.md"
    preamble = preamble_path.read_text(encoding="utf-8")
    return preamble.replace("{{dir_name}}", dir_name)


# ---------------------------------------------------------------------------
# Library modules / data files for copy_portable
# ---------------------------------------------------------------------------

_LIBRARY_MODULES = [
    "frontmatter.py",
    "entries.py",
    "numbering.py",
    "ref_convert.py",
    "rewriter.py",
    "planning.py",
    "workspace.py",
    "__version__.py",
    "regenerate_core.py",
    "ai_skill.py",
    "errors.py",
    "commands/__init__.py",
    "commands/_parser.py",
    "commands/structure.py",
    "commands/transform.py",
    "commands/content.py",
    "commands/setup.py",
]

_DATA_FILES = [
    "manifest-preamble.md",
    "templates/00-index.md",
    "templates/skill.md",
]


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------

def cmd_init(args: argparse.Namespace) -> None:
    """Initialize a new workspace in the current directory."""
    project_root = Path.cwd().resolve()
    dirname = args.dirname
    marker_path = project_root / MARKER
    carta_dir = project_root / dirname

    if marker_path.exists():
        print(f"Workspace already exists: {marker_path}")
        print("Use other carta commands to modify the existing workspace.")
        return

    title = args.name or project_root.name

    codex_dir = carta_dir / "00-codex"
    codex_dir.mkdir(parents=True, exist_ok=True)

    marker_content = {
        "root": f"{dirname}/",
        "title": title,
        "description": "",
        "externalRefPaths": [
            "CLAUDE.md",
            ".claude/skills/**/*.md",
            ".cursor/**/*.md",
        ],
    }
    marker_path.write_text(json.dumps(marker_content, indent=2) + "\n", encoding="utf-8")

    index_content = (_PACKAGE_DIR / "templates" / "00-index.md").read_text(encoding="utf-8").replace("{{title}}", title)
    (codex_dir / "00-index.md").write_text(index_content, encoding="utf-8")

    (carta_dir / "MANIFEST.md").write_text(
        f"# {dirname}/ Manifest\n\nMachine-readable index for AI navigation. "
        "Run `carta regenerate` to populate.\n",
        encoding="utf-8",
    )

    skill_dir = project_root / ".claude" / "skills" / "carta-cli"
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_path = skill_dir / "SKILL.md"
    if not skill_path.exists():
        skill_content = (_PACKAGE_DIR / "templates" / "skill.md").read_text(encoding="utf-8").replace("{{dir_name}}", dirname)
        skill_path.write_text(skill_content, encoding="utf-8")
        print(f"  Hydrated: .claude/skills/carta-cli/SKILL.md")
    else:
        print(f"  Skipped:  .claude/skills/carta-cli/SKILL.md (already exists)")

    do_regenerate(carta_dir, _load_preamble(carta_dir.name))

    print(f"\nInitialized {dirname}/ workspace: {title}")
    print(f"  Created:  {MARKER}")
    print(f"  Created:  {dirname}/00-codex/00-index.md")
    print(f"  Created:  {dirname}/MANIFEST.md")

    if args.portable:
        if copy_portable(carta_dir):
            print(f"  Dumped:   portable scripts into {dirname}/")
            print(f"  Usage:    python3 {dirname}/carta.py <command>")
        else:
            print("  Warning: failed to copy portable scripts.", file=sys.stderr)

    print(f"\nNext steps:")
    print(f"  carta create 00-codex my-first-doc   # add a document")
    print(f"  carta --help                          # see all commands")


# ---------------------------------------------------------------------------
# portable
# ---------------------------------------------------------------------------

def copy_portable(carta_root: Path) -> bool:
    """Copy portable scripts into carta_root/_scripts/. Returns True on success."""
    scripts_dir = carta_root / "_scripts"
    scripts_dir.mkdir(exist_ok=True)
    (scripts_dir / "__init__.py").write_text("", encoding="utf-8")

    for module in _LIBRARY_MODULES:
        src = _PACKAGE_DIR / module
        dest = scripts_dir / module
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(src.read_bytes())

    for data_file in _DATA_FILES:
        src = _PACKAGE_DIR / data_file
        dest = scripts_dir / data_file
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(src.read_bytes())

    shim = _PACKAGE_DIR / "portable" / "carta_main.py"
    (carta_root / "carta.py").write_bytes(shim.read_bytes())

    marker_path = carta_root.parent / MARKER
    if marker_path.exists():
        config = json.loads(marker_path.read_text(encoding="utf-8"))
        root_prefix = config.get("root", ".carta/")
        config["portable"] = f"{root_prefix}carta.py"
        marker_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    return True


def cmd_portable(args: argparse.Namespace, carta_root: Path) -> None:
    """Dump editable scripts into the workspace for pip-free usage."""
    copy_portable(carta_root)
    print(f"Dumped portable scripts ({__version__}) into {carta_root}/")
    print(f"  Entry point: {carta_root / 'carta.py'}")
    print(f"  Modules:     {carta_root / '_scripts/'}")
    print(f"  Usage:       python3 {carta_root / 'carta.py'} <command>")
    print(f"\nThese are your scripts — edit freely.")
