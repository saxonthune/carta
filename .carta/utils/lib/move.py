"""move.py — move-specific helpers for computing filesystem moves.

These functions are reusable by the move, punch, and flatten commands.
"""

import re
from pathlib import Path


# ---------------------------------------------------------------------------
# Ref argument resolution
# ---------------------------------------------------------------------------

_REF_RE = re.compile(r'^doc\d{2}(\.\d{2})*$')


def resolve_arg(arg: str, carta_root: Path) -> Path:
    """Resolve a ref or relative path argument to an absolute filesystem path."""
    from .refs import ref_to_path
    if _REF_RE.match(arg):
        return ref_to_path(arg, carta_root)
    # Treat as path relative to carta_root
    path = (carta_root / arg).resolve()
    return path


# ---------------------------------------------------------------------------
# Numeric prefix helpers
# ---------------------------------------------------------------------------

def get_numeric_prefix(name: str) -> int | None:
    """Extract the leading 2-digit numeric prefix from a directory entry name."""
    m = re.match(r'^(\d{2})-', name)
    return int(m.group(1)) if m else None


def get_slug(name: str) -> str:
    """Get everything after NN- from a directory entry name."""
    m = re.match(r'^\d{2}-(.*)', name)
    return m.group(1) if m else name


def list_numbered_entries(directory: Path) -> list[Path]:
    """Return directory entries that have a 2-digit numeric prefix, sorted by prefix."""
    entries = [
        p for p in directory.iterdir()
        if get_numeric_prefix(p.name) is not None
    ]
    return sorted(entries, key=lambda p: get_numeric_prefix(p.name))


def compute_insertion_prefix(dest_dir: Path, order: int | None) -> int:
    """Compute the numeric prefix for the new item in dest_dir.

    If order is None, appends (max_existing + 1).
    If order is given, inserts at that position.
    """
    entries = list_numbered_entries(dest_dir)
    existing_prefixes = [get_numeric_prefix(p.name) for p in entries]

    if order is None:
        return (max(existing_prefixes) + 1) if existing_prefixes else 1
    return order


# ---------------------------------------------------------------------------
# Move computation
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def print_rename_map(rename_map: dict[str, str], moves: list[tuple[Path, Path]]) -> None:
    """Print the planned rename map and filesystem moves."""
    print("=== Planned filesystem moves ===")
    for old, new in moves:
        print(f"  {old} -> {new}")
    print()
    print("=== Ref rename map ===")
    for old_ref, new_ref in sorted(rename_map.items()):
        print(f"  {old_ref} -> {new_ref}")
