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
# flatten helpers
# ---------------------------------------------------------------------------

def _count_content_lines(path: Path) -> int:
    _, body = read_frontmatter(path)
    return sum(1 for line in body.splitlines() if line.strip())


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
