import re
from pathlib import Path


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
