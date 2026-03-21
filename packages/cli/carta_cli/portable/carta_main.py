#!/usr/bin/env python3
"""carta — portable workspace tools. No pip required.

Edit freely — these are your scripts.

Usage: python3 carta.py <command> [options]
"""
import argparse
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

# Add parent dir to path so _scripts/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _scripts.__version__ import __version__
from _scripts.frontmatter import read_frontmatter, write_frontmatter
from _scripts.entries import resolve_arg, list_numbered_entries
from _scripts.numbering import get_numeric_prefix, get_slug, compute_insertion_prefix
from _scripts.ref_convert import path_to_ref
from _scripts.rewriter import collect_md_files, rewrite_refs
from _scripts.planning import compute_all_moves, compute_rename_map
from _scripts.workspace import find_workspace, load_workspace, get_external_ref_paths
from _scripts.regenerate_core import do_regenerate

SCRIPTS_DIR = Path(__file__).resolve().parent / "_scripts"


def _load_preamble(carta_root: Path) -> str:
    """Read manifest-preamble.md from _scripts/ and substitute {{dir_name}}."""
    preamble_path = SCRIPTS_DIR / "manifest-preamble.md"
    preamble = preamble_path.read_text(encoding="utf-8")
    return preamble.replace("{{dir_name}}", carta_root.name)


# ---------------------------------------------------------------------------
# regenerate
# ---------------------------------------------------------------------------

def cmd_regenerate(args, carta_root: Path) -> None:
    """Rebuild MANIFEST.md from doc frontmatter."""
    preamble = _load_preamble(carta_root)
    do_regenerate(carta_root, preamble, dry_run=args.dry_run)


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

def cmd_create(args, carta_root: Path) -> None:
    """Create a new doc entry."""
    slug = args.slug

    if re.match(r'^\d{2}-', slug):
        print("Error: slug must not contain a numeric prefix (NN-). Provide just the slug part.", file=sys.stderr)
        raise SystemExit(1)

    if args.order is not None and args.order < 1:
        print("Error: --order must be >= 1 (position 0 is reserved for index files).", file=sys.stderr)
        raise SystemExit(1)

    try:
        dest_path = resolve_arg(args.destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error resolving destination {args.destination!r}: {e}", file=sys.stderr)
        raise SystemExit(1)

    if not dest_path.exists():
        print(f"Error: destination does not exist: {dest_path}", file=sys.stderr)
        raise SystemExit(1)

    if not dest_path.is_dir():
        print(f"Error: destination is not a directory: {dest_path}", file=sys.stderr)
        raise SystemExit(1)

    prefix = compute_insertion_prefix(list_numbered_entries(dest_path), args.order)

    entries = list_numbered_entries(dest_path)
    occupied = {get_numeric_prefix(e.name) for e in entries}
    if prefix in occupied:
        print(
            f"Error: position {prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
            f"Occupied positions: {sorted(occupied)}",
            file=sys.stderr,
        )
        raise SystemExit(1)

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

    do_regenerate(carta_root, _load_preamble(carta_root))

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


def cmd_delete(args, carta_root: Path) -> None:
    """Delete entries with gap-closing."""
    target_paths: list[Path] = []
    for target in args.targets:
        try:
            path = resolve_arg(target, carta_root)
        except (FileNotFoundError, ValueError) as e:
            print(f"Error resolving {target!r}: {e}", file=sys.stderr)
            raise SystemExit(1)
        if not path.exists():
            print(f"Error: does not exist: {path}", file=sys.stderr)
            raise SystemExit(1)
        target_paths.append(path)

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

    from _scripts.planning import compute_rename_map
    rename_map = compute_rename_map(all_moves, carta_root)

    manifest_path = carta_root / "MANIFEST.md"
    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
        and not any(f.resolve() == tp.resolve() or
                    (tp.is_dir() and _is_under(f, tp))
                    for tp in target_paths)
    ]

    repo_root = carta_root.parent

    def _display_path(p: Path) -> str:
        try:
            return str(p.relative_to(carta_root))
        except ValueError:
            try:
                return str(p.relative_to(repo_root))
            except ValueError:
                return str(p)

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

    md_files_after = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]
    rewrite_results = rewrite_refs(md_files_after, rename_map)

    do_regenerate(carta_root, _load_preamble(carta_root))

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


def cmd_move(args, carta_root: Path) -> None:
    """Move/reorder entries."""
    if args.order is not None and args.order < 1:
        print("Error: --order must be >= 1 (position 0 is reserved for index files).", file=sys.stderr)
        raise SystemExit(1)

    try:
        source_path = resolve_arg(args.source, carta_root)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error resolving source {args.source!r}: {e}", file=sys.stderr)
        raise SystemExit(1)

    if not source_path.exists():
        print(f"Error: source does not exist: {source_path}", file=sys.stderr)
        raise SystemExit(1)

    if args.rename and source_path.name == "00-index.md":
        print("Error: cannot rename 00-index.md files.", file=sys.stderr)
        raise SystemExit(1)

    try:
        dest_path = resolve_arg(args.destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        if not args.mkdir:
            print(f"Error resolving destination {args.destination!r}: {e}", file=sys.stderr)
            raise SystemExit(1)
        dest_path = (carta_root / args.destination).resolve()

    mkdir_created = False
    if not dest_path.exists():
        if not args.mkdir:
            print(f"Error: destination does not exist: {dest_path}", file=sys.stderr)
            raise SystemExit(1)
        if not dest_path.parent.exists():
            print(
                f"Error: parent directory does not exist: {dest_path.parent}\n"
                "--mkdir only creates one level of directory.",
                file=sys.stderr,
            )
            raise SystemExit(1)
        mkdir_created = True
        dest_path.mkdir()
        _create_index_for_new_dir(dest_path)
        if args.dry_run:
            print(f"Would create directory: {dest_path.relative_to(carta_root)}")

    if dest_path.exists() and not dest_path.is_dir():
        print(f"Error: destination is not a directory: {dest_path}", file=sys.stderr)
        raise SystemExit(1)

    if not mkdir_created:
        dest_entries = list_numbered_entries(dest_path)
        if len(dest_entries) >= 99:
            print(f"Error: destination has >= 99 items: {dest_path}", file=sys.stderr)
            raise SystemExit(1)

    try:
        moves = compute_all_moves(source_path, dest_path, args.order, rename_slug=args.rename)
    except ValueError as e:
        print(f"Error computing moves: {e}", file=sys.stderr)
        raise SystemExit(1)

    rename_map = compute_rename_map(moves, carta_root)

    if args.dry_run:
        from _scripts.planning import print_rename_map
        print_rename_map(rename_map, moves)
        print("\n(dry-run: no files modified)")
        if mkdir_created:
            shutil.rmtree(str(dest_path))
        return

    for old_path, new_path in moves:
        if old_path.exists():
            shutil.move(str(old_path), str(new_path))

    manifest_path = carta_root / "MANIFEST.md"
    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]
    rewrite_results = rewrite_refs(md_files, rename_map)

    do_regenerate(carta_root, _load_preamble(carta_root))

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

def cmd_punch(args, carta_root: Path) -> None:
    """Expand leaf file into directory."""
    try:
        source_path = resolve_arg(args.target, carta_root)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error resolving source {args.target!r}: {e}", file=sys.stderr)
        raise SystemExit(1)

    if not source_path.exists():
        print(f"Error: source does not exist: {source_path}", file=sys.stderr)
        raise SystemExit(1)

    if source_path.is_dir():
        print(f"Error: source is already a directory: {source_path}", file=sys.stderr)
        raise SystemExit(1)

    if not source_path.name.endswith(".md"):
        print(f"Error: source is not a .md file: {source_path}", file=sys.stderr)
        raise SystemExit(1)

    prefix = get_numeric_prefix(source_path.name)
    if prefix is None:
        print(f"Error: source has no numeric prefix: {source_path.name}", file=sys.stderr)
        raise SystemExit(1)

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


def cmd_flatten(args, carta_root: Path) -> None:
    """Dissolve directory, hoist children."""
    try:
        source_path = resolve_arg(args.target, carta_root)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error resolving source {args.target!r}: {e}", file=sys.stderr)
        raise SystemExit(1)

    if not source_path.exists():
        print(f"Error: source does not exist: {source_path}", file=sys.stderr)
        raise SystemExit(1)

    if not source_path.is_dir():
        print(f"Error: source is not a directory: {source_path}", file=sys.stderr)
        raise SystemExit(1)

    source_prefix = get_numeric_prefix(source_path.name)
    if source_prefix is None:
        print(f"Error: source has no numeric prefix: {source_path.name}", file=sys.stderr)
        raise SystemExit(1)

    parent_dir = source_path.parent
    insertion_start = getattr(args, 'at_position', None)
    if insertion_start is None:
        insertion_start = source_prefix

    index_file = source_path / "00-index.md"
    has_index = index_file.exists()
    keep_index = getattr(args, 'keep_index', False)
    force = getattr(args, 'force', False)

    if has_index and not keep_index:
        content_lines = _count_content_lines(index_file)
        if content_lines > 10 and not force:
            print(
                f"Error: {index_file.relative_to(carta_root)} has {content_lines} "
                "content lines.\nUse --keep-index to preserve it, or --force to discard.",
                file=sys.stderr,
            )
            raise SystemExit(1)

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
        print("Error: no children to hoist.", file=sys.stderr)
        raise SystemExit(1)

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

    manifest_path = carta_root / "MANIFEST.md"
    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]
    rewrite_results = rewrite_refs(md_files, rename_map)

    do_regenerate(carta_root, _load_preamble(carta_root))

    print(f"Flattened: {source_path.name} ({len(hoisted)} children hoisted)")
    print(f"Refs updated: {sum(rewrite_results.values())} replacement(s) across {len(rewrite_results)} file(s)")
    if rename_map:
        print(f"Rename map ({len(rename_map)} entries):")
        for old_ref, new_ref in sorted(rename_map.items()):
            print(f"  {old_ref} -> {new_ref}")


# ---------------------------------------------------------------------------
# copy
# ---------------------------------------------------------------------------

def cmd_copy(args, carta_root: Path) -> None:
    """Copy a file into the workspace."""
    source_path = Path(args.source).resolve()

    if args.order is not None and args.order < 1:
        print("Error: --order must be >= 1.", file=sys.stderr)
        raise SystemExit(1)

    try:
        dest_path = resolve_arg(args.destination, carta_root)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error resolving destination {args.destination!r}: {e}", file=sys.stderr)
        raise SystemExit(1)

    if not dest_path.is_dir():
        print(f"Error: destination is not a directory: {dest_path}", file=sys.stderr)
        raise SystemExit(1)

    rename_slug = getattr(args, 'rename_slug', None)
    if rename_slug is None:
        stem = source_path.stem
        m = re.match(r'^\d{2}-(.*)', stem)
        rename_slug = m.group(1) if m else stem

    entries = list_numbered_entries(dest_path)
    prefix = compute_insertion_prefix(entries, args.order)

    occupied = {get_numeric_prefix(e.name) for e in entries}
    if prefix in occupied:
        print(
            f"Error: position {prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
            f"Occupied positions: {sorted(occupied)}",
            file=sys.stderr,
        )
        raise SystemExit(1)

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

    do_regenerate(carta_root, _load_preamble(carta_root))

    print(f"Copied: {source_path.name} -> {new_path.relative_to(carta_root)}")
    print(f"  Position: {prefix:02d}")


# ---------------------------------------------------------------------------
# rewrite
# ---------------------------------------------------------------------------

def cmd_rewrite(args, carta_root: Path) -> None:
    """Rewrite doc refs from mappings."""
    rename_map: dict[str, str] = {}

    for pair in args.mappings:
        if '=' not in pair:
            print(f"Error: invalid mapping {pair!r} — expected old=new format.", file=sys.stderr)
            raise SystemExit(1)
        old, new = pair.split('=', 1)
        rename_map[old.strip()] = new.strip()

    if not rename_map:
        print("Error: no mappings provided.", file=sys.stderr)
        raise SystemExit(1)

    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)
    manifest_path = carta_root / "MANIFEST.md"
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]

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
                import re as _re
                pattern = _re.compile(r'(?<!\w)' + _re.escape(old) + r'(?!\.[a-zA-Z0-9])')
                matches = pattern.findall(text)
                if matches:
                    total += len(matches)
                    try:
                        display = str(fpath.relative_to(carta_root))
                    except ValueError:
                        display = str(fpath)
                    print(f"  {display}: {len(matches)} match(es) for {old}")
        print(f"\nTotal: {total} replacement(s) would be made.")
        print("(dry-run: no files modified)")
        return

    results = rewrite_refs(md_files, rename_map)
    total = sum(results.values())
    print(f"Rewrote {total} ref(s) across {len(results)} file(s).")
    if results:
        for fpath, count in sorted(results.items(), key=lambda x: str(x[0])):
            try:
                display = str(fpath.relative_to(carta_root))
            except ValueError:
                display = str(fpath)
            print(f"  {display}: {count}")


# ---------------------------------------------------------------------------
# main / argument parser
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="carta.py",
        description="Portable workspace tools for .carta/ documentation.",
    )
    parser.add_argument("--version", action="version", version=f"carta-cli {__version__} (portable)")
    parser.add_argument("--workspace", "-w", type=Path, default=None,
                        help="Path to workspace directory. Default: auto-detect.")

    subparsers = parser.add_subparsers(dest="command", required=True)

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

    args = parser.parse_args()

    # Resolve workspace
    if args.workspace:
        carta_root = args.workspace.resolve()
    else:
        carta_root = find_workspace()

    # Dispatch
    commands = {
        "regenerate": cmd_regenerate,
        "create": cmd_create,
        "delete": cmd_delete,
        "move": cmd_move,
        "punch": cmd_punch,
        "flatten": cmd_flatten,
        "copy": cmd_copy,
        "rewrite": cmd_rewrite,
    }
    commands[args.command](args, carta_root)


if __name__ == "__main__":
    main()
