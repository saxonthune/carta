"""rhidoc — setup commands: init, portable, and supporting infrastructure."""
import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from ..__version__ import __version__
from ..workspace import MARKER, find_workspace
from ..regenerate_core import do_regenerate
from ..templates import HANDBOOK_DIR, Kind, by_kind, data_files, listed, render


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
    "templates/__init__.py",
]

_DATA_FILES = ["manifest-preamble.md", *data_files()]


def _skill_contents(dir_name: str) -> list[tuple[str, str]]:
    """(skill_name, SKILL.md content) for every skill template, in registry order."""
    from ..ai_skill import generate_skill_content

    out: list[tuple[str, str]] = []
    for tmpl in by_kind(Kind.SKILL):
        content = (generate_skill_content(dir_name) if tmpl.name == "rhidoc-cli"
                   else render(tmpl.name, dir_name=dir_name))
        out.append((tmpl.name, content))
    return out


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class InitArgs:
    name: str | None
    dirname: str
    portable: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(name=ns.name, dirname=ns.dirname, portable=ns.portable)


def cmd_init(args: argparse.Namespace) -> None:
    """Initialize a new workspace in the current directory."""
    a = InitArgs.from_namespace(args)
    project_root = Path.cwd().resolve()
    dirname = a.dirname
    marker_path = project_root / MARKER
    rhidoc_dir = project_root / dirname

    if marker_path.exists():
        print(f"Workspace already exists: {marker_path}")
        print("Run `rhidoc init --rehydrate` to refresh handbook docs and skill files.")
        return

    title = a.name or project_root.name

    handbook_dir = rhidoc_dir / HANDBOOK_DIR
    handbook_dir.mkdir(parents=True, exist_ok=True)

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

    # --- Handbook docs ---
    for tmpl in by_kind(Kind.HANDBOOK):
        content = render(tmpl.name, dir_name=dirname, title=title)
        (handbook_dir / tmpl.filename).write_text(content, encoding="utf-8")

    (rhidoc_dir / "MANIFEST.md").write_text(
        f"# {dirname}/ Manifest\n\nMachine-readable index for AI navigation. "
        "Run `rhidoc regenerate` to populate.\n",
        encoding="utf-8",
    )

    # --- Agent wiring (generated; refreshed by --rehydrate) ---
    (rhidoc_dir / "AGENTS.md").write_text(render("agents", dir_name=dirname), encoding="utf-8")

    # --- Skills ---
    for skill_name, content in _skill_contents(dirname):
        skill_dir = project_root / ".claude" / "skills" / skill_name
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_path = skill_dir / "SKILL.md"
        if skill_path.exists():
            print(f"  Skipped:  .claude/skills/{skill_name}/SKILL.md (already exists)")
            continue
        skill_path.write_text(content, encoding="utf-8")
        print(f"  Hydrated: .claude/skills/{skill_name}/SKILL.md")

    do_regenerate(rhidoc_dir, _load_preamble(rhidoc_dir.name))

    print(f"\nInitialized {dirname}/ workspace: {title}")
    print(f"  Created:  {MARKER}")
    print(f"  Created:  {dirname}/{HANDBOOK_DIR}/ (7 docs)")
    print(f"  Created:  {dirname}/MANIFEST.md")
    print(f"  Created:  {dirname}/AGENTS.md")

    if a.portable:
        if copy_portable(rhidoc_dir):
            print(f"  Dumped:   portable scripts into {dirname}/")
            print(f"  Usage:    python3 {dirname}/rhidoc.py <command>")
        else:
            print("  Warning: failed to copy portable scripts.", file=sys.stderr)

    print(f"\nNext steps:")
    print(f"  rhidoc make {HANDBOOK_DIR} my-first-doc  # add a document")
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


@dataclass(frozen=True)
class InitRehydrateArgs:
    dry_run: bool
    check: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(dry_run=ns.dry_run, check=ns.check)


def cmd_init_rehydrate(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Refresh handbook docs and skill files from the installed rhidoc version."""
    a = InitRehydrateArgs.from_namespace(args)
    project_root = rhidoc_root.parent
    dirname = rhidoc_root.name
    marker_path = project_root / MARKER

    if not marker_path.exists():
        print(f"No workspace found at {marker_path}")
        return

    config = json.loads(marker_path.read_text(encoding="utf-8"))
    title = config.get("title", project_root.name)
    handbook_dir = rhidoc_root / HANDBOOK_DIR

    check = a.check
    no_write = a.dry_run or check

    updated = 0
    skipped = 0

    # --- Handbook docs ---
    for tmpl in by_kind(Kind.HANDBOOK):
        if not tmpl.rehydrate:
            continue
        filename = tmpl.filename
        dest = handbook_dir / filename
        new_content = render(tmpl.name, dir_name=dirname, title=title)

        # A handbook doc from an older rhidoc may occupy this template's prefix
        # under a different name; two .md roots at one prefix break resolution.
        if handbook_dir.exists():
            prefix = filename[:3]
            for stale in sorted(handbook_dir.glob(f"{prefix}*.md")):
                if stale.name == filename:
                    continue
                if no_write:
                    print(f"  Drift: {stale.relative_to(project_root)} (stale handbook doc)" if check
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
            handbook_dir.mkdir(parents=True, exist_ok=True)
            dest.write_text(new_content, encoding="utf-8")
            print(f"  Updated: {dest.relative_to(project_root)}")
        updated += 1

    # --- Agent wiring ---
    agents_dest = rhidoc_root / "AGENTS.md"
    agents_content = render("agents", dir_name=dirname)
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
    for skill_name, new_content in _skill_contents(dirname):
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

    verb = "Would update" if a.dry_run else "Updated"
    print(f"\n{verb} {updated} file(s), {skipped} already current.")


def cmd_portable(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Dump editable scripts into the workspace for pip-free usage."""
    copy_portable(rhidoc_root)
    print(f"Dumped portable scripts ({__version__}) into {rhidoc_root}/")
    print(f"  Entry point: {rhidoc_root / 'rhidoc.py'}")
    print(f"  Modules:     {rhidoc_root / '_scripts/'}")
    print(f"  Usage:       python3 {rhidoc_root / 'rhidoc.py'} <command>")
    print(f"\nThese are your scripts — edit freely.")


# ---------------------------------------------------------------------------
# handbook
# ---------------------------------------------------------------------------

def _handbook_placeholders() -> tuple[str, str]:
    """(dir_name, title) from the workspace if there is one, else defaults.

    `handbook` must work in a repo with no workspace — that is the point of the
    command — so a missing marker is a default, not an error.
    """
    try:
        rhidoc_root = find_workspace()
    except FileNotFoundError:
        return ".rhidoc", Path.cwd().resolve().name

    marker_path = rhidoc_root.parent / MARKER
    config = json.loads(marker_path.read_text(encoding="utf-8"))
    return rhidoc_root.name, config.get("title", rhidoc_root.parent.name)


def handbook_listing() -> str:
    """The name/summary table shown by `rhidoc handbook` and `rhidoc handbook -h`."""
    rows = [(t.name, t.kind.value, t.summary) for t in listed()]
    width = max(len(name) for name, _, _ in rows)
    lines = ["Handbook docs (print one with `rhidoc handbook <name>`):", ""]
    for name, kind, summary in rows:
        lines.append(f"  {name:<{width}}  [{kind}] {summary}")
    return "\n".join(lines)


def cmd_handbook(args: argparse.Namespace) -> None:
    """List the handbook docs, or print one to stdout. Needs no workspace."""
    if args.name is None:
        print(handbook_listing())
        return

    dir_name, title = _handbook_placeholders()
    print(render(args.name, dir_name=dir_name, title=title), end="")
