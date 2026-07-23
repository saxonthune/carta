"""rhidoc — setup commands: init, portable, and supporting infrastructure."""
import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from ..__version__ import __version__
from ..workspace import MARKER, find_workspace
from ..errors import RhidocError
from ..regenerate_core import do_regenerate
from ..templates import (HANDBOOK_DIR, TEMPLATES_VERSION, USER_SLOT, Kind,
                         by_kind, data_files, listed, render)


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
# What rhidoc installs
#
# `init` records every file it writes in the marker's `installed.files`. `update`
# reconciles against that record: a path rhidoc installed but no longer ships is
# removed, and a path rhidoc never installed is never touched. Ownership is a fact
# we wrote down, not a guess from the filesystem — which is what let an old section
# (00-codex/) survive a rename, and let a hand-written skill get overwritten.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Hydrated:
    path: Path
    content: str
    # False for generated artifacts (00-index bodies are rewritten by regenerate):
    # still rhidoc's to remove, but its content is not ours to refresh.
    refresh: bool = True


def _hydrated_files(project_root: Path, rhidoc_root: Path, title: str) -> list[Hydrated]:
    dir_name = rhidoc_root.name
    handbook_dir = rhidoc_root / HANDBOOK_DIR

    out = [
        Hydrated(handbook_dir / t.filename,
                 render(t.name, dir_name=dir_name, title=title),
                 refresh=t.rehydrate)
        for t in by_kind(Kind.HANDBOOK)
    ]
    out.append(Hydrated(rhidoc_root / "AGENTS.md", render("agents", dir_name=dir_name)))
    out += [
        Hydrated(project_root / ".claude" / "skills" / name / "SKILL.md", content)
        for name, content in _skill_contents(dir_name)
    ]
    return out


def _rel(path: Path, project_root: Path) -> str:
    return path.relative_to(project_root).as_posix()


def _record_installed(config: dict, files: list[str]) -> None:
    config["installed"] = {"templatesVersion": TEMPLATES_VERSION, "files": sorted(files)}


# Artifacts shipped by rhidoc versions predating the installed-files record. Used only
# to *report* leftovers on a legacy workspace's first `update` — never to delete, since
# without a record we cannot prove rhidoc wrote them rather than the user.
_LEGACY_ARTIFACTS = ["00-codex"]


def _make_user_slot(handbook_dir: Path) -> None:
    """Create the empty group at doc00.07 for the user's own doctrine.

    Deliberately absent from `installed.files`: rhidoc scaffolds it once and never
    manages it. Reserving a fixed slot is what stops a future shipped doc from
    colliding with a user's doc at the same prefix — two .md roots at one prefix
    break ref resolution. The ownership rule itself is stated in AGENTS.md, because
    regenerate rewrites every 00-index body and would erase it from here.
    """
    slot = handbook_dir / USER_SLOT
    if slot.exists():
        return
    slot.mkdir(parents=True, exist_ok=True)
    (slot / "00-index.md").write_text(
        "---\ntitle: User Handbook\nsummary: \"\"\ntags: []\ndeps: []\n---\n\n# User Handbook\n",
        encoding="utf-8",
    )


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
        print("Run `rhidoc update` to refresh handbook docs and skill files.")
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

    # A file already at one of our paths is the user's, not ours: write it, or leave it
    # alone forever. Claiming only what we actually wrote is what keeps `update` safe.
    installed: list[str] = []
    for h in _hydrated_files(project_root, rhidoc_dir, title):
        rel = _rel(h.path, project_root)
        if h.path.exists():
            print(f"  Skipped:  {rel} (already exists — left unmanaged)")
            continue
        h.path.parent.mkdir(parents=True, exist_ok=True)
        h.path.write_text(h.content, encoding="utf-8")
        installed.append(rel)

    _record_installed(marker_content, installed)
    marker_path.write_text(json.dumps(marker_content, indent=2) + "\n", encoding="utf-8")

    # --- The user's own slot: created once, never managed (see USER_SLOT) ---
    _make_user_slot(handbook_dir)

    (rhidoc_dir / "MANIFEST.md").write_text(
        f"# {dirname}/ Manifest\n\nMachine-readable index for AI navigation. "
        "Run `rhidoc regenerate` to populate.\n",
        encoding="utf-8",
    )

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

    print(f"\nOptional — paste into your CLAUDE.md or AGENTS.md so agents find the workspace")
    print(f"(reprint any time with `rhidoc handbook wiring`):")
    print()
    for line in render("wiring", dir_name=dirname).rstrip().splitlines():
        print(f"  {line}" if line else "")


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
class UpdateArgs:
    dry_run: bool
    check: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(dry_run=ns.dry_run, check=ns.check)


def cmd_update(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Bring hydrated files to the installed rhidoc version, from the installed-files record."""
    a = UpdateArgs.from_namespace(args)
    project_root = rhidoc_root.parent
    marker_path = project_root / MARKER

    if not marker_path.exists():
        raise RhidocError(f"No workspace found at {marker_path}\n"
                          "Hint: run `rhidoc init` to scaffold one.")

    config = json.loads(marker_path.read_text(encoding="utf-8"))
    title = config.get("title", project_root.name)
    record = config.get("installed")
    previous: set[str] | None = set(record["files"]) if record else None

    check = a.check
    no_write = a.dry_run or check
    updated = 0
    skipped = 0

    def report(verb: str, rel: str) -> None:
        print(f"  {'Drift' if check else 'Would ' + verb.lower() if no_write else verb}: {rel}")

    desired = _hydrated_files(project_root, rhidoc_root, title)

    # Removals: we installed it, we no longer ship it. Provably ours, so safe to delete.
    if previous is not None:
        for rel in sorted(previous - {_rel(h.path, project_root) for h in desired}):
            stale = project_root / rel
            if not stale.exists():
                continue
            report("Removed", rel)
            if not no_write:
                stale.unlink()
            updated += 1

    owned: list[str] = []
    for h in desired:
        rel = _rel(h.path, project_root)
        exists = h.path.exists()

        # Present but never installed by us — the user's file at our path. Never claim it.
        if exists and previous is not None and rel not in previous:
            print(f"  Unmanaged: {rel} (not installed by rhidoc — left alone)")
            skipped += 1
            continue

        owned.append(rel)
        if exists and not h.refresh:
            skipped += 1
            continue
        if exists and h.path.read_text(encoding="utf-8") == h.content:
            skipped += 1
            continue

        report("Updated", rel)
        if not no_write:
            h.path.parent.mkdir(parents=True, exist_ok=True)
            h.path.write_text(h.content, encoding="utf-8")
        updated += 1

    if previous is None:
        _report_legacy(rhidoc_root, project_root)

    if not no_write:
        # Scaffold-if-absent, so the reservation is real in workspaces that predate it.
        # Not a managed file: never overwritten, and absent from installed.files.
        _make_user_slot(rhidoc_root / HANDBOOK_DIR)
        _record_installed(config, owned)
        marker_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    if check:
        if updated:
            print(f"\n{updated} hydrated file(s) stale, {skipped} current. "
                  f"Run `rhidoc update` to refresh.")
            sys.exit(1)
        print(f"\nAll {skipped} hydrated file(s) current.")
        return

    verb = "Would update" if a.dry_run else "Updated"
    print(f"\n{verb} {updated} file(s), {skipped} already current.")


def _report_legacy(rhidoc_root: Path, project_root: Path) -> None:
    """Name leftovers from pre-record rhidoc versions. Reports only — never deletes."""
    found = [name for name in _LEGACY_ARTIFACTS if (rhidoc_root / name).exists()]
    if not found:
        return
    print()
    for name in found:
        print(f"  Leftover: {rhidoc_root.name}/{name}/ — shipped by an older rhidoc and "
              f"no longer part of the handbook.")
    print("  Move anything you wrote out of it, then remove it by hand. Rhidoc will not")
    print("  delete it: without an installed-files record it cannot prove the files are its own.")


def cmd_portable(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Dump editable scripts into the workspace for pip-free usage."""
    copy_portable(rhidoc_root)
    print(f"Dumped portable scripts ({__version__}) into {rhidoc_root}/")
    print(f"  Entry point: {rhidoc_root / 'rhidoc.py'}")
    print(f"  Modules:     {rhidoc_root / '_scripts/'}")
    print(f"  Usage:       python3 {rhidoc_root / 'rhidoc.py'} <command>")
    print(f"\nThese are your scripts — edit freely.")


def cmd_version(args: argparse.Namespace) -> None:
    """Print the CLI version and the templates version this rhidoc ships.

    Works with no workspace. Inside one, also report the version recorded in the marker
    and flag drift from what this rhidoc ships.
    """
    print(f"rhidoc {__version__}")
    print(f"templates {TEMPLATES_VERSION}")

    try:
        rhidoc_root = args.workspace.resolve() if args.workspace else find_workspace()
    except FileNotFoundError:
        return
    marker_path = rhidoc_root.parent / MARKER
    if not marker_path.exists():
        return
    recorded = (json.loads(marker_path.read_text(encoding="utf-8")).get("installed") or {}).get("templatesVersion")
    if recorded is not None and str(recorded) != str(TEMPLATES_VERSION):
        print(f"workspace templates {recorded} (run `rhidoc update` to refresh)")


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
