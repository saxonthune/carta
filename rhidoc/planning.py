from pathlib import Path

from .docref import EntryName
from .entries import list_numbered_entries
from .docref import DocRef
from . import bundle as bundle_mod


def compute_all_moves(
    source_path: Path,
    dest_dir: Path,
    order: int | None,
    rename_slug: str | None = None,
    no_gap_close: bool = False,
    strict: bool = False,
) -> list[tuple[Path, Path]]:
    """Compute the complete list of (old_path, new_path) filesystem moves.

    Delegates to same-dir or cross-dir strategy based on whether the source's
    parent is the destination directory.

    Returns moves in execution-safe order.
    """
    _src_en = EntryName.parse(source_path.name)
    if _src_en is None:
        raise ValueError(f"Source has no numeric prefix: {source_path.name}")
    source_prefix = _src_en.prefix
    source_slug = _src_en.tail
    same_dir = source_path.parent.resolve() == dest_dir.resolve()

    if same_dir:
        return _compute_same_dir_moves(
            source_path, dest_dir, order, source_prefix, source_slug, rename_slug,
            strict=strict,
        )
    else:
        return _compute_cross_dir_moves(
            source_path, dest_dir, order, source_prefix, source_slug, rename_slug,
            no_gap_close=no_gap_close,
            strict=strict,
        )


def _compute_same_dir_moves(
    source_path: Path,
    dest_dir: Path,
    order: int | None,
    source_prefix: int,
    source_slug: str,
    rename_slug: str | None = None,
    strict: bool = False,
) -> list[tuple[Path, Path]]:
    """Compute moves for reordering within the same directory.

    Uses range-based logic: only items between the old and new positions
    are renumbered.  Items outside that range are untouched.

    Moving UP  (insertion < source): items in [insertion, source-1] get +1
    Moving DOWN (insertion > source): items in [source+1, insertion] get -1

    When strict=True, skip all sibling shifts — caller has already verified the slot
    is free.  The source moves to the exact target prefix; no gap-close of source slot.
    """
    if order is None:
        entries = list_numbered_entries(dest_dir)
        others = [e for e in entries if e.resolve() != source_path.resolve()]
        existing = [en.prefix for p in others if (en := EntryName.parse(p.name))]
        insertion_prefix = (max(existing) + 1) if existing else 1
    else:
        insertion_prefix = order

    if insertion_prefix == source_prefix:
        if rename_slug and rename_slug != source_slug:
            source_bundle = bundle_mod.find_bundle(source_path)
            if source_bundle is not None:
                return _compute_bundle_moves(source_bundle, dest_dir, source_prefix, rename_slug)
            effective = _apply_rename(source_slug, rename_slug)
            new_name = f"{source_prefix:02d}-{effective}"
            return [(source_path, dest_dir / new_name)]
        return []  # true no-op

    moves: list[tuple[Path, Path]] = []

    if not strict:
        entries = list_numbered_entries(dest_dir)
        if insertion_prefix < source_prefix:
            # Moving UP: shift items in [insertion, source-1] by +1, highest first
            candidates = [
                e for e in entries
                if (en := EntryName.parse(e.name)) is not None
                and insertion_prefix <= en.prefix <= source_prefix - 1
                and e.resolve() != source_path.resolve()
            ]
            for entry in sorted(candidates, key=lambda p: EntryName.parse(p.name).prefix, reverse=True):
                en = EntryName.parse(entry.name)
                new_name = f"{en.prefix + 1:02d}-{en.tail}"
                moves.append((entry, entry.parent / new_name))
        else:
            # Moving DOWN: shift items in [source+1, insertion] by -1, lowest first
            candidates = [
                e for e in entries
                if (en := EntryName.parse(e.name)) is not None
                and source_prefix + 1 <= en.prefix <= insertion_prefix
                and e.resolve() != source_path.resolve()
            ]
            for entry in sorted(candidates, key=lambda p: EntryName.parse(p.name).prefix):
                en = EntryName.parse(entry.name)
                new_name = f"{en.prefix - 1:02d}-{en.tail}"
                moves.append((entry, entry.parent / new_name))

    # Main move (last, after shifts free the slot) — expand to include bundle members
    source_bundle = bundle_mod.find_bundle(source_path)
    if source_bundle is not None:
        moves.extend(_compute_bundle_moves(source_bundle, dest_dir, insertion_prefix, rename_slug))
    else:
        effective_slug = _apply_rename(source_slug, rename_slug)
        new_name = f"{insertion_prefix:02d}-{effective_slug}"
        new_path = dest_dir / new_name
        if source_path.resolve() != new_path.resolve():
            moves.append((source_path, new_path))

    return moves


def _compute_bundle_moves(
    bndl: "bundle_mod.Bundle",
    new_dir: Path,
    new_prefix: int,
    rename_slug: str | None = None,
) -> list[tuple[Path, Path]]:
    """Expand a bundle into (old_path, new_path) pairs for root + all attachments.

    rename_slug: if given, renames root's slug and any same-slug attachments.
    Trivial no-op moves (old == new) are filtered out.
    """
    moves: list[tuple[Path, Path]] = []
    old_slug = bndl.slug  # stem only, e.g. "foo" for 01-foo.md

    if bndl.root is not None:
        file_slug = EntryName.parse(bndl.root.name).tail  # e.g. "foo.md"
        effective = _apply_rename(file_slug, rename_slug)
        new_path = new_dir / f"{new_prefix:02d}-{effective}"
        if bndl.root.resolve() != new_path.resolve():
            moves.append((bndl.root, new_path))

    for att in bndl.attachments:
        att_slug = EntryName.parse(att.name).tail  # e.g. "foo.json" or "bar.yaml"
        if rename_slug and old_slug and att_slug.startswith(old_slug + "."):
            new_att_slug = rename_slug + att_slug[len(old_slug):]
        else:
            new_att_slug = att_slug
        new_path = new_dir / f"{new_prefix:02d}-{new_att_slug}"
        if att.resolve() != new_path.resolve():
            moves.append((att, new_path))

    return moves


def _apply_rename(source_slug: str, rename_slug: str | None) -> str:
    """Apply a rename slug while preserving the original file extension.

    source_slug includes extension (e.g. "state.md"), rename_slug does not
    (e.g. "canvas-state").  If the source had an extension, carry it over.
    """
    if not rename_slug:
        return source_slug
    # Preserve extension from original slug (e.g. ".md")
    ext = ""
    dot = source_slug.rfind(".")
    if dot != -1 and "/" not in source_slug[dot:]:
        ext = source_slug[dot:]
    # Don't double-add extension if user already included it
    if ext and not rename_slug.endswith(ext):
        return rename_slug + ext
    return rename_slug


def _compute_cross_dir_moves(
    source_path: Path,
    dest_dir: Path,
    order: int | None,
    source_prefix: int,
    source_slug: str,
    rename_slug: str | None = None,
    no_gap_close: bool = False,
    strict: bool = False,
) -> list[tuple[Path, Path]]:
    """Compute moves for moving an entry to a different directory.

    Includes destination bumps, source gap-closing, and the main move.
    Accounts for dest_dir itself being renamed by gap-closing (cross-sibling case).

    When strict=True, skip destination sibling bumps — caller has verified the slot
    is free.  Source gap-close and the main move still apply.
    """
    if order is None:
        dest_entries = list_numbered_entries(dest_dir)
        existing_prefixes = [en.prefix for p in dest_entries if (en := EntryName.parse(p.name))]
        insertion_prefix = (max(existing_prefixes) + 1) if existing_prefixes else 1
    else:
        insertion_prefix = order

    effective_slug = _apply_rename(source_slug, rename_slug)
    new_source_name = f"{insertion_prefix:02d}-{effective_slug}"
    moves: list[tuple[Path, Path]] = []

    if not strict:
        # 1. Destination sibling bumps (prefix >= insertion_prefix), highest first
        dest_entries = list_numbered_entries(dest_dir)
        bump_candidates = [
            p for p in dest_entries
            if (en := EntryName.parse(p.name)) is not None and en.prefix >= insertion_prefix
        ]
        for entry in sorted(bump_candidates, key=lambda p: EntryName.parse(p.name).prefix, reverse=True):
            en = EntryName.parse(entry.name)
            new_name = f"{en.prefix + 1:02d}-{en.tail}"
            moves.append((entry, entry.parent / new_name))

    # 2. Source sibling gap-closing (prefix > source_prefix), lowest first
    if not no_gap_close:
        source_siblings = [
            p for p in list_numbered_entries(source_path.parent)
            if (en := EntryName.parse(p.name)) is not None
            and en.prefix > source_prefix
            and p.resolve() != source_path.resolve()
        ]
        for entry in sorted(source_siblings, key=lambda p: EntryName.parse(p.name).prefix):
            en = EntryName.parse(entry.name)
            new_name = f"{en.prefix - 1:02d}-{en.tail}"
            moves.append((entry, entry.parent / new_name))

    # 3. Main move — if dest_dir was gap-closed, use the renamed path
    actual_dest_dir = dest_dir
    for old, new in moves:
        if old.resolve() == dest_dir.resolve():
            actual_dest_dir = new
            break

    source_bundle = bundle_mod.find_bundle(source_path)
    if source_bundle is not None:
        moves.extend(_compute_bundle_moves(source_bundle, actual_dest_dir, insertion_prefix, rename_slug))
    else:
        moves.append((source_path, actual_dest_dir / new_source_name))

    return moves


def print_rename_map(rename_map: dict[str, str], moves: list[tuple[Path, Path]]) -> None:
    """Print the planned rename map and filesystem moves."""
    print("=== Planned filesystem moves ===")
    for old, new in moves:
        print(f"  {old} -> {new}")
    print()
    print("=== Ref rename map ===")
    for old_ref, new_ref in sorted(rename_map.items()):
        print(f"  {old_ref} -> {new_ref}")


def trace_path(original: Path, moves: list[tuple[Path, Path]]) -> Path:
    """Trace an original path through a sequence of execution-ordered moves.

    Handles cascading renames: if a parent directory is moved after a child
    was bumped, the child's final path reflects both operations.

    Uses ``Path.relative_to`` to detect when ``current`` is equal to or nested
    under a move's ``old`` path, then rebases it under ``new``.
    """
    current = original
    for old, new in moves:
        try:
            rel = current.relative_to(old)
            current = new / rel
        except ValueError:
            pass  # old is not a prefix of current
    return current


def compute_rename_map(
    moves: list[tuple[Path, Path]],
    rhidoc_root: Path,
) -> dict[str, str]:
    """Given a list of (old_path, new_path) filesystem moves, compute
    the complete {old_ref: new_ref} map.

    Uses ``trace_path`` to compose cascading renames correctly.  For example,
    if a child is bumped inside a directory that is also gap-closed, the
    child's final ref accounts for both operations.
    """
    seen: set[str] = set()
    result: dict[str, str] = {}

    for old_path, _ in moves:
        items = [old_path]
        if old_path.is_dir():
            items.extend(old_path.rglob("*"))

        for item in items:
            resolved = str(item.resolve())
            if resolved in seen:
                continue
            seen.add(resolved)

            final = trace_path(item, moves)
            try:
                old_ref = str(DocRef.from_path(item, rhidoc_root))
                new_ref = str(DocRef.from_path(final, rhidoc_root))
                # Skip sidecar display refs — they are not written into .md files
                if "/" in old_ref or "/" in new_ref:
                    continue
                if old_ref != new_ref:
                    result[old_ref] = new_ref
            except ValueError:
                pass  # skip non-ref paths

    return result
