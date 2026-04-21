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
            # With bundle attachments, multiple files can share a prefix.
            # Prefer the .md root or a directory (the canonical doc node).
            md_or_dir = [p for p in matches if p.suffix == '.md' or p.is_dir()]
            if len(md_or_dir) == 1:
                matches = md_or_dir
            else:
                raise FileNotFoundError(
                    f"Ambiguous segment {seg!r} in {current}: "
                    f"multiple matches: {[p.name for p in matches]}"
                )
        current = matches[0]

    return current


def path_to_ref(path: Path, carta_root: Path) -> str:
    """Convert a filesystem path to a doc ref (e.g. doc02.06).

    For .md files and directories: extracts the leading 2-digit numeric prefix
    from each path component relative to carta_root.

    For non-md numbered attachments (sidecars): returns doc<parent-ref>/<slug>.<ext>,
    where <parent-ref> includes the host's numeric prefix. The sidecar must have a
    corresponding .md host (orphan sidecars raise ValueError).

    Raises ValueError if any component lacks a 2-digit prefix.
    """
    rel = path.relative_to(carta_root)
    parts = list(rel.parts)

    # Detect sidecar: last component is non-md with a NN- prefix
    last = parts[-1]
    if not last.endswith('.md') and len(parts) >= 2:
        sidecar_m = re.match(r'^(\d{2})-(.*?)(\.[^.]+)$', last)
        if sidecar_m:
            prefix_str = sidecar_m.group(1)
            slug = sidecar_m.group(2)
            ext = sidecar_m.group(3)

            # Validate: must have a .md host with same prefix (not an orphan)
            parent_dir = path.parent
            has_md_root = any(
                p.suffix == '.md' and p.name.startswith(f"{prefix_str}-")
                for p in parent_dir.iterdir()
            )
            if not has_md_root:
                raise ValueError(
                    f"Sidecar {last!r} is an orphan — no host .md with prefix {prefix_str}"
                )

            # Segments = parent dir segments + sidecar prefix
            parent_parts = parts[:-1]
            segments = []
            for part in parent_parts:
                stem = part[:-3] if part.endswith(".md") else part
                m = re.match(r'^(\d{2})-', stem)
                if not m:
                    raise ValueError(
                        f"Path component {part!r} does not have a 2-digit numeric prefix"
                    )
                segments.append(m.group(1))
            segments.append(prefix_str)

            return "doc" + ".".join(segments) + f"/{slug}{ext}"

    # Standard logic for .md files and directories
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
