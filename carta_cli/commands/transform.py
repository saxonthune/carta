"""carta — transform commands: punch, flatten, group, copy."""
import argparse
import re
import shutil
import tempfile
from pathlib import Path

from ..errors import CartaError
from ..frontmatter import read_frontmatter, write_frontmatter
from ..entries import resolve_arg, resolve_and_validate, list_numbered_entries
from ..numbering import get_numeric_prefix, get_slug, compute_insertion_prefix
from ..rewriter import rewrite_refs
from ..planning import compute_rename_map
from ..workspace import collect_rewritable_files
from ..regenerate_core import do_regenerate
from .setup import _load_preamble
from .. import bundle as bundle_mod


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
    slug = get_slug(dir_name)
    new_dir = source_path.parent / dir_name
    new_index = new_dir / "00-index.md"
    as_child = args.as_child

    if as_child:
        child_path = new_dir / f"01-{slug}.md"

    bndl = bundle_mod.find_bundle(source_path)
    attachments = list(bndl.attachments) if bndl else []
    att_prefix = 1 if as_child else 0

    if args.dry_run:
        if as_child:
            print(f"Would punch: {source_path.name} → {dir_name}/01-{slug}.md (content)")
            print(f"Would punch: {source_path.name} → {dir_name}/00-index.md (generated index)")
        else:
            print(f"Would punch: {source_path.name} → {dir_name}/00-index.md")
        for att in attachments:
            att_slug = get_slug(att.name)
            print(f"Would move attachment: {att.name} → {dir_name}/{att_prefix:02d}-{att_slug}")
        print("\n(dry-run: no files modified)")
        return

    new_dir.mkdir()

    if as_child:
        shutil.move(str(source_path), str(child_path))
        title = slug.replace("-", " ").title()
        write_frontmatter(new_index, {
            "title": title, "status": "draft",
            "summary": "", "tags": [], "deps": [],
        }, f"\n# {title}\n")
        for att in attachments:
            att_slug = get_slug(att.name)
            shutil.move(str(att), str(new_dir / f"{att_prefix:02d}-{att_slug}"))
        print(f"Punched: {source_path.name} → {dir_name}/01-{slug}.md (content)")
        print(f"  Index: {dir_name}/00-index.md (generated)")
        if attachments:
            print(f"  Moved {len(attachments)} attachment(s) with prefix 01-")
    else:
        shutil.move(str(source_path), str(new_index))
        for att in attachments:
            att_slug = get_slug(att.name)
            shutil.move(str(att), str(new_dir / f"{att_prefix:02d}-{att_slug}"))
        print(f"Punched: {source_path.name} → {dir_name}/00-index.md")
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
        new_path = dest_dir / f"{new_prefix:02d}-{get_slug(dir_path.name)}"
        if dir_path.resolve() != new_path.resolve():
            moves.append((dir_path, new_path))
    else:
        if bndl.root is not None:
            slug = override_root_slug if override_root_slug is not None else get_slug(bndl.root.name)
            new_path = dest_dir / f"{new_prefix:02d}-{slug}"
            if bndl.root.resolve() != new_path.resolve():
                moves.append((bndl.root, new_path))
        for att in bndl.attachments:
            att_slug = get_slug(att.name)
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
        final_name = f"{new_prefix:02d}-{get_slug(dir_path.name)}"
        stage_path = staging_path / final_name
        shutil.move(str(dir_path), str(stage_path))
        staged.append((stage_path, dest_dir / final_name))
    else:
        if bndl.root is not None:
            slug = override_root_slug if override_root_slug is not None else get_slug(bndl.root.name)
            final_name = f"{new_prefix:02d}-{slug}"
            stage_path = staging_path / final_name
            shutil.move(str(bndl.root), str(stage_path))
            staged.append((stage_path, dest_dir / final_name))
        for att in bndl.attachments:
            att_slug = get_slug(att.name)
            final_name = f"{new_prefix:02d}-{att_slug}"
            stage_att = staging_path / final_name
            shutil.move(str(att), str(stage_att))
            staged.append((stage_att, dest_dir / final_name))


# ---------------------------------------------------------------------------
# flatten
# ---------------------------------------------------------------------------

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
    dir_slug = get_slug(source_path.name)

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
