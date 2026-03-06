import re
import uuid
from pathlib import Path


def collect_md_files(carta_root: Path, external_paths: list[Path]) -> list[Path]:
    """Return all .md files to scan for ref updates.

    Includes all .md files under carta_root (excluding .state/),
    plus the external_paths resolved from workspace.json.
    """
    excluded_dirs = {
        carta_root / ".state",
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
