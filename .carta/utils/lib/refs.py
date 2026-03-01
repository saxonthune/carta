"""refs.py — ref resolution, rename map computation, and two-pass ref rewriting."""

import re
import uuid
from pathlib import Path


# ---------------------------------------------------------------------------
# Ref ↔ Path conversion
# ---------------------------------------------------------------------------

def ref_to_path(ref: str, carta_root: Path) -> Path:
    """Convert a doc ref (e.g. doc02.06) to a filesystem path.

    Walks the filesystem matching each 2-digit segment to a directory or file
    entry with that numeric prefix. Returns the matching path (file or dir).

    Raises FileNotFoundError if any segment cannot be resolved.
    """
    if not ref.startswith("doc"):
        raise ValueError(f"Invalid ref (must start with 'doc'): {ref!r}")
    without_doc = ref[3:]  # e.g. "02.06" or "01" or "02.04.01"
    segments = without_doc.split(".")

    current = carta_root
    for seg in segments:
        prefix = seg + "-"
        matches = [p for p in current.iterdir() if p.name.startswith(prefix)]
        if not matches:
            raise FileNotFoundError(
                f"Cannot resolve segment {seg!r} in {current}: "
                f"no entry starting with {prefix!r}"
            )
        if len(matches) > 1:
            raise FileNotFoundError(
                f"Ambiguous segment {seg!r} in {current}: "
                f"multiple matches: {[p.name for p in matches]}"
            )
        current = matches[0]

    return current


def path_to_ref(path: Path, carta_root: Path) -> str:
    """Convert a filesystem path to a doc ref (e.g. doc02.06).

    Extracts the leading 2-digit numeric prefix from each path component
    relative to carta_root. Strips .md extension before extracting.

    Raises ValueError if any component lacks a 2-digit prefix.
    """
    rel = path.relative_to(carta_root)
    parts = list(rel.parts)

    segments = []
    for part in parts:
        # Strip .md extension
        stem = part[:-3] if part.endswith(".md") else part
        # Must start with NN-
        m = re.match(r'^(\d{2})-', stem)
        if not m:
            raise ValueError(
                f"Path component {part!r} does not have a 2-digit numeric prefix"
            )
        segments.append(m.group(1))

    return "doc" + ".".join(segments)


# ---------------------------------------------------------------------------
# Rename map computation
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# File collection
# ---------------------------------------------------------------------------

def collect_md_files(carta_root: Path, external_paths: list[Path]) -> list[Path]:
    """Return all .md files to scan for ref updates.

    Includes all .md files under carta_root (excluding .state/ and utils/),
    plus the external_paths resolved from workspace.json.
    """
    excluded_dirs = {
        carta_root / ".state",
        carta_root / "utils",
    }

    files: list[Path] = []
    for md in carta_root.rglob("*.md"):
        # Skip if any excluded dir is an ancestor
        if any(
            md == excl or excl in md.parents
            for excl in excluded_dirs
        ):
            continue
        files.append(md)

    # Add external paths (deduplicate)
    seen = set(files)
    for p in external_paths:
        if p not in seen and p.suffix == ".md":
            files.append(p)
            seen.add(p)

    return files


# ---------------------------------------------------------------------------
# Two-pass ref rewriting
# ---------------------------------------------------------------------------

def rewrite_refs(
    files: list[Path],
    rename_map: dict[str, str],
) -> dict[Path, int]:
    """Rewrite doc refs in files using a two-pass placeholder strategy.

    Pass 1: Replace each old_ref with a unique placeholder using a
            word-boundary-aware regex. Process longer refs first to avoid
            partial matches (e.g. doc03.01 before doc03).

    Pass 2: Replace placeholders with their corresponding new_ref values.

    Returns {file_path: num_replacements_made} for files that were modified.
    """
    if not rename_map:
        return {}

    # Build placeholder map: old_ref -> (compiled_pattern, placeholder, new_ref)
    placeholders: dict[str, tuple] = {}
    for old, new in rename_map.items():
        ph = f"__CARTAREF_{uuid.uuid4().hex[:8]}__"
        # Word-boundary-aware: preceded by non-word char (or start),
        # not followed by a digit-after-dot (avoids partial matches on longer refs)
        pattern = re.compile(r'(?<!\w)' + re.escape(old) + r'(?!\.[a-zA-Z0-9])')
        placeholders[old] = (pattern, ph, new)

    # Sort by length descending so longer refs are replaced first
    sorted_old = sorted(placeholders.keys(), key=len, reverse=True)

    results: dict[Path, int] = {}
    for fpath in files:
        try:
            text = fpath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        original = text
        count = 0

        # Pass 1: old refs → unique placeholders
        for old_ref in sorted_old:
            pattern, ph, _ = placeholders[old_ref]
            text, n = pattern.subn(ph, text)
            count += n

        # Pass 2: placeholders → new refs
        for old_ref in sorted_old:
            _, ph, new_ref = placeholders[old_ref]
            text = text.replace(ph, new_ref)

        if text != original:
            fpath.write_text(text, encoding="utf-8")
            results[fpath] = count

    return results


def apply_rename_to_text(text: str, rename_map: dict[str, str]) -> str:
    """Apply a rename map to a text string using the same two-pass strategy.

    Useful for updating verbatim content (e.g. MANIFEST.md preamble, tag index)
    without writing to disk.
    """
    if not rename_map:
        return text

    placeholders: dict[str, tuple] = {}
    for old, new in rename_map.items():
        ph = f"__CARTAREF_{uuid.uuid4().hex[:8]}__"
        pattern = re.compile(r'(?<!\w)' + re.escape(old) + r'(?!\.[a-zA-Z0-9])')
        placeholders[old] = (pattern, ph, new)

    sorted_old = sorted(placeholders.keys(), key=len, reverse=True)

    # Pass 1: old refs → placeholders
    for old_ref in sorted_old:
        pattern, ph, _ = placeholders[old_ref]
        text = pattern.sub(ph, text)

    # Pass 2: placeholders → new refs
    for old_ref in sorted_old:
        _, ph, new_ref = placeholders[old_ref]
        text = text.replace(ph, new_ref)

    return text
