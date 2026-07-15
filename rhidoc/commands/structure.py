"""rhidoc — structure commands: make, delete, move, rename."""
import argparse
import json
import shutil
from pathlib import Path

from ..errors import RhidocError
from ..frontmatter import write_frontmatter
from ..entries import resolve_arg, resolve_and_validate, list_numbered_entries, display_path
from ..numbering import compute_insertion_prefix
from ..docref import DocRef, EntryName
from ..rewriter import rewrite_refs
from ..planning import compute_all_moves, compute_rename_map, print_rename_map
from ..workspace import collect_rewritable_files
from ..regenerate_core import do_regenerate
from .setup import _load_preamble
from .. import bundle as bundle_mod


# ---------------------------------------------------------------------------
# make
# ---------------------------------------------------------------------------

def cmd_make(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Create a new doc or group entry."""
    # Validate positional/--at/--before combinations
    if args.at is not None and len(args.target) == 2:
        raise RhidocError("--at takes its position from the ref; do not also pass a parent")

    if args.before is not None and args.at is not None:
        raise RhidocError("--before and --at are mutually exclusive")

    if args.before is not None and len(args.target) == 2:
        raise RhidocError("--before takes its position from the ref; do not also pass a parent")

    if len(args.target) > 2:
        raise RhidocError("too many positional arguments; usage: rhidoc make [PARENT] SLUG")

    shift_moves: list[tuple[Path, Path]] = []

    # Resolve addressing mode
    if args.before is not None:
        if len(args.target) != 1:
            raise RhidocError("--before requires exactly one positional argument (SLUG)")
        slug = args.target[0]

        try:
            before_ref = DocRef.parse(args.before)
        except RhidocError as e:
            raise RhidocError(f"Invalid --before ref: {e}")

        target_prefix = before_ref.segments[-1]
        parent_segments = before_ref.segments[:-1]

        if parent_segments:
            parent_ref = DocRef(segments=parent_segments)
            try:
                parent_path = parent_ref.to_path(rhidoc_root)
            except FileNotFoundError as e:
                raise RhidocError(f"Error resolving parent from --before ref: {e}")
        else:
            parent_path = rhidoc_root

        if not parent_path.is_dir():
            raise RhidocError(f"Error: parent is not a directory: {parent_path}")

        prefix = target_prefix

        # Build shift-up move-set: bump every bundle at prefix >= target_prefix up by one
        bundles = bundle_mod.list_bundles(parent_path)
        for bndl in bundles:
            if bndl.prefix == 0:
                continue
            if bndl.prefix < target_prefix:
                continue
            all_members = ([bndl.root] if bndl.root else []) + list(bndl.attachments)
            for member in all_members:
                parsed = EntryName.parse(member.name)
                assert parsed is not None
                new_name = f"{bndl.prefix + 1:02d}-{parsed.tail}"
                shift_moves.append((member, parent_path / new_name))

        rename_map = compute_rename_map(shift_moves, rhidoc_root)

        if args.dry_run:
            print(f"Would insert at position {prefix:02d} in {parent_path.relative_to(rhidoc_root) if parent_path != rhidoc_root else '(root)'}")
            if shift_moves:
                print(f"\n=== Shift-up moves ({len(shift_moves)}) ===")
                for old, new in shift_moves:
                    print(f"  {old.relative_to(rhidoc_root)} -> {new.relative_to(rhidoc_root)}")
            if rename_map:
                print(f"\n=== Ref rename map ({len(rename_map)} entries) ===")
                for old_ref, new_ref in sorted(rename_map.items()):
                    print(f"  {old_ref} -> {new_ref}")
            if args.group:
                new_dir = parent_path / f"{prefix:02d}-{slug}"
                print(f"\nWould create group: {new_dir.relative_to(rhidoc_root)}/")
                print(f"  Index: {(new_dir / '00-index.md').relative_to(rhidoc_root)}")
            else:
                new_path = parent_path / f"{prefix:02d}-{slug}.md"
                print(f"\nWould create: {new_path.relative_to(rhidoc_root)}")
            print(f"  Position: {prefix:02d}")
            print("\n(dry-run: no files created)")
            return

        # Apply: shift siblings up in reverse prefix order to avoid collisions
        for old_path, new_path in reversed(shift_moves):
            if old_path.exists():
                shutil.move(str(old_path), str(new_path))

        rewrite_refs(collect_rewritable_files(rhidoc_root), rename_map)

        # Fall through to the shared writer (prefix is already set)
        # Regeneration happens once at the end of the writer block

    elif args.at is not None:
        if len(args.target) != 1:
            raise RhidocError("--at requires exactly one positional argument (SLUG)")
        slug = args.target[0]

        try:
            at_ref = DocRef.parse(args.at)
        except RhidocError as e:
            raise RhidocError(f"Invalid --at ref: {e}")

        prefix = at_ref.segments[-1]
        parent_segments = at_ref.segments[:-1]

        if parent_segments:
            parent_ref = DocRef(segments=parent_segments)
            try:
                parent_path = parent_ref.to_path(rhidoc_root)
            except FileNotFoundError as e:
                raise RhidocError(f"Error resolving parent from --at ref: {e}")
        else:
            parent_path = rhidoc_root

        if not parent_path.is_dir():
            raise RhidocError(f"Error: parent is not a directory: {parent_path}")

        entries = list_numbered_entries(parent_path)
        parsed_entries = [EntryName.parse(e.name) for e in entries]
        occupied = {p.prefix for p in parsed_entries if p is not None}
        if prefix in occupied:
            raise RhidocError(
                f"Error: position {prefix:02d} is occupied in {parent_path.relative_to(rhidoc_root)}.\n"
                f"Occupied positions: {sorted(occupied)}"
            )

    elif len(args.target) == 1:
        slug = args.target[0]
        parent_path = rhidoc_root
        prefix = compute_insertion_prefix(list_numbered_entries(parent_path), None)

    else:  # len(args.target) == 2
        try:
            parent_path = resolve_arg(args.target[0], rhidoc_root).path
        except (FileNotFoundError, ValueError) as e:
            raise RhidocError(f"Error resolving parent {args.target[0]!r}: {e}")
        slug = args.target[1]
        prefix = compute_insertion_prefix(list_numbered_entries(parent_path), None)

    # Slug guard: reject slug that already carries a NN- prefix
    if EntryName.parse(slug) is not None:
        raise RhidocError("Error: slug must not contain a numeric prefix (NN-). Provide just the slug part.")

    if not parent_path.exists():
        raise RhidocError(f"Error: parent directory does not exist: {parent_path}")

    if not parent_path.is_dir():
        raise RhidocError(f"Error: parent is not a directory: {parent_path}")

    title = slug.replace("-", " ").title()
    frontmatter = {
        "title": title,
        "summary": "",
        "tags": [],
        "deps": [],
    }
    body = f"\n# {title}\n"

    if args.group:
        new_dir = parent_path / f"{prefix:02d}-{slug}"

        if args.dry_run:
            print(f"Would create group: {new_dir.relative_to(rhidoc_root)}/")
            print(f"  Index: {(new_dir / '00-index.md').relative_to(rhidoc_root)}")
            print(f"  Position: {prefix:02d}")
            print("\n(dry-run: no files created)")
            return

        new_dir.mkdir()

        write_frontmatter(new_dir / "00-index.md", frontmatter, body)
        new_path = new_dir

    else:
        new_path = parent_path / f"{prefix:02d}-{slug}.md"

        if args.dry_run:
            print(f"Would create: {new_path.relative_to(rhidoc_root)}")
            print(f"  Position: {prefix:02d}")
            print("\n(dry-run: no files created)")
            return

        write_frontmatter(new_path, frontmatter, body)

    if not args.no_regen:
        do_regenerate(rhidoc_root, _load_preamble(rhidoc_root.name))

    try:
        ref = DocRef.from_path(new_path, rhidoc_root)
        print(f"Created: {ref}  ({new_path.relative_to(rhidoc_root)})")
    except ValueError:
        print(f"Created: {new_path.relative_to(rhidoc_root)}")

    if args.before is not None and shift_moves:
        print(f"Shifted: {len(shift_moves)} sibling(s) renumbered")


# ---------------------------------------------------------------------------
# delete helpers
# ---------------------------------------------------------------------------

def _collect_refs_under(path: Path, rhidoc_root: Path) -> set[str]:
    refs: set[str] = set()
    try:
        refs.add(str(DocRef.from_path(path, rhidoc_root)))
    except ValueError:
        pass
    if path.is_dir():
        for child in path.rglob("*"):
            try:
                refs.add(str(DocRef.from_path(child, rhidoc_root)))
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

    orphans: list[tuple[Path, str, str]] = []

    for fpath in md_files:
        try:
            text = fpath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        for m in DocRef.SCAN.finditer(text):
            if m.group(0) in deleted_refs:
                line_start = text.rfind("\n", 0, m.start()) + 1
                line_end = text.find("\n", m.end())
                if line_end == -1:
                    line_end = len(text)
                line_text = text[line_start:line_end].strip()
                orphans.append((fpath, line_text, m.group(0)))

    return orphans


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

def cmd_delete(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Delete entries with gap-closing."""
    target_paths: list[Path] = []
    for target in args.targets:
        path = resolve_and_validate(target, rhidoc_root).path
        if (path.is_file()
                and path.suffix != '.md'
                and EntryName.parse(path.name) is not None):
            raise RhidocError(f"cannot delete an attachment directly; delete its root md: {path.name}")
        target_paths.append(path)

    deleted_refs: set[str] = set()
    for path in target_paths:
        deleted_refs |= _collect_refs_under(path, rhidoc_root)

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
                    member_parsed = EntryName.parse(member.name)
                    assert member_parsed is not None
                    new_name = f"{next_prefix:02d}-{member_parsed.tail}"
                    all_moves.append((member, parent_dir / new_name))
            next_prefix += 1

    rename_map = compute_rename_map(all_moves, rhidoc_root)

    md_files = [
        f for f in collect_rewritable_files(rhidoc_root)
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
            print(f"  DELETE {kind}: {path.relative_to(rhidoc_root)}")
            if path.is_file() and path.suffix == '.md':
                for att in bundle_mod.bundle_members(path)[1:]:
                    print(f"  DELETE attachment: {att.relative_to(rhidoc_root)}")
        if deleted_refs:
            print(f"\nRefs removed ({len(deleted_refs)}):")
            for ref in sorted(deleted_refs):
                print(f"  {ref}")
        if all_moves:
            print(f"\n=== Gap-closing moves ({len(all_moves)}) ===")
            for old, new in all_moves:
                print(f"  {old.relative_to(rhidoc_root)} -> {new.relative_to(rhidoc_root)}")
        if rename_map:
            print(f"\n=== Ref rename map ({len(rename_map)} entries) ===")
            for old_ref, new_ref in sorted(rename_map.items()):
                print(f"  {old_ref} -> {new_ref}")
        if orphaned:
            print(f"\n=== Orphaned ref warnings ({len(orphaned)}) ===")
            for fpath, line, ref in orphaned:
                print(f"  {ref} in {display_path(fpath, rhidoc_root)}: {line[:80]}")
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

    rewrite_results = rewrite_refs(collect_rewritable_files(rhidoc_root), rename_map)

    do_regenerate(rhidoc_root, _load_preamble(rhidoc_root.name))

    print(f"Deleted {len(target_paths)} entry(ies):")
    for path in target_paths:
        print(f"  {path.relative_to(rhidoc_root)}")
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
            print(f"  {ref} in {display_path(fpath, rhidoc_root)}: {line[:80]}")

    if args.output_mapping and rename_map:
        print(json.dumps(rename_map, indent=2))
    elif args.output_mapping:
        print("{}")


# ---------------------------------------------------------------------------
# move helper
# ---------------------------------------------------------------------------

def _create_index_for_new_dir(dir_path: Path) -> None:
    en = EntryName.parse(dir_path.name)
    slug = en.tail if en is not None else dir_path.name
    title = slug.replace("-", " ").title()
    write_frontmatter(dir_path / "00-index.md", {
        "title": title,
        "summary": "", "tags": [], "deps": [],
    }, f"\n# {title}\n")


# ---------------------------------------------------------------------------
# move
# ---------------------------------------------------------------------------

def cmd_move(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Move/reorder entries."""
    # Combination guards
    if args.at is not None and args.before is not None:
        raise RhidocError("--at and --before are mutually exclusive")
    if (args.at is not None or args.before is not None) and args.destination is not None:
        raise RhidocError("--at/--before takes its destination from the ref; do not also pass a destination")
    if args.at is None and args.before is None and args.destination is None:
        raise RhidocError("provide a destination (append), or use --at/--before")

    source_path = resolve_and_validate(args.source, rhidoc_root).path

    if (source_path.is_file()
            and source_path.suffix != '.md'
            and EntryName.parse(source_path.name) is not None):
        raise RhidocError("cannot move an attachment directly; move its root md")

    if args.rename and source_path.name == "00-index.md":
        raise RhidocError("Error: cannot rename 00-index.md files.")

    target_prefix: int | None = None
    strict = False
    mkdir_created = False

    if args.at is not None or args.before is not None:
        ref_str = args.at if args.at is not None else args.before
        strict = (args.at is not None)
        try:
            ref = DocRef.parse(ref_str)
        except RhidocError as e:
            raise RhidocError(f"Invalid ref: {e}")
        target_prefix = ref.segments[-1]
        parent_segments = ref.segments[:-1]
        if parent_segments:
            parent_ref = DocRef(segments=parent_segments)
            try:
                dest_path = parent_ref.to_path(rhidoc_root)
            except FileNotFoundError as e:
                raise RhidocError(f"Error resolving parent from ref: {e}")
        else:
            dest_path = rhidoc_root
        if not dest_path.is_dir():
            raise RhidocError(f"Error: parent is not a directory: {dest_path}")

        # Index-slot guard: prefix 0 is reserved when a 00-index.md occupies it
        if target_prefix == 0 and (dest_path / "00-index.md").exists():
            dest_label = dest_path.name if dest_path != rhidoc_root else "(root)"
            raise RhidocError(f"position 00 is reserved for 00-index.md in {dest_label}")

        # Strict (--at) occupancy precheck
        if strict:
            all_entries = list_numbered_entries(dest_path)
            all_entries_parsed = [EntryName.parse(e.name) for e in all_entries]
            occupied = {p.prefix for p in all_entries_parsed if p is not None}
            # Same-dir: source slot is vacating — exclude it
            if source_path.parent.resolve() == dest_path.resolve():
                _src_en = EntryName.parse(source_path.name)
                if _src_en is not None:
                    occupied.discard(_src_en.prefix)
            if target_prefix in occupied:
                raise RhidocError(
                    f"position {target_prefix:02d} is occupied in "
                    f"{dest_path.name if dest_path != rhidoc_root else '(root)'}\n"
                    f"Occupied positions: {sorted(occupied)}"
                )
    else:
        # Append mode: positional destination
        try:
            dest_path = resolve_arg(args.destination, rhidoc_root).path
        except (FileNotFoundError, ValueError) as e:
            if not args.mkdir:
                raise RhidocError(f"Error resolving destination {args.destination!r}: {e}")
            dest_path = (rhidoc_root / args.destination).resolve()

        if not dest_path.exists():
            if not args.mkdir:
                raise RhidocError(f"Error: destination does not exist: {dest_path}")
            if not dest_path.parent.exists():
                raise RhidocError(
                    f"Error: parent directory does not exist: {dest_path.parent}\n"
                    "--mkdir only creates one level of directory."
                )
            mkdir_created = True
            dest_path.mkdir()
            _create_index_for_new_dir(dest_path)
            if args.dry_run:
                print(f"Would create directory: {dest_path.relative_to(rhidoc_root)}")

        if dest_path.exists() and not dest_path.is_dir():
            raise RhidocError(f"Error: destination is not a directory: {dest_path}")

    if not mkdir_created:
        if len(bundle_mod.list_bundles(dest_path)) >= 99:
            raise RhidocError(f"Error: destination has >= 99 items: {dest_path}")

    try:
        moves = compute_all_moves(source_path, dest_path, target_prefix,
                                  rename_slug=args.rename,
                                  no_gap_close=args.no_gap_close,
                                  strict=strict)
    except ValueError as e:
        raise RhidocError(f"Error computing moves: {e}")

    rename_map = compute_rename_map(moves, rhidoc_root)

    if args.dry_run:
        print_rename_map(rename_map, moves)
        print("\n(dry-run: no files modified)")
        if mkdir_created:
            shutil.rmtree(str(dest_path))
        return

    for old_path, new_path in moves:
        if old_path.exists():
            shutil.move(str(old_path), str(new_path))

    rewrite_results = rewrite_refs(collect_rewritable_files(rhidoc_root), rename_map)

    if not args.no_regen:
        do_regenerate(rhidoc_root, _load_preamble(rhidoc_root.name))

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

def cmd_rename(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Rename a directory or file slug without changing position."""
    target_path = resolve_and_validate(args.target, rhidoc_root).path

    _target_en = EntryName.parse(target_path.name)
    if _target_en is None:
        raise RhidocError(f"Error: target has no numeric prefix: {target_path.name}")
    prefix = _target_en.prefix

    new_slug = args.new_slug
    _new_en = EntryName.parse(new_slug)
    if _new_en is not None:
        new_slug = _new_en.tail

    if target_path.is_dir():
        new_name = f"{prefix:02d}-{new_slug}"
        new_path = target_path.parent / new_name
        if new_path.exists() and new_path.resolve() != target_path.resolve():
            raise RhidocError(f"Error: destination already exists: {new_path}")
        shutil.move(str(target_path), str(new_path))
        if not args.no_regen:
            do_regenerate(rhidoc_root, _load_preamble(rhidoc_root.name))
        print(f"Renamed: {target_path.name} -> {new_path.name}")
        return

    ext = target_path.suffix
    stem_slug = new_slug
    if stem_slug.endswith(ext):
        stem_slug = stem_slug[:-len(ext)]
    new_name = f"{prefix:02d}-{stem_slug}{ext}"
    new_path = target_path.parent / new_name

    if new_path.exists() and new_path.resolve() != target_path.resolve():
        raise RhidocError(f"Error: destination already exists: {new_path}")

    # Collect renames: root md + same-slug attachments
    renames: list[tuple[Path, Path]] = [(target_path, new_path)]
    unchanged: list[Path] = []

    bndl = bundle_mod.find_bundle(target_path)
    if bndl and bndl.slug:
        old_slug = bndl.slug
        for att in bndl.attachments:
            att_parsed = EntryName.parse(att.name)
            assert att_parsed is not None
            att_slug = att_parsed.tail
            if att_slug.startswith(old_slug + "."):
                new_att_slug = stem_slug + att_slug[len(old_slug):]
                renames.append((att, att.parent / f"{prefix:02d}-{new_att_slug}"))
            else:
                unchanged.append(att)

    for old, new in renames:
        shutil.move(str(old), str(new))

    if not args.no_regen:
        do_regenerate(rhidoc_root, _load_preamble(rhidoc_root.name))

    for old, new in renames:
        print(f"Renamed: {old.name} -> {new.name}")
    for att in unchanged:
        print(f"Left unchanged (same prefix, different slug): {att.name}")
