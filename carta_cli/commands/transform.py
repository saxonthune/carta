"""carta — transform commands: punch, flatten, copy."""
import argparse
import re
import shutil
import sys
import tempfile
from pathlib import Path

from ..errors import CartaError
from ..frontmatter import read_frontmatter, write_frontmatter
from ..entries import resolve_arg, resolve_and_validate, list_numbered_entries
from ..numbering import compute_insertion_prefix
from ..docref import DocRef, EntryName
from ..rewriter import rewrite_refs
from ..planning import compute_rename_map
from ..workspace import collect_rewritable_files
from ..regenerate_core import do_regenerate
from .setup import _load_preamble
from .. import bundle as bundle_mod
from .._glyphs import for_stream


# ---------------------------------------------------------------------------
# punch
# ---------------------------------------------------------------------------

def cmd_punch(args: argparse.Namespace, carta_root: Path) -> None:
    """Expand leaf file into directory."""
    source_path = resolve_and_validate(args.target, carta_root).path

    if source_path.is_dir():
        raise CartaError(f"Error: source is already a directory: {source_path}")

    if not source_path.name.endswith(".md"):
        raise CartaError(f"Error: source is not a .md file: {source_path}")

    _src_en = EntryName.parse(source_path.name)
    if _src_en is None:
        raise CartaError(f"Error: source has no numeric prefix: {source_path.name}")
    prefix = _src_en.prefix

    dir_name = source_path.name[:-3]
    _dir_en = EntryName.parse(dir_name)
    slug = _dir_en.tail if _dir_en is not None else dir_name
    new_dir = source_path.parent / dir_name
    new_index = new_dir / "00-index.md"
    as_child = args.as_child

    if as_child:
        child_path = new_dir / f"01-{slug}.md"

    bndl = bundle_mod.find_bundle(source_path)
    attachments = list(bndl.attachments) if bndl else []
    att_prefix = 1 if as_child else 0
    glyphs = for_stream(sys.stdout)

    if args.dry_run:
        if as_child:
            print(f"Would punch: {source_path.name} {glyphs.arrow} {dir_name}/01-{slug}.md (content)")
            print(f"Would punch: {source_path.name} {glyphs.arrow} {dir_name}/00-index.md (generated index)")
        else:
            print(f"Would punch: {source_path.name} {glyphs.arrow} {dir_name}/00-index.md")
        for att in attachments:
            att_slug = EntryName.parse(att.name).tail
            print(f"Would move attachment: {att.name} {glyphs.arrow} {dir_name}/{att_prefix:02d}-{att_slug}")
        print("\n(dry-run: no files modified)")
        return

    new_dir.mkdir()

    if as_child:
        shutil.move(str(source_path), str(child_path))
        title = slug.replace("-", " ").title()
        write_frontmatter(new_index, {
            "title": title,
            "summary": "", "tags": [], "deps": [],
        }, f"\n# {title}\n")
        for att in attachments:
            att_slug = EntryName.parse(att.name).tail
            shutil.move(str(att), str(new_dir / f"{att_prefix:02d}-{att_slug}"))
        print(f"Punched: {source_path.name} {glyphs.arrow} {dir_name}/01-{slug}.md (content)")
        print(f"  Index: {dir_name}/00-index.md (generated)")
        if attachments:
            print(f"  Moved {len(attachments)} attachment(s) with prefix 01-")
    else:
        shutil.move(str(source_path), str(new_index))
        for att in attachments:
            att_slug = EntryName.parse(att.name).tail
            shutil.move(str(att), str(new_dir / f"{att_prefix:02d}-{att_slug}"))
        print(f"Punched: {source_path.name} {glyphs.arrow} {dir_name}/00-index.md")
        if attachments:
            print(f"  Moved {len(attachments)} attachment(s) with prefix 00-")


# ---------------------------------------------------------------------------
# flatten helpers
# ---------------------------------------------------------------------------

def _count_content_lines(path: Path) -> int:
    _, body = read_frontmatter(path)
    return sum(1 for line in body.splitlines() if line.strip())


def _flatten_bundle_moves(
    bndl: "bundle_mod.Bundle",
    new_prefix: int,
    dest_dir: Path,
    override_root_slug: "str | None" = None,
) -> "list[tuple[Path, Path]]":
    """Compute (old, new) path pairs for one bundle placed at new_prefix in dest_dir."""
    moves: list[tuple[Path, Path]] = []
    if bndl.is_directory_bundle:
        dir_path = bndl.attachments[0]
        new_path = dest_dir / f"{new_prefix:02d}-{EntryName.parse(dir_path.name).tail}"
        if dir_path.resolve() != new_path.resolve():
            moves.append((dir_path, new_path))
    else:
        if bndl.root is not None:
            slug = override_root_slug if override_root_slug is not None else EntryName.parse(bndl.root.name).tail
            new_path = dest_dir / f"{new_prefix:02d}-{slug}"
            if bndl.root.resolve() != new_path.resolve():
                moves.append((bndl.root, new_path))
        for att in bndl.attachments:
            att_slug = EntryName.parse(att.name).tail
            new_att = dest_dir / f"{new_prefix:02d}-{att_slug}"
            if att.resolve() != new_att.resolve():
                moves.append((att, new_att))
    return moves


def _flatten_stage_bundle(
    bndl: "bundle_mod.Bundle",
    new_prefix: int,
    dest_dir: Path,
    staging_path: Path,
    override_root_slug: "str | None",
    staged: "list[tuple[Path, Path]]",
) -> None:
    """Move all bundle members into staging_path, recording (stage, final) pairs."""
    if bndl.is_directory_bundle:
        dir_path = bndl.attachments[0]
        final_name = f"{new_prefix:02d}-{EntryName.parse(dir_path.name).tail}"
        stage_path = staging_path / final_name
        shutil.move(str(dir_path), str(stage_path))
        staged.append((stage_path, dest_dir / final_name))
    else:
        if bndl.root is not None:
            slug = override_root_slug if override_root_slug is not None else EntryName.parse(bndl.root.name).tail
            final_name = f"{new_prefix:02d}-{slug}"
            stage_path = staging_path / final_name
            shutil.move(str(bndl.root), str(stage_path))
            staged.append((stage_path, dest_dir / final_name))
        for att in bndl.attachments:
            att_slug = EntryName.parse(att.name).tail
            final_name = f"{new_prefix:02d}-{att_slug}"
            stage_att = staging_path / final_name
            shutil.move(str(att), str(stage_att))
            staged.append((stage_att, dest_dir / final_name))


# ---------------------------------------------------------------------------
# flatten
# ---------------------------------------------------------------------------

def cmd_flatten(args: argparse.Namespace, carta_root: Path) -> None:
    """Dissolve directory, hoist children."""
    source_path = resolve_and_validate(args.target, carta_root).path

    if not source_path.is_dir():
        raise CartaError(f"Error: source is not a directory: {source_path}")

    _flat_en = EntryName.parse(source_path.name)
    if _flat_en is None:
        raise CartaError(f"Error: source has no numeric prefix: {source_path.name}")
    source_prefix = _flat_en.prefix

    parent_dir = source_path.parent
    if args.before is not None:
        try:
            before_ref = DocRef.parse(args.before)
        except CartaError as e:
            raise CartaError(f"Invalid --before ref: {e}")
        insertion_start = before_ref.segments[-1]
    else:
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

    # Parent bundles: exclude the parent's own 00-index.md (prefix-0 file bundle)
    # and the source directory's slot. Directory bundles at prefix 0 (e.g. 00-codex/)
    # are kept and participate in renumbering like any other numbered entry.
    parent_bundles = [
        b for b in bundle_mod.list_bundles(parent_dir)
        if not (b.prefix == 0 and not b.is_directory_bundle)
        and not (b.is_directory_bundle
                 and b.attachments
                 and b.attachments[0].resolve() == source_path.resolve())
    ]
    before_bundles = [b for b in parent_bundles if b.prefix < insertion_start]
    after_bundles = [b for b in parent_bundles if b.prefix >= insertion_start]

    # Source children
    source_child_bundles = bundle_mod.list_bundles(source_path)
    dir_slug = EntryName.parse(source_path.name).tail

    index_bundle = next((b for b in source_child_bundles if b.prefix == 0), None)
    index_attachments: list[Path] = list(index_bundle.attachments) if index_bundle else []

    # Hoisted items: (Bundle, override_root_slug)
    # override_root_slug is used for the index under --keep-index to rename it to dir-slug.md
    hoisted: list[tuple["bundle_mod.Bundle", "str | None"]] = []

    if has_index and keep_index:
        ib = index_bundle or bundle_mod.Bundle(
            prefix=0, root=index_file, attachments=[], is_directory_bundle=False
        )
        hoisted.append((ib, dir_slug + ".md"))

    for b in source_child_bundles:
        if b.prefix == 0:
            continue
        hoisted.append((b, None))

    if not hoisted:
        raise CartaError("Error: no children to hoist.")

    # Final ordering: before parent bundles + hoisted source children + after parent bundles
    final_order: list[tuple["bundle_mod.Bundle", "str | None"]] = (
        [(b, None) for b in before_bundles]
        + hoisted
        + [(b, None) for b in after_bundles]
    )

    # Compute all moves (for rename map computation)
    moves: list[tuple[Path, Path]] = []
    for idx, (bndl, override_slug) in enumerate(final_order):
        new_prefix = idx + 1
        moves.extend(_flatten_bundle_moves(bndl, new_prefix, parent_dir, override_slug))

    rename_map = compute_rename_map(moves, carta_root)

    if args.dry_run:
        print("=== Planned flatten ===")
        print(f"Dissolving: {source_path.relative_to(carta_root)}")
        print(f"Children to hoist: {len(hoisted)}")
        if has_index:
            if keep_index:
                print(f"Index: kept as {dir_slug}.md")
            else:
                discard_msg = "Index: discarded"
                if index_attachments:
                    discard_msg += f" (+ {len(index_attachments)} attachment(s) discarded)"
                print(discard_msg)
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
        staged: list[tuple[Path, Path]] = []

        for idx, (bndl, override_slug) in enumerate(final_order):
            new_prefix = idx + 1
            _flatten_stage_bundle(bndl, new_prefix, parent_dir, staging_path, override_slug, staged)

        # Discard index and its attachments when not keeping index.
        # (They remain in source_path until rmtree, but explicit deletion makes intent clear.)
        if has_index and not keep_index:
            if index_file.exists():
                index_file.unlink()
            for att in index_attachments:
                if att.exists():
                    att.unlink()

        if source_path.exists():
            shutil.rmtree(str(source_path))

        for stage_path, final_path in staged:
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

    # Combination guards (mirror move)
    if args.at is not None and args.before is not None:
        raise CartaError("--at and --before are mutually exclusive")
    if (args.at is not None or args.before is not None) and args.destination is not None:
        raise CartaError("--at/--before takes its destination from the ref; do not also pass a destination")
    if args.at is None and args.before is None and args.destination is None:
        raise CartaError("provide a destination (append), or use --at/--before")

    rename_slug = args.rename_slug
    if rename_slug is None:
        _stem_en = EntryName.parse(source_path.stem)
        rename_slug = _stem_en.tail if _stem_en is not None else source_path.stem

    ext = source_path.suffix or ".md"

    shift_moves: list[tuple[Path, Path]] = []
    rename_map: dict[str, str] = {}

    if args.at is not None or args.before is not None:
        # Ref-addressed mode (--at or --before)
        ref_str = args.at if args.at is not None else args.before
        strict = (args.at is not None)
        try:
            ref = DocRef.parse(ref_str)
        except CartaError as e:
            raise CartaError(f"Invalid ref: {e}")
        target_prefix = ref.segments[-1]
        parent_segments = ref.segments[:-1]
        if parent_segments:
            parent_ref = DocRef(segments=parent_segments)
            try:
                dest_path = parent_ref.to_path(carta_root)
            except FileNotFoundError as e:
                raise CartaError(f"Error resolving parent from ref: {e}")
        else:
            dest_path = carta_root
        if not dest_path.is_dir():
            raise CartaError(f"Error: parent is not a directory: {dest_path}")

        # Index-slot guard
        if target_prefix == 0 and (dest_path / "00-index.md").exists():
            dest_label = dest_path.name if dest_path != carta_root else "(root)"
            raise CartaError(f"position 00 is reserved for 00-index.md in {dest_label}")

        if strict:
            # --at: occupancy check
            entries = list_numbered_entries(dest_path)
            occupied = {en.prefix for e in entries if (en := EntryName.parse(e.name))}
            if target_prefix in occupied:
                raise CartaError(
                    f"Error: position {target_prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
                    f"Occupied positions: {sorted(occupied)}"
                )
        else:
            # --before: build shift-up move-set
            bundles = bundle_mod.list_bundles(dest_path)
            for bndl in bundles:
                if bndl.prefix == 0:
                    continue
                if bndl.prefix < target_prefix:
                    continue
                all_members = ([bndl.root] if bndl.root else []) + list(bndl.attachments)
                for member in all_members:
                    tail = EntryName.parse(member.name).tail
                    new_name = f"{bndl.prefix + 1:02d}-{tail}"
                    shift_moves.append((member, dest_path / new_name))
            rename_map = compute_rename_map(shift_moves, carta_root)

        prefix = target_prefix
    else:
        # Append mode
        dest_path = resolve_and_validate(args.destination, carta_root).path
        if not dest_path.is_dir():
            raise CartaError(f"Error: destination is not a directory: {dest_path}")
        entries = list_numbered_entries(dest_path)
        prefix = compute_insertion_prefix(entries, None)
        # Strict occupancy check (append never collides, but guard for safety)
        occupied = {en.prefix for e in entries if (en := EntryName.parse(e.name))}
        if prefix in occupied:
            raise CartaError(
                f"Error: position {prefix:02d} is occupied in {dest_path.relative_to(carta_root)}.\n"
                f"Occupied positions: {sorted(occupied)}"
            )

    new_name = f"{prefix:02d}-{rename_slug}{ext}"
    new_path = dest_path / new_name

    if args.dry_run:
        print(f"Would copy: {source_path.name} -> {new_path.relative_to(carta_root)}")
        print(f"  Position: {prefix:02d}")
        print(f"  Slug: {rename_slug}")
        if shift_moves:
            print(f"\n=== Shift-up moves ({len(shift_moves)}) ===")
            for old, new in shift_moves:
                print(f"  {old.relative_to(carta_root)} -> {new.relative_to(carta_root)}")
        if rename_map:
            print(f"\n=== Ref rename map ({len(rename_map)} entries) ===")
            for old_ref, new_ref in sorted(rename_map.items()):
                print(f"  {old_ref} -> {new_ref}")
        print("\n(dry-run: no files modified)")
        return

    # Apply shift-up moves BEFORE placing the new file (--before path only)
    if shift_moves:
        for old_path, new_path_shift in reversed(shift_moves):
            if old_path.exists():
                shutil.move(str(old_path), str(new_path_shift))
        rewrite_refs(collect_rewritable_files(carta_root), rename_map)

    shutil.copy2(str(source_path), str(new_path))

    do_regenerate(carta_root, _load_preamble(carta_root.name))

    print(f"Copied: {source_path.name} -> {new_path.relative_to(carta_root)}")
    print(f"  Position: {prefix:02d}")
    if shift_moves:
        print(f"Shifted: {len(shift_moves)} sibling(s) renumbered")
    if rename_map:
        print(f"Rename map ({len(rename_map)} entries):")
        for old_ref, new_ref in sorted(rename_map.items()):
            print(f"  {old_ref} -> {new_ref}")

