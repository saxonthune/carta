"""carta — workspace tools for managing documentation structure."""
import argparse
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

from .__version__ import __version__
from .frontmatter import read_frontmatter, write_frontmatter
from .entries import resolve_arg, resolve_and_validate, list_numbered_entries, display_path
from .numbering import get_numeric_prefix, get_slug, compute_insertion_prefix
from .ref_convert import path_to_ref
from .rewriter import rewrite_refs
from .planning import compute_all_moves, compute_rename_map, print_rename_map
from .workspace import find_workspace, load_workspace, get_external_ref_paths, collect_rewritable_files, MARKER
from .regenerate_core import do_regenerate
from .ai_skill import cmd_ai_skill
from .errors import CartaError

_MODULE_DIR = Path(__file__).resolve().parent


def _load_preamble(dir_name: str) -> str:
    """Read manifest-preamble.md from the package directory and substitute {{dir_name}}."""
    preamble_path = _MODULE_DIR / "manifest-preamble.md"
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
    "manifest.py",
    "workspace.py",
    "__version__.py",
    "regenerate_core.py",
    "commands.py",
    "ai_skill.py",
    "errors.py",
]

_DATA_FILES = [
    "manifest-preamble.md",
    "templates/00-index.md",
    "templates/skill.md",
]


# ---------------------------------------------------------------------------
# cat
# ---------------------------------------------------------------------------

def cmd_cat(args: argparse.Namespace, carta_root: Path) -> None:
    """Print document contents to stdout."""
    target = resolve_arg(args.ref, carta_root)
    if target.is_dir():
        target = target / "00-index.md"
    if not target.exists():
        raise CartaError(f"Error: {target} does not exist")
    sys.stdout.write(target.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# regenerate
# ---------------------------------------------------------------------------

def cmd_regenerate(args: argparse.Namespace, carta_root: Path) -> None:
    """Rebuild MANIFEST.md from doc frontmatter."""
    preamble = _load_preamble(carta_root.name)
    do_regenerate(carta_root, preamble, dry_run=args.dry_run)


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

def cmd_create(args: argparse.Namespace, carta_root: Path) -> None:
    """Create a new doc entry."""
    slug = args.slug

    if re.match(r'^\d{2}-', slug):
        raise CartaError("Error: slug must not contain a numeric prefix (NN-). Provide just the slug part.")

    if args.order is not None and args.order < 1:
        raise CartaError("Error: --order must be >= 1 (position 0 is reserved for index files).")

    try:
        dest_path = resolve_arg(args.destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        raise CartaError(f"Error resolving destination {args.destination!r}: {e}")

    if not dest_path.exists():
        raise CartaError(f"Error: destination does not exist: {dest_path}")

    if not dest_path.is_dir():
        raise CartaError(f"Error: destination is not a directory: {dest_path}")

    prefix = compute_insertion_prefix(list_numbered_entries(dest_path), args.order)

    entries = list_numbered_entries(dest_path)
    occupied = {get_numeric_prefix(e.name) for e in entries}
    if prefix in occupied:
        raise CartaError(
            f"Error: position {prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
            f"Occupied positions: {sorted(occupied)}"
        )

    title = args.title if args.title is not None else slug.replace("-", " ").title()
    new_name = f"{prefix:02d}-{slug}.md"
    new_path = dest_path / new_name

    if args.dry_run:
        print(f"Would create: {new_path.relative_to(carta_root)}")
        print(f"  Title: {title}")
        print(f"  Position: {prefix:02d}")
        print("\n(dry-run: no files created)")
        return

    frontmatter = {
        "title": title,
        "status": "draft",
        "summary": "",
        "tags": [],
        "deps": [],
    }
    write_frontmatter(new_path, frontmatter, f"\n# {title}\n")

    do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Created: {new_path.relative_to(carta_root)}")
    print(f"  Title: {title}")
    print(f"  Position: {prefix:02d}")


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

def _collect_refs_under(path: Path, carta_root: Path) -> set[str]:
    refs: set[str] = set()
    try:
        refs.add(path_to_ref(path, carta_root))
    except ValueError:
        pass
    if path.is_dir():
        for child in path.rglob("*"):
            try:
                refs.add(path_to_ref(child, carta_root))
            except ValueError:
                pass
    return refs


def _is_under(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _find_orphaned_refs(
    md_files: list[Path], deleted_refs: set[str]
) -> list[tuple[Path, str, str]]:
    """Scan md files for references to deleted refs.

    Returns (file_path, line_text, ref) triples.
    """
    if not deleted_refs:
        return []

    ref_pattern = re.compile(r'(?<!\w)(doc\d{2}(?:\.\d{2})*)(?!\.[a-zA-Z0-9])')
    orphans: list[tuple[Path, str, str]] = []

    for fpath in md_files:
        try:
            text = fpath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        for m in ref_pattern.finditer(text):
            if m.group(1) in deleted_refs:
                line_start = text.rfind("\n", 0, m.start()) + 1
                line_end = text.find("\n", m.end())
                if line_end == -1:
                    line_end = len(text)
                line_text = text[line_start:line_end].strip()
                orphans.append((fpath, line_text, m.group(1)))

    return orphans


def cmd_delete(args: argparse.Namespace, carta_root: Path) -> None:
    """Delete entries with gap-closing."""
    target_paths: list[Path] = []
    for target in args.targets:
        target_paths.append(resolve_and_validate(target, carta_root))

    deleted_refs: set[str] = set()
    for path in target_paths:
        deleted_refs |= _collect_refs_under(path, carta_root)

    parents: dict[Path, list[Path]] = {}
    for path in target_paths:
        parents.setdefault(path.parent, []).append(path)

    all_moves: list[tuple[Path, Path]] = []
    for parent_dir, deleted_in_parent in parents.items():
        deleted_set = {p.resolve() for p in deleted_in_parent}
        entries = list_numbered_entries(parent_dir)
        remaining = [e for e in entries if e.resolve() not in deleted_set]
        next_prefix = 1
        for entry in remaining:
            current_prefix = get_numeric_prefix(entry.name)
            if current_prefix == 0:
                next_prefix = 1
                continue
            if current_prefix != next_prefix:
                new_name = f"{next_prefix:02d}-{get_slug(entry.name)}"
                all_moves.append((entry, parent_dir / new_name))
            next_prefix += 1

    rename_map = compute_rename_map(all_moves, carta_root)

    md_files = [
        f for f in collect_rewritable_files(carta_root)
        if not any(f.resolve() == tp.resolve() or
                   (tp.is_dir() and _is_under(f, tp))
                   for tp in target_paths)
    ]

    # Scan for orphaned refs (refs pointing to deleted entries that remain in survivors)
    orphaned = _find_orphaned_refs(md_files, deleted_refs)

    if args.dry_run:
        print("=== Planned deletions ===")
        for path in target_paths:
            kind = "directory" if path.is_dir() else "file"
            print(f"  DELETE {kind}: {path.relative_to(carta_root)}")
        if deleted_refs:
            print(f"\nRefs removed ({len(deleted_refs)}):")
            for ref in sorted(deleted_refs):
                print(f"  {ref}")
        if all_moves:
            print(f"\n=== Gap-closing moves ({len(all_moves)}) ===")
            for old, new in all_moves:
                print(f"  {old.relative_to(carta_root)} -> {new.relative_to(carta_root)}")
        if rename_map:
            print(f"\n=== Ref rename map ({len(rename_map)} entries) ===")
            for old_ref, new_ref in sorted(rename_map.items()):
                print(f"  {old_ref} -> {new_ref}")
        if orphaned:
            print(f"\n=== Orphaned ref warnings ({len(orphaned)}) ===")
            for fpath, line, ref in orphaned:
                print(f"  {ref} in {display_path(fpath, carta_root)}: {line[:80]}")
        if args.output_mapping and rename_map:
            print(json.dumps(rename_map, indent=2))
        elif args.output_mapping:
            print("{}")
        print("\n(dry-run: no files modified)")
        return

    for path in target_paths:
        if path.is_dir():
            shutil.rmtree(str(path))
        else:
            path.unlink()

    for old_path, new_path in all_moves:
        if old_path.exists():
            shutil.move(str(old_path), str(new_path))

    rewrite_results = rewrite_refs(collect_rewritable_files(carta_root), rename_map)

    do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Deleted {len(target_paths)} entry(ies):")
    for path in target_paths:
        print(f"  {path.relative_to(carta_root)}")
    if all_moves:
        print(f"Gap-closed: {len(all_moves)} sibling(s) renumbered")
    total_replacements = sum(rewrite_results.values())
    if total_replacements:
        print(f"Refs updated: {total_replacements} replacement(s) across {len(rewrite_results)} file(s)")
    if rename_map:
        print(f"Rename map ({len(rename_map)} entries):")
        for old_ref, new_ref in sorted(rename_map.items()):
            print(f"  {old_ref} -> {new_ref}")

    if orphaned:
        print(f"\nWarning: {len(orphaned)} orphaned ref(s) remain in the workspace:")
        for fpath, line, ref in orphaned:
            print(f"  {ref} in {display_path(fpath, carta_root)}: {line[:80]}")

    if args.output_mapping and rename_map:
        print(json.dumps(rename_map, indent=2))
    elif args.output_mapping:
        print("{}")


# ---------------------------------------------------------------------------
# move
# ---------------------------------------------------------------------------

def _create_index_for_new_dir(dir_path: Path) -> None:
    slug = get_slug(dir_path.name)
    title = slug.replace("-", " ").title()
    write_frontmatter(dir_path / "00-index.md", {
        "title": title, "status": "draft",
        "summary": "", "tags": [], "deps": [],
    }, f"\n# {title}\n")


def cmd_move(args: argparse.Namespace, carta_root: Path) -> None:
    """Move/reorder entries."""
    if args.order is not None and args.order < 1:
        raise CartaError("Error: --order must be >= 1 (position 0 is reserved for index files).")

    source_path = resolve_and_validate(args.source, carta_root)

    if args.rename and source_path.name == "00-index.md":
        raise CartaError("Error: cannot rename 00-index.md files.")

    try:
        dest_path = resolve_arg(args.destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        if not args.mkdir:
            raise CartaError(f"Error resolving destination {args.destination!r}: {e}")
        dest_path = (carta_root / args.destination).resolve()

    mkdir_created = False
    if not dest_path.exists():
        if not args.mkdir:
            raise CartaError(f"Error: destination does not exist: {dest_path}")
        if not dest_path.parent.exists():
            raise CartaError(
                f"Error: parent directory does not exist: {dest_path.parent}\n"
                "--mkdir only creates one level of directory."
            )
        mkdir_created = True
        dest_path.mkdir()
        _create_index_for_new_dir(dest_path)
        if args.dry_run:
            print(f"Would create directory: {dest_path.relative_to(carta_root)}")

    if dest_path.exists() and not dest_path.is_dir():
        raise CartaError(f"Error: destination is not a directory: {dest_path}")

    if not mkdir_created:
        dest_entries = list_numbered_entries(dest_path)
        if len(dest_entries) >= 99:
            raise CartaError(f"Error: destination has >= 99 items: {dest_path}")

    try:
        moves = compute_all_moves(source_path, dest_path, args.order, rename_slug=args.rename)
    except ValueError as e:
        raise CartaError(f"Error computing moves: {e}")

    rename_map = compute_rename_map(moves, carta_root)

    if args.dry_run:
        print_rename_map(rename_map, moves)
        print("\n(dry-run: no files modified)")
        if mkdir_created:
            shutil.rmtree(str(dest_path))
        return

    for old_path, new_path in moves:
        if old_path.exists():
            shutil.move(str(old_path), str(new_path))

    rewrite_results = rewrite_refs(collect_rewritable_files(carta_root), rename_map)

    if not args.no_regen:
        do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Moved {len(moves)} item(s):")
    for old, new in moves:
        print(f"  {old.name} -> {new}")
    total_replacements = sum(rewrite_results.values())
    print(f"Refs updated: {total_replacements} replacement(s) across {len(rewrite_results)} file(s)")
    print(f"Rename map ({len(rename_map)} entries):")
    for old_ref, new_ref in sorted(rename_map.items()):
        print(f"  {old_ref} -> {new_ref}")


# ---------------------------------------------------------------------------
# punch
# ---------------------------------------------------------------------------

def cmd_punch(args: argparse.Namespace, carta_root: Path) -> None:
    """Expand leaf file into directory."""
    source_path = resolve_and_validate(args.target, carta_root)

    if source_path.is_dir():
        raise CartaError(f"Error: source is already a directory: {source_path}")

    if not source_path.name.endswith(".md"):
        raise CartaError(f"Error: source is not a .md file: {source_path}")

    prefix = get_numeric_prefix(source_path.name)
    if prefix is None:
        raise CartaError(f"Error: source has no numeric prefix: {source_path.name}")

    dir_name = source_path.name[:-3]
    new_dir = source_path.parent / dir_name
    new_index = new_dir / "00-index.md"

    if args.dry_run:
        print(f"Would punch: {source_path.name} → {dir_name}/00-index.md")
        print("\n(dry-run: no files modified)")
        return

    new_dir.mkdir()
    shutil.move(str(source_path), str(new_index))

    print(f"Punched: {source_path.name} → {dir_name}/00-index.md")


# ---------------------------------------------------------------------------
# flatten
# ---------------------------------------------------------------------------

def _count_content_lines(path: Path) -> int:
    _, body = read_frontmatter(path)
    return sum(1 for line in body.splitlines() if line.strip())


def cmd_flatten(args: argparse.Namespace, carta_root: Path) -> None:
    """Dissolve directory, hoist children."""
    source_path = resolve_and_validate(args.target, carta_root)

    if not source_path.is_dir():
        raise CartaError(f"Error: source is not a directory: {source_path}")

    source_prefix = get_numeric_prefix(source_path.name)
    if source_prefix is None:
        raise CartaError(f"Error: source has no numeric prefix: {source_path.name}")

    parent_dir = source_path.parent
    insertion_start = args.at_position
    if insertion_start is None:
        insertion_start = source_prefix

    index_file = source_path / "00-index.md"
    has_index = index_file.exists()
    keep_index = args.keep_index
    force = args.force

    if has_index and not keep_index:
        content_lines = _count_content_lines(index_file)
        if content_lines > 10 and not force:
            raise CartaError(
                f"Error: {index_file.relative_to(carta_root)} has {content_lines} "
                "content lines.\nUse --keep-index to preserve it, or --force to discard."
            )

    parent_entries = list_numbered_entries(parent_dir)
    before: list[tuple[Path, str]] = []
    after: list[tuple[Path, str]] = []

    for entry in parent_entries:
        if entry.resolve() == source_path.resolve():
            continue
        pfx = get_numeric_prefix(entry.name)
        if pfx < insertion_start:
            before.append((entry, get_slug(entry.name)))
        else:
            after.append((entry, get_slug(entry.name)))

    hoisted: list[tuple[Path, str]] = []
    if has_index and keep_index:
        dir_slug = get_slug(source_path.name) + ".md"
        hoisted.append((index_file, dir_slug))

    for child in list_numbered_entries(source_path):
        if child.name == "00-index.md":
            continue
        hoisted.append((child, get_slug(child.name)))

    if not hoisted:
        raise CartaError("Error: no children to hoist.")

    final_order = before + hoisted + after

    moves: list[tuple[Path, Path]] = []
    for idx, (item_path, slug) in enumerate(final_order):
        new_prefix = idx + 1
        new_name = f"{new_prefix:02d}-{slug}"
        new_path = parent_dir / new_name
        if item_path.resolve() != new_path.resolve():
            moves.append((item_path, new_path))

    rename_map = compute_rename_map(moves, carta_root)

    if args.dry_run:
        print("=== Planned flatten ===")
        print(f"Dissolving: {source_path.relative_to(carta_root)}")
        print(f"Children to hoist: {len(hoisted)}")
        if has_index:
            if keep_index:
                print(f"Index: kept as {get_slug(source_path.name)}.md")
            else:
                print("Index: discarded")
        print()
        print("=== Filesystem moves ===")
        for old, new in moves:
            print(f"  {old.relative_to(carta_root)} -> {new.relative_to(carta_root)}")
        print()
        print(f"=== Ref rename map ({len(rename_map)} entries) ===")
        for old_ref, new_ref in sorted(rename_map.items()):
            print(f"  {old_ref} -> {new_ref}")
        print("\n(dry-run: no files modified)")
        return

    with tempfile.TemporaryDirectory(dir=parent_dir) as staging:
        staging_path = Path(staging)
        staged: list[tuple[Path, str, int]] = []
        for idx, (item_path, slug) in enumerate(final_order):
            final_prefix = idx + 1
            stage_name = f"{final_prefix:02d}-{slug}"
            stage_path = staging_path / stage_name
            shutil.move(str(item_path), str(stage_path))
            staged.append((stage_path, slug, final_prefix))

        if has_index and not keep_index:
            remaining_index = source_path / "00-index.md"
            if remaining_index.exists():
                remaining_index.unlink()

        if source_path.exists():
            shutil.rmtree(str(source_path))

        for stage_path, slug, final_prefix in staged:
            final_name = f"{final_prefix:02d}-{slug}"
            final_path = parent_dir / final_name
            shutil.move(str(stage_path), str(final_path))

    rewrite_results = rewrite_refs(collect_rewritable_files(carta_root), rename_map)

    do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Flattened: {source_path.name} ({len(hoisted)} children hoisted)")
    print(f"Refs updated: {sum(rewrite_results.values())} replacement(s) across {len(rewrite_results)} file(s)")
    if rename_map:
        print(f"Rename map ({len(rename_map)} entries):")
        for old_ref, new_ref in sorted(rename_map.items()):
            print(f"  {old_ref} -> {new_ref}")


# ---------------------------------------------------------------------------
# copy
# ---------------------------------------------------------------------------

def cmd_copy(args: argparse.Namespace, carta_root: Path) -> None:
    """Copy a file into the workspace."""
    source_path = Path(args.source).resolve()

    if args.order is not None and args.order < 1:
        raise CartaError("Error: --order must be >= 1.")

    dest_path = resolve_and_validate(args.destination, carta_root)

    if not dest_path.is_dir():
        raise CartaError(f"Error: destination is not a directory: {dest_path}")

    rename_slug = args.rename_slug
    if rename_slug is None:
        stem = source_path.stem
        m = re.match(r'^\d{2}-(.*)', stem)
        rename_slug = m.group(1) if m else stem

    entries = list_numbered_entries(dest_path)
    prefix = compute_insertion_prefix(entries, args.order)

    occupied = {get_numeric_prefix(e.name) for e in entries}
    if prefix in occupied:
        raise CartaError(
            f"Error: position {prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
            f"Occupied positions: {sorted(occupied)}"
        )

    ext = source_path.suffix or ".md"
    new_name = f"{prefix:02d}-{rename_slug}{ext}"
    new_path = dest_path / new_name

    if args.dry_run:
        print(f"Would copy: {source_path.name} -> {new_path.relative_to(carta_root)}")
        print(f"  Position: {prefix:02d}")
        print(f"  Slug: {rename_slug}")
        print("\n(dry-run: no files modified)")
        return

    shutil.copy2(str(source_path), str(new_path))

    do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Copied: {source_path.name} -> {new_path.relative_to(carta_root)}")
    print(f"  Position: {prefix:02d}")


# ---------------------------------------------------------------------------
# rewrite
# ---------------------------------------------------------------------------

def cmd_rewrite(args: argparse.Namespace, carta_root: Path) -> None:
    """Rewrite doc refs from mappings."""
    rename_map: dict[str, str] = {}

    for pair in args.mappings:
        if '=' not in pair:
            raise CartaError(f"Error: invalid mapping {pair!r} — expected old=new format.")
        old, new = pair.split('=', 1)
        rename_map[old.strip()] = new.strip()

    if not rename_map:
        raise CartaError("Error: no mappings provided.")

    md_files = collect_rewritable_files(carta_root)

    if args.dry_run:
        print(f"=== Ref rewrite plan ({len(rename_map)} mappings) ===")
        for old, new in sorted(rename_map.items()):
            print(f"  {old} -> {new}")
        print(f"\nScanning {len(md_files)} file(s)...")
        total = 0
        for fpath in md_files:
            try:
                text = fpath.read_text(encoding='utf-8')
            except (OSError, UnicodeDecodeError):
                continue
            for old in rename_map:
                pattern = re.compile(r'(?<!\w)' + re.escape(old) + r'(?!\.[a-zA-Z0-9])')
                matches = pattern.findall(text)
                if matches:
                    total += len(matches)
                    print(f"  {display_path(fpath, carta_root)}: {len(matches)} match(es) for {old}")
        print(f"\nTotal: {total} replacement(s) would be made.")
        print("(dry-run: no files modified)")
        return

    results = rewrite_refs(md_files, rename_map)
    total = sum(results.values())
    print(f"Rewrote {total} ref(s) across {len(results)} file(s).")
    if results:
        for fpath, count in sorted(results.items(), key=lambda x: str(x[0])):
            print(f"  {display_path(fpath, carta_root)}: {count}")


# ---------------------------------------------------------------------------
# group
# ---------------------------------------------------------------------------

def cmd_group(args: argparse.Namespace, carta_root: Path) -> None:
    """Create a title group directory with 00-index.md."""
    target = args.target
    target_path = (carta_root / target).resolve()

    if target_path.exists():
        if any(target_path.iterdir()):
            raise CartaError(f"Error: directory already exists and is not empty: {target_path.relative_to(carta_root)}")
        # Empty directory — proceed (skip mkdir below)

    if not target_path.parent.exists():
        raise CartaError(f"Error: parent directory does not exist: {target_path.parent}")

    if get_numeric_prefix(target_path.name) is None:
        raise CartaError(f"Error: directory name must have NN- prefix: {target_path.name}")

    if not target_path.exists():
        target_path.mkdir()

    title = args.title if args.title else get_slug(target_path.name).replace("-", " ").title()
    write_frontmatter(target_path / "00-index.md", {
        "title": title, "status": "draft",
        "summary": "", "tags": [], "deps": [],
    }, f"\n# {title}\n")

    if not args.no_regen:
        do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Created group: {target_path.relative_to(carta_root)}")
    print(f"  Index: {(target_path / '00-index.md').relative_to(carta_root)}")
    print(f"  Title: {title}")


# ---------------------------------------------------------------------------
# rename
# ---------------------------------------------------------------------------

def cmd_rename(args: argparse.Namespace, carta_root: Path) -> None:
    """Rename a directory or file slug without changing position."""
    target_path = resolve_and_validate(args.target, carta_root)

    prefix = get_numeric_prefix(target_path.name)
    if prefix is None:
        raise CartaError(f"Error: target has no numeric prefix: {target_path.name}")

    new_slug = args.new_slug
    if re.match(r'^\d{2}-', new_slug):
        new_slug = re.sub(r'^\d{2}-', '', new_slug)

    if target_path.is_dir():
        new_name = f"{prefix:02d}-{new_slug}"
    else:
        ext = target_path.suffix
        stem_slug = new_slug
        if stem_slug.endswith(ext):
            stem_slug = stem_slug[:-len(ext)]
        new_name = f"{prefix:02d}-{stem_slug}{ext}"

    new_path = target_path.parent / new_name

    if new_path.exists() and new_path.resolve() != target_path.resolve():
        raise CartaError(f"Error: destination already exists: {new_path}")

    shutil.move(str(target_path), str(new_path))

    if not args.no_regen:
        do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Renamed: {target_path.name} -> {new_path.name}")


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

    index_content = (_MODULE_DIR / "templates" / "00-index.md").read_text(encoding="utf-8").replace("{{title}}", title)
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
        skill_content = (_MODULE_DIR / "templates" / "skill.md").read_text(encoding="utf-8").replace("{{dir_name}}", dirname)
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
        src = _MODULE_DIR / module
        (scripts_dir / module).write_bytes(src.read_bytes())

    for data_file in _DATA_FILES:
        src = _MODULE_DIR / data_file
        dest = scripts_dir / data_file
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(src.read_bytes())

    shim = _MODULE_DIR / "portable" / "carta_main.py"
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


# ---------------------------------------------------------------------------
# main / argument parser
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="carta",
        description="Workspace tools for managing .carta/ documentation.",
    )
    parser.add_argument("--version", action="version", version=f"carta-cli {__version__}")
    parser.add_argument("--workspace", "-w", type=Path, default=None,
                        help="Path to workspace directory. Default: auto-detect.")
    parser.add_argument("--help-ai", action="store_true",
                        help="[Deprecated] Use `carta ai-skill` instead.")

    subparsers = parser.add_subparsers(dest="command", required=False)

    # regenerate
    p_regen = subparsers.add_parser("regenerate", help="Rebuild MANIFEST.md")
    p_regen.add_argument("--dry-run", action="store_true")

    # create
    p_create = subparsers.add_parser("create", help="Create a new doc entry")
    p_create.add_argument("destination")
    p_create.add_argument("slug")
    p_create.add_argument("--order", type=int, default=None)
    p_create.add_argument("--title", default=None)
    p_create.add_argument("--dry-run", action="store_true")

    # delete
    p_delete = subparsers.add_parser("delete", help="Delete entries with gap-closing")
    p_delete.add_argument("targets", nargs="+")
    p_delete.add_argument("--dry-run", action="store_true")
    p_delete.add_argument("--output-mapping", action="store_true")

    # move
    p_move = subparsers.add_parser("move", help="Move/reorder entries")
    p_move.add_argument("source")
    p_move.add_argument("destination")
    p_move.add_argument("--order", type=int, default=None)
    p_move.add_argument("--mkdir", action="store_true")
    p_move.add_argument("--rename", default=None)
    p_move.add_argument("--no-regen", action="store_true", help="Skip MANIFEST regeneration.")
    p_move.add_argument("--dry-run", action="store_true")

    # punch
    p_punch = subparsers.add_parser("punch", help="Expand leaf into directory")
    p_punch.add_argument("target")
    p_punch.add_argument("--dry-run", action="store_true")

    # flatten
    p_flatten = subparsers.add_parser("flatten", help="Dissolve directory")
    p_flatten.add_argument("target")
    p_flatten.add_argument("--keep-index", action="store_true")
    p_flatten.add_argument("--force", action="store_true")
    p_flatten.add_argument("--at", dest="at_position", type=int, default=None)
    p_flatten.add_argument("--dry-run", action="store_true")

    # copy
    p_copy = subparsers.add_parser("copy", help="Copy file into workspace")
    p_copy.add_argument("source")
    p_copy.add_argument("destination")
    p_copy.add_argument("--order", type=int, default=None)
    p_copy.add_argument("--rename", dest="rename_slug", default=None)
    p_copy.add_argument("--dry-run", action="store_true")

    # rewrite
    p_rewrite = subparsers.add_parser("rewrite", help="Rewrite doc refs")
    p_rewrite.add_argument("mappings", nargs="+", help="old=new pairs")
    p_rewrite.add_argument("--dry-run", action="store_true")

    # group
    p_group = subparsers.add_parser("group", help="Create a title group directory")
    p_group.add_argument("target", help="Directory path relative to workspace (e.g., 01-product-strategy)")
    p_group.add_argument("--title", default=None, help="Title for the index. Default: derived from slug.")
    p_group.add_argument("--no-regen", action="store_true", help="Skip MANIFEST regeneration.")

    # rename
    p_rename = subparsers.add_parser("rename", help="Rename a directory or file slug")
    p_rename.add_argument("target", help="Target to rename (doc ref or relative path)")
    p_rename.add_argument("new_slug", help="New slug (the part after NN-)")
    p_rename.add_argument("--no-regen", action="store_true", help="Skip MANIFEST regeneration.")

    # init
    p_init = subparsers.add_parser("init", help="Initialize a new workspace")
    p_init.add_argument("--name", default=None, help="Workspace title. Default: parent directory name.")
    p_init.add_argument("--dir", dest="dirname", default=".carta",
                        help="Name of the workspace directory. Default: .carta")
    p_init.add_argument("--portable", action="store_true",
                        help="Dump editable Python scripts into workspace for pip-free usage.")

    # portable
    p_portable = subparsers.add_parser("portable", help="Dump editable scripts into workspace")

    # ai-skill
    subparsers.add_parser("ai-skill", help="Print AI agent reference for all commands")

    # cat
    p_cat = subparsers.add_parser("cat", help="Print document contents by ref")
    p_cat.add_argument("ref", help="Doc ref (e.g., doc02.03) or relative path")

    args = parser.parse_args()

    if args.help_ai:
        print("Deprecated: --help-ai is replaced by `carta ai-skill`.")
        print("Run `carta ai-skill` for full semantic documentation.")
        raise SystemExit(0)

    if not args.command:
        parser.print_help()
        raise SystemExit(1)

    try:
        # init and portable don't require a pre-existing workspace
        if args.command == "init":
            cmd_init(args)
            return

        # Resolve workspace
        if args.workspace:
            carta_root = args.workspace.resolve()
        else:
            try:
                carta_root = find_workspace()
            except FileNotFoundError as e:
                raise CartaError(f"Error: {e}")

        if args.command == "portable":
            cmd_portable(args, carta_root)
            return

        dispatch = {
            "regenerate": cmd_regenerate,
            "create": cmd_create,
            "delete": cmd_delete,
            "move": cmd_move,
            "punch": cmd_punch,
            "flatten": cmd_flatten,
            "copy": cmd_copy,
            "rewrite": cmd_rewrite,
            "group": cmd_group,
            "rename": cmd_rename,
            "ai-skill": cmd_ai_skill,
            "cat": cmd_cat,
        }
        dispatch[args.command](args, carta_root)
    except CartaError as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
