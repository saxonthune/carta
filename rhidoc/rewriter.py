import re
import uuid
from pathlib import Path

from .docref import DocRef


# Inline markdown link target: the `path` in `](path)` or `](<path>)`. Targets with
# spaces (e.g. a `](path "title")` form) don't match and are left untouched — file
# links have no spaces, so this stays conservative.
_MD_LINK_RE = re.compile(r'\]\((?P<lb><)?(?P<target>[^)\s>]+)(?P<rb>>)?\)')


def _resolved_link_path(linking_file: Path, target: str) -> Path | None:
    """Resolve a link target to an absolute path, or None if it isn't a local path.

    Drops the anchor, and skips URLs and mailto: — only workspace-relative file
    links are candidates. Path math only; the target need not exist.
    """
    clean = target.split('#', 1)[0].strip()
    if not clean or '://' in clean or clean.startswith('mailto:'):
        return None
    return (linking_file.parent / clean).resolve()


def find_relative_link_breaks(
    files: list[Path],
    renames: list[tuple[Path, Path]],
) -> list[tuple[Path, str]]:
    """Find inline relative links whose target resolves to a rename's old path.

    Returns (linking_file, target_str) pairs. Scan the files BEFORE executing the
    moves, while their targets still resolve against the current tree.
    """
    old_paths = {old.resolve() for old, _ in renames}
    breaks: list[tuple[Path, str]] = []
    for fpath in files:
        try:
            text = fpath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for m in _MD_LINK_RE.finditer(text):
            resolved = _resolved_link_path(fpath, m.group('target'))
            if resolved is not None and resolved in old_paths:
                breaks.append((fpath, m.group('target')))
    return breaks


def rewrite_relative_links(
    files: list[Path],
    renames: list[tuple[Path, Path]],
) -> dict[Path, int]:
    """Rewrite inline relative links whose target resolves to a rename's old path.

    Swaps the target's final path segment for the new basename, preserving the
    directory portion and any anchor. Safe only when the file stays in place (rename),
    so the directory portion of every link is still correct. Returns {file: count}.
    """
    old_to_new = {old.resolve(): new for old, new in renames if old.name != new.name}
    if not old_to_new:
        return {}

    results: dict[Path, int] = {}
    for fpath in files:
        try:
            text = fpath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        count = 0

        def repl(m: re.Match) -> str:
            nonlocal count
            resolved = _resolved_link_path(fpath, m.group('target'))
            new_path = old_to_new.get(resolved) if resolved is not None else None
            if new_path is None:
                return m.group(0)
            path_part, sep, anchor = m.group('target').partition('#')
            segments = path_part.rsplit('/', 1)
            segments[-1] = new_path.name
            new_target = '/'.join(segments) + sep + anchor
            count += 1
            return f']({m.group("lb") or ""}{new_target}{m.group("rb") or ""})'

        new_text = _MD_LINK_RE.sub(repl, text)
        if count:
            fpath.write_text(new_text, encoding="utf-8")
            results[fpath] = count

    return results


def collect_md_files(rhidoc_root: Path, external_paths: list[Path]) -> list[Path]:
    """Return all .md files to scan for ref updates.

    Includes all .md files under rhidoc_root (excluding .state/),
    plus the external_paths resolved from workspace.json.
    """
    excluded_dirs = {
        rhidoc_root / ".state",
    }

    files: list[Path] = []
    for md in rhidoc_root.rglob("*.md"):
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


def rewrite_refs(
    files: list[Path],
    rename_map: dict[DocRef, DocRef],
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
    placeholders: dict[DocRef, tuple] = {}
    for old, new in rename_map.items():
        ph = f"__RHIDOCREF_{uuid.uuid4().hex[:8]}__"
        placeholders[old] = (old.matcher(), ph, new)

    # Sort by length descending so longer refs are replaced first
    sorted_old = sorted(placeholders.keys(), key=lambda r: len(str(r)), reverse=True)

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
            text = text.replace(ph, str(new_ref))

        if text != original:
            fpath.write_text(text, encoding="utf-8")
            results[fpath] = count

    return results


def apply_rename_to_text(text: str, rename_map: dict[DocRef, DocRef]) -> str:
    """Apply a rename map to a text string using the same two-pass strategy.

    Useful for updating verbatim content (e.g. MANIFEST.md preamble, tag index)
    without writing to disk.
    """
    if not rename_map:
        return text

    placeholders: dict[DocRef, tuple] = {}
    for old, new in rename_map.items():
        ph = f"__RHIDOCREF_{uuid.uuid4().hex[:8]}__"
        placeholders[old] = (old.matcher(), ph, new)

    sorted_old = sorted(placeholders.keys(), key=lambda r: len(str(r)), reverse=True)

    # Pass 1: old refs → placeholders
    for old_ref in sorted_old:
        pattern, ph, _ = placeholders[old_ref]
        text = pattern.sub(ph, text)

    # Pass 2: placeholders → new refs
    for old_ref in sorted_old:
        _, ph, new_ref = placeholders[old_ref]
        text = text.replace(ph, str(new_ref))

    return text
