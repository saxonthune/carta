"""rhidoc — setup commands: init, portable, and supporting infrastructure."""
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
    "bundle.py",
    "docref.py",
    "rewriter.py",
    "planning.py",
    "workspace.py",
    "__version__.py",
    "regenerate_core.py",
    "ai_skill.py",
    "errors.py",
    "_glyphs.py",
    "commands/__init__.py",
    "commands/_parser.py",
    "commands/structure.py",
    "commands/transform.py",
    "commands/content.py",
    "commands/setup.py",
    "commands/mdapi.py",
    "mdtree.py",
    "mdlint.py",
]

_DATA_FILES = [
    "manifest-preamble.md",
    "templates/00-index.md",
    "templates/01-about.md",
    "templates/02-maintenance.md",
    "templates/03-conventions.md",
    "templates/04-plain-language.md",
    "templates/05-controlled-vocabulary.md",
    "templates/06-drift.md",
    "templates/AGENTS.md",
    "templates/skill.md",
    "templates/docs-development-skill.md",
    "templates/rhidoc-setup-skill.md",
]


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------

def cmd_init(args: argparse.Namespace) -> None:
    """Initialize a new workspace in the current directory."""
    project_root = Path.cwd().resolve()
    dirname = args.dirname
    marker_path = project_root / MARKER
    rhidoc_dir = project_root / dirname

    if marker_path.exists():
        print(f"Workspace already exists: {marker_path}")
        print("Run `rhidoc init --rehydrate` to refresh codex templates and skill files.")
        return

    title = args.name or project_root.name

    codex_dir = rhidoc_dir / "00-codex"
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

    # --- Codex docs ---
    templates_dir = _PACKAGE_DIR / "templates"
    codex_templates = [
        ("00-index.md", "{{title}}", title),
        ("01-about.md", "{{title}}", title),
        ("02-maintenance.md", "{{dir_name}}", dirname),
        ("03-conventions.md", "{{dir_name}}", dirname),
        ("04-plain-language.md", None, None),
        ("05-controlled-vocabulary.md", None, None),
        ("06-drift.md", None, None),
    ]
    for filename, placeholder, value in codex_templates:
        content = (templates_dir / filename).read_text(encoding="utf-8")
        if placeholder:
            assert value is not None
            content = content.replace(placeholder, value)
        (codex_dir / filename).write_text(content, encoding="utf-8")

    (rhidoc_dir / "MANIFEST.md").write_text(
        f"# {dirname}/ Manifest\n\nMachine-readable index for AI navigation. "
        "Run `rhidoc regenerate` to populate.\n",
        encoding="utf-8",
    )

    # --- Agent wiring (generated; refreshed by --rehydrate) ---
    agents_content = (templates_dir / "AGENTS.md").read_text(encoding="utf-8")
    agents_content = agents_content.replace("{{dir_name}}", dirname)
    (rhidoc_dir / "AGENTS.md").write_text(agents_content, encoding="utf-8")

    # --- Skills ---
    def _install_skill(skill_name: str, template_file: str, replacements: dict[str, str] | None = None) -> None:
        skill_dir = project_root / ".claude" / "skills" / skill_name
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_path = skill_dir / "SKILL.md"
        if not skill_path.exists():
            content = (templates_dir / template_file).read_text(encoding="utf-8")
            for placeholder, value in (replacements or {}).items():
                content = content.replace(placeholder, value)
            skill_path.write_text(content, encoding="utf-8")
            print(f"  Hydrated: .claude/skills/{skill_name}/SKILL.md")
        else:
            print(f"  Skipped:  .claude/skills/{skill_name}/SKILL.md (already exists)")

    from ..ai_skill import generate_skill_content
    skill_dir = project_root / ".claude" / "skills" / "rhidoc-cli"
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_path = skill_dir / "SKILL.md"
    if not skill_path.exists():
        skill_path.write_text(generate_skill_content(dirname), encoding="utf-8")
        print(f"  Hydrated: .claude/skills/rhidoc-cli/SKILL.md")
    else:
        print(f"  Skipped:  .claude/skills/rhidoc-cli/SKILL.md (already exists)")
    _install_skill("docs-development", "docs-development-skill.md")
    _install_skill("rhidoc-setup", "rhidoc-setup-skill.md")

    do_regenerate(rhidoc_dir, _load_preamble(rhidoc_dir.name))

    print(f"\nInitialized {dirname}/ workspace: {title}")
    print(f"  Created:  {MARKER}")
    print(f"  Created:  {dirname}/00-codex/ (7 docs)")
    print(f"  Created:  {dirname}/MANIFEST.md")
    print(f"  Created:  {dirname}/AGENTS.md")

    if args.portable:
        if copy_portable(rhidoc_dir):
            print(f"  Dumped:   portable scripts into {dirname}/")
            print(f"  Usage:    python3 {dirname}/rhidoc.py <command>")
        else:
            print("  Warning: failed to copy portable scripts.", file=sys.stderr)

    print(f"\nNext steps:")
    print(f"  rhidoc create 00-codex my-first-doc   # add a document")
    print(f"  rhidoc --help                          # see all commands")
    print(f"  /rhidoc-setup                          # verify wiring & workspace health")

    print(f"\nOptional — paste into your CLAUDE.md or AGENTS.md so agents find the workspace:")
    print(f"")
    print(f"  ## Documentation")
    print(f"  This repo uses a {dirname}/ spec workspace. Read {dirname}/AGENTS.md for")
    print(f"  how to navigate and edit it, and {dirname}/MANIFEST.md for the doc index.")


# ---------------------------------------------------------------------------
# portable
# ---------------------------------------------------------------------------

def copy_portable(rhidoc_root: Path) -> bool:
    """Copy portable scripts into rhidoc_root/_scripts/. Returns True on success."""
    scripts_dir = rhidoc_root / "_scripts"
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

    shim = _PACKAGE_DIR / "portable" / "rhidoc_main.py"
    (rhidoc_root / "rhidoc.py").write_bytes(shim.read_bytes())

    marker_path = rhidoc_root.parent / MARKER
    if marker_path.exists():
        config = json.loads(marker_path.read_text(encoding="utf-8"))
        root_prefix = config.get("root", ".rhidoc/")
        config["portable"] = f"{root_prefix}rhidoc.py"
        marker_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    return True


def cmd_init_rehydrate(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Refresh codex templates and skill files from the installed rhidoc version."""
    project_root = rhidoc_root.parent
    dirname = rhidoc_root.name
    marker_path = project_root / MARKER

    if not marker_path.exists():
        print(f"No workspace found at {marker_path}")
        return

    config = json.loads(marker_path.read_text(encoding="utf-8"))
    title = config.get("title", project_root.name)
    templates_dir = _PACKAGE_DIR / "templates"
    codex_dir = rhidoc_root / "00-codex"

    check = getattr(args, "check", False)
    no_write = args.dry_run or check

    updated = 0
    skipped = 0

    # --- Codex docs ---
    # 00-index.md is a generated artifact (body rewritten by regenerate) — skip it in rehydrate.
    codex_templates = [
        ("01-about.md", "{{title}}", title),
        ("02-maintenance.md", "{{dir_name}}", dirname),
        ("03-conventions.md", "{{dir_name}}", dirname),
        ("04-plain-language.md", None, None),
        ("05-controlled-vocabulary.md", None, None),
        ("06-drift.md", None, None),
    ]
    for filename, placeholder, value in codex_templates:
        dest = codex_dir / filename
        new_content = (templates_dir / filename).read_text(encoding="utf-8")
        if placeholder:
            assert value is not None
            new_content = new_content.replace(placeholder, value)

        # A codex doc from an older rhidoc may occupy this template's prefix
        # under a different name; two .md roots at one prefix break resolution.
        if codex_dir.exists():
            prefix = filename[:3]
            for stale in sorted(codex_dir.glob(f"{prefix}*.md")):
                if stale.name == filename:
                    continue
                if no_write:
                    print(f"  Drift: {stale.relative_to(project_root)} (stale codex doc)" if check
                          else f"  Would remove: {stale.relative_to(project_root)}")
                else:
                    stale.unlink()
                    print(f"  Removed stale: {stale.relative_to(project_root)}")
                updated += 1

        if dest.exists():
            old_content = dest.read_text(encoding="utf-8")
            if old_content == new_content:
                skipped += 1
                continue

        if no_write:
            print(f"  Drift: {dest.relative_to(project_root)}" if check
                  else f"  Would update: {dest.relative_to(project_root)}")
        else:
            codex_dir.mkdir(parents=True, exist_ok=True)
            dest.write_text(new_content, encoding="utf-8")
            print(f"  Updated: {dest.relative_to(project_root)}")
        updated += 1

    # --- Agent wiring ---
    agents_dest = rhidoc_root / "AGENTS.md"
    agents_content = (templates_dir / "AGENTS.md").read_text(encoding="utf-8").replace("{{dir_name}}", dirname)
    if not (agents_dest.exists() and agents_dest.read_text(encoding="utf-8") == agents_content):
        if no_write:
            print(f"  Drift: {agents_dest.relative_to(project_root)}" if check
                  else f"  Would update: {agents_dest.relative_to(project_root)}")
        else:
            agents_dest.write_text(agents_content, encoding="utf-8")
            print(f"  Updated: {agents_dest.relative_to(project_root)}")
        updated += 1
    else:
        skipped += 1

    # --- Skills ---
    from ..ai_skill import generate_skill_content
    skill_updates = [
        ("rhidoc-cli", generate_skill_content(dirname)),
        ("docs-development", (templates_dir / "docs-development-skill.md").read_text(encoding="utf-8")),
        ("rhidoc-setup", (templates_dir / "rhidoc-setup-skill.md").read_text(encoding="utf-8")),
    ]
    for skill_name, new_content in skill_updates:
        skill_dir = project_root / ".claude" / "skills" / skill_name
        skill_path = skill_dir / "SKILL.md"

        if skill_path.exists():
            old_content = skill_path.read_text(encoding="utf-8")
            if old_content == new_content:
                skipped += 1
                continue

        if no_write:
            print(f"  Drift: {skill_path.relative_to(project_root)}" if check
                  else f"  Would update: {skill_path.relative_to(project_root)}")
        else:
            skill_dir.mkdir(parents=True, exist_ok=True)
            skill_path.write_text(new_content, encoding="utf-8")
            print(f"  Updated: {skill_path.relative_to(project_root)}")
        updated += 1

    if check:
        if updated:
            print(f"\n{updated} hydrated file(s) stale, {skipped} current. "
                  f"Run `rhidoc init --rehydrate` to refresh.")
            sys.exit(1)
        print(f"\nAll {skipped} hydrated file(s) current.")
        return

    verb = "Would update" if args.dry_run else "Updated"
    print(f"\n{verb} {updated} file(s), {skipped} already current.")


def cmd_portable(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Dump editable scripts into the workspace for pip-free usage."""
    copy_portable(rhidoc_root)
    print(f"Dumped portable scripts ({__version__}) into {rhidoc_root}/")
    print(f"  Entry point: {rhidoc_root / 'rhidoc.py'}")
    print(f"  Modules:     {rhidoc_root / '_scripts/'}")
    print(f"  Usage:       python3 {rhidoc_root / 'rhidoc.py'} <command>")
    print(f"\nThese are your scripts — edit freely.")
