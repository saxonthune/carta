from pathlib import Path

from .numbering import get_numeric_prefix, get_slug
from .entries import list_numbered_entries
from .ref_convert import path_to_ref


def compute_all_moves(
    source_path: Path,
    dest_dir: Path,
    order: int | None,
    rename_slug: str | None = None,
) -> list[tuple[Path, Path]]:
    """Compute the complete list of (old_path, new_path) filesystem moves.

    Delegates to same-dir or cross-dir strategy based on whether the source's
    parent is the destination directory.

    Returns moves in execution-safe order.
    """
    source_prefix = get_numeric_prefix(source_path.name)
    if source_prefix is None:
        raise ValueError(f"Source has no numeric prefix: {source_path.name}")

    source_slug = get_slug(source_path.name)
    same_dir = source_path.parent.resolve() == dest_dir.resolve()

    if same_dir:
        return _compute_same_dir_moves(
            source_path, dest_dir, order, source_prefix, source_slug, rename_slug,
        )
    else:
        return _compute_cross_dir_moves(
            source_path, dest_dir, order, source_prefix, source_slug, rename_slug,
        )


def _compute_same_dir_moves(
    source_path: Path,
    dest_dir: Path,
    order: int | None,
    source_prefix: int,
    source_slug: str,
    rename_slug: str | None = None,
) -> list[tuple[Path, Path]]:
    """Compute moves for reordering within the same directory.

    Uses range-based logic: only items between the old and new positions
    are renumbered.  Items outside that range are untouched.

    Moving UP  (insertion < source): items in [insertion, source-1] get +1
    Moving DOWN (insertion > source): items in [source+1, insertion] get -1
    """
    if order is None:
        entries = list_numbered_entries(dest_dir)
        others = [e for e in entries if e.resolve() != source_path.resolve()]
        existing = [get_numeric_prefix(p.name) for p in others]
        insertion_prefix = (max(existing) + 1) if existing else 1
    else:
        insertion_prefix = order

    if insertion_prefix == source_prefix:
        if rename_slug and rename_slug != source_slug:
            new_name = f"{source_prefix:02d}-{rename_slug}"
            return [(source_path, dest_dir / new_name)]
        return []  # true no-op

    moves: list[tuple[Path, Path]] = []
    entries = list_numbered_entries(dest_dir)

    if insertion_prefix < source_prefix:
        # Moving UP: shift items in [insertion, source-1] by +1, highest first
        candidates = [
            e for e in entries
            if insertion_prefix <= get_numeric_prefix(e.name) <= source_prefix - 1
            and e.resolve() != source_path.resolve()
        ]
        for entry in sorted(candidates, key=lambda p: get_numeric_prefix(p.name), reverse=True):
            pfx = get_numeric_prefix(entry.name)
            new_name = f"{pfx + 1:02d}-{get_slug(entry.name)}"
            moves.append((entry, entry.parent / new_name))
    else:
        # Moving DOWN: shift items in [source+1, insertion] by -1, lowest first
        candidates = [
            e for e in entries
            if source_prefix + 1 <= get_numeric_prefix(e.name) <= insertion_prefix
            and e.resolve() != source_path.resolve()
        ]
        for entry in sorted(candidates, key=lambda p: get_numeric_prefix(p.name)):
            pfx = get_numeric_prefix(entry.name)
            new_name = f"{pfx - 1:02d}-{get_slug(entry.name)}"
            moves.append((entry, entry.parent / new_name))

    # Main move (last, after shifts free the slot)
    effective_slug = rename_slug if rename_slug else source_slug
    new_name = f"{insertion_prefix:02d}-{effective_slug}"
    moves.append((source_path, dest_dir / new_name))

    return moves


def _compute_cross_dir_moves(
    source_path: Path,
    dest_dir: Path,
    order: int | None,
    source_prefix: int,
    source_slug: str,
    rename_slug: str | None = None,
) -> list[tuple[Path, Path]]:
    """Compute moves for moving an entry to a different directory.

    Includes destination bumps, source gap-closing, and the main move.
    Accounts for dest_dir itself being renamed by gap-closing (cross-sibling case).
    """
    if order is None:
        dest_entries = list_numbered_entries(dest_dir)
        existing_prefixes = [get_numeric_prefix(p.name) for p in dest_entries]
        insertion_prefix = (max(existing_prefixes) + 1) if existing_prefixes else 1
    else:
        insertion_prefix = order

    effective_slug = rename_slug if rename_slug else source_slug
    new_source_name = f"{insertion_prefix:02d}-{effective_slug}"
    moves: list[tuple[Path, Path]] = []

    # 1. Destination sibling bumps (prefix >= insertion_prefix), highest first
    dest_entries = list_numbered_entries(dest_dir)
    bump_candidates = [
        p for p in dest_entries
        if get_numeric_prefix(p.name) >= insertion_prefix
    ]
    for entry in sorted(bump_candidates, key=lambda p: get_numeric_prefix(p.name), reverse=True):
        old_prefix = get_numeric_prefix(entry.name)
        new_name = f"{old_prefix + 1:02d}-{get_slug(entry.name)}"
        moves.append((entry, entry.parent / new_name))

    # 2. Source sibling gap-closing (prefix > source_prefix), lowest first
    source_siblings = [
        p for p in list_numbered_entries(source_path.parent)
        if get_numeric_prefix(p.name) > source_prefix
        and p.resolve() != source_path.resolve()
    ]
    for entry in sorted(source_siblings, key=lambda p: get_numeric_prefix(p.name)):
        old_prefix = get_numeric_prefix(entry.name)
        new_name = f"{old_prefix - 1:02d}-{get_slug(entry.name)}"
        moves.append((entry, entry.parent / new_name))

    # 3. Main move — if dest_dir was gap-closed, use the renamed path
    actual_dest_dir = dest_dir
    for old, new in moves:
        if old.resolve() == dest_dir.resolve():
            actual_dest_dir = new
            break

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
    carta_root: Path,
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
                old_ref = path_to_ref(item, carta_root)
                new_ref = path_to_ref(final, carta_root)
                if old_ref != new_ref:
                    result[old_ref] = new_ref
            except ValueError:
                pass  # skip non-ref paths

    return result
