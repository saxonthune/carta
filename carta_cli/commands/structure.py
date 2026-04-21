"""carta — structure commands: create, delete, move, rename."""
import argparse
import json
import re
import shutil
from pathlib import Path

from ..errors import CartaError
from ..frontmatter import write_frontmatter
from ..entries import resolve_arg, resolve_and_validate, list_numbered_entries, display_path
from ..numbering import get_numeric_prefix, get_slug, compute_insertion_prefix
from ..ref_convert import path_to_ref
from ..rewriter import rewrite_refs
from ..planning import compute_all_moves, compute_rename_map, print_rename_map
from ..workspace import collect_rewritable_files
from ..regenerate_core import do_regenerate
from .setup import _load_preamble
from .. import bundle as bundle_mod


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
        if args.summary:
            print(f"  Summary: {args.summary}")
        if args.tags:
            print(f"  Tags: {args.tags}")
        if args.deps:
            print(f"  Deps: {args.deps}")
        print(f"  Position: {prefix:02d}")
        print("\n(dry-run: no files created)")
        return

    frontmatter = {
        "title": title,
        "summary": args.summary if args.summary is not None else "",
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()] if args.tags else [],
        "deps": [d.strip() for d in args.deps.split(",") if d.strip()] if args.deps else [],
    }
    write_frontmatter(new_path, frontmatter, f"\n# {title}\n")

    do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Created: {new_path.relative_to(carta_root)}")
    print(f"  Title: {title}")
    print(f"  Position: {prefix:02d}")


# ---------------------------------------------------------------------------
# delete helpers
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


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

def cmd_delete(args: argparse.Namespace, carta_root: Path) -> None:
    """Delete entries with gap-closing."""
    target_paths: list[Path] = []
    for target in args.targets:
        path = resolve_and_validate(target, carta_root)
        if (path.is_file()
                and path.suffix != '.md'
                and get_numeric_prefix(path.name) is not None):
            raise CartaError(f"cannot delete an attachment directly; delete its root md: {path.name}")
        target_paths.append(path)

    deleted_refs: set[str] = set()
    for path in target_paths:
        deleted_refs |= _collect_refs_under(path, carta_root)

    parents: dict[Path, list[Path]] = {}
    for path in target_paths:
        parents.setdefault(path.parent, []).append(path)

    all_moves: list[tuple[Path, Path]] = []
    for parent_dir, deleted_in_parent in parents.items():
        # Build set of all deleted paths (including bundle attachments)
        deleted_roots: set[Path] = set()
        for p in deleted_in_parent:
            deleted_roots.add(p.resolve())
            if p.is_file():
                for member in bundle_mod.bundle_members(p)[1:]:
                    deleted_roots.add(member.resolve())

        # Gap-close surviving bundles as groups
        bundles = bundle_mod.list_bundles(parent_dir)
        next_prefix = 1
        for bndl in bundles:
            if bndl.prefix == 0:
                continue
            all_members = ([bndl.root] if bndl.root else []) + list(bndl.attachments)
            if any(m.resolve() in deleted_roots for m in all_members):
                continue  # skip deleted bundles
            if bndl.prefix != next_prefix:
                for member in all_members:
                    old_slug = get_slug(member.name)
                    new_name = f"{next_prefix:02d}-{old_slug}"
                    all_moves.append((member, parent_dir / new_name))
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
    orphaned.sort(key=lambda t: (str(t[0]), t[2], t[1]))

    if args.dry_run:
        print("=== Planned deletions ===")
        for path in target_paths:
            kind = "directory" if path.is_dir() else "file"
            print(f"  DELETE {kind}: {path.relative_to(carta_root)}")
            if path.is_file() and path.suffix == '.md':
                for att in bundle_mod.bundle_members(path)[1:]:
                    print(f"  DELETE attachment: {att.relative_to(carta_root)}")
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
            for member in bundle_mod.bundle_members(path):
                if member.exists():
                    member.unlink()

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
# move helper
# ---------------------------------------------------------------------------

def _create_index_for_new_dir(dir_path: Path) -> None:
    slug = get_slug(dir_path.name)
    title = slug.replace("-", " ").title()
    write_frontmatter(dir_path / "00-index.md", {
        "title": title,
        "summary": "", "tags": [], "deps": [],
    }, f"\n# {title}\n")


# ---------------------------------------------------------------------------
# move
# ---------------------------------------------------------------------------

def cmd_move(args: argparse.Namespace, carta_root: Path) -> None:
    """Move/reorder entries."""
    if args.order is not None and args.order < 1:
        raise CartaError("Error: --order must be >= 1 (position 0 is reserved for index files).")

    source_path = resolve_and_validate(args.source, carta_root)

    if (source_path.is_file()
            and source_path.suffix != '.md'
            and get_numeric_prefix(source_path.name) is not None):
        raise CartaError("cannot move an attachment directly; move its root md")

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
        if len(bundle_mod.list_bundles(dest_path)) >= 99:
            raise CartaError(f"Error: destination has >= 99 items: {dest_path}")

    try:
        moves = compute_all_moves(source_path, dest_path, args.order,
                                  rename_slug=args.rename,
                                  no_gap_close=args.no_gap_close)
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
        new_path = target_path.parent / new_name
        if new_path.exists() and new_path.resolve() != target_path.resolve():
            raise CartaError(f"Error: destination already exists: {new_path}")
        shutil.move(str(target_path), str(new_path))
        if not args.no_regen:
            do_regenerate(carta_root, _load_preamble(carta_root.name))
        print(f"Renamed: {target_path.name} -> {new_path.name}")
        return

    ext = target_path.suffix
    stem_slug = new_slug
    if stem_slug.endswith(ext):
        stem_slug = stem_slug[:-len(ext)]
    new_name = f"{prefix:02d}-{stem_slug}{ext}"
    new_path = target_path.parent / new_name

    if new_path.exists() and new_path.resolve() != target_path.resolve():
        raise CartaError(f"Error: destination already exists: {new_path}")

    # Collect renames: root md + same-slug attachments
    renames: list[tuple[Path, Path]] = [(target_path, new_path)]
    unchanged: list[Path] = []

    bndl = bundle_mod.find_bundle(target_path)
    if bndl and bndl.slug:
        old_slug = bndl.slug
        for att in bndl.attachments:
            att_slug = get_slug(att.name)
            if att_slug.startswith(old_slug + "."):
                new_att_slug = stem_slug + att_slug[len(old_slug):]
                renames.append((att, att.parent / f"{prefix:02d}-{new_att_slug}"))
            else:
                unchanged.append(att)

    for old, new in renames:
        shutil.move(str(old), str(new))

    if not args.no_regen:
        do_regenerate(carta_root, _load_preamble(carta_root.name))

    for old, new in renames:
        print(f"Renamed: {old.name} -> {new.name}")
    for att in unchanged:
        print(f"Left unchanged (same prefix, different slug): {att.name}")
