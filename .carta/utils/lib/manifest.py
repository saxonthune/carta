"""manifest.py — MANIFEST.md structural parsing and rewriting.

Parses MANIFEST.md into a chunk-based representation, applies ref renames
and File column updates, then serializes back to markdown.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path

from .refs import ref_to_path, apply_rename_to_text


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ManifestRow:
    """One data row in a MANIFEST.md table."""
    ref: str       # e.g. "doc02.06"
    file: str      # e.g. "`06-metamodel.md`" (backtick-wrapped relative path)
    summary: str
    tags: str
    deps: str      # e.g. "doc01.02" or "—"

    def to_line(self) -> str:
        return f"| {self.ref} | {self.file} | {self.summary} | {self.tags} | {self.deps} |"


@dataclass
class ManifestSection:
    """A top-level section (## heading) in MANIFEST.md.

    `chunks` is an ordered list where each item is either:
    - str: a verbatim line (blank lines, sub-headers, table headers/separators, prose)
    - ManifestRow: a parsed data row
    """
    header: str               # e.g. "## 00-codex — Meta-documentation"
    title_dir_num: str        # e.g. "00" (or "" for non-numbered sections)
    chunks: list              # list[str | ManifestRow]


@dataclass
class ManifestData:
    """Parsed MANIFEST.md."""
    preamble: list[str]              # lines before the first ## section
    sections: list[ManifestSection]  # all sections in order


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

_SECTION_RE = re.compile(r'^## (\d{2})-\S+')
_ROW_RE = re.compile(r'^\| (doc\S+) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$')


def _parse_row(line: str) -> ManifestRow | None:
    """Try to parse a MANIFEST data row. Returns None for header/separator lines."""
    m = _ROW_RE.match(line.strip())
    if not m:
        return None
    return ManifestRow(
        ref=m.group(1).strip(),
        file=m.group(2).strip(),
        summary=m.group(3).strip(),
        tags=m.group(4).strip(),
        deps=m.group(5).strip(),
    )


def parse_manifest(manifest_path: Path) -> ManifestData:
    """Parse MANIFEST.md into a ManifestData structure."""
    lines = manifest_path.read_text(encoding="utf-8").splitlines(keepends=True)

    preamble: list[str] = []
    sections: list[ManifestSection] = []
    current_section: ManifestSection | None = None

    for raw_line in lines:
        line = raw_line.rstrip("\n").rstrip("\r")

        # Check for a new ## section
        m_section = re.match(r'^## (.+)', line)
        if m_section:
            if current_section is not None:
                sections.append(current_section)
            # Determine numeric prefix (if any)
            m_num = _SECTION_RE.match(line)
            num = m_num.group(1) if m_num else ""
            current_section = ManifestSection(
                header=line,
                title_dir_num=num,
                chunks=[],
            )
            continue

        if current_section is None:
            preamble.append(raw_line)
            continue

        # Try to parse as a data row
        row = _parse_row(line)
        if row is not None:
            current_section.chunks.append(row)
        else:
            current_section.chunks.append(raw_line)

    if current_section is not None:
        sections.append(current_section)

    return ManifestData(preamble=preamble, sections=sections)


# ---------------------------------------------------------------------------
# Applying renames
# ---------------------------------------------------------------------------

def _find_section_dir(title_dir_num: str, carta_root: Path) -> Path | None:
    """Find the actual directory in carta_root that starts with NN-."""
    prefix = title_dir_num + "-"
    for p in carta_root.iterdir():
        if p.is_dir() and p.name.startswith(prefix):
            return p
    return None


def _compute_file_column(new_ref: str, carta_root: Path) -> str:
    """Compute the File column value for a new ref, post-move.

    Returns a backtick-wrapped path relative to the section directory.
    """
    # ref_to_path and apply_rename_to_text imported at module top

    section_num = new_ref[3:5]  # "02" from "doc02.06"
    section_dir = _find_section_dir(section_num, carta_root)
    if section_dir is None:
        # Can't determine section dir — return a placeholder
        return f"`{new_ref}`"

    try:
        new_path = ref_to_path(new_ref, carta_root)
        rel = new_path.relative_to(section_dir)
        rel_str = str(rel).replace("\\", "/")
        if new_path.is_dir():
            rel_str += "/"
        return f"`{rel_str}`"
    except (FileNotFoundError, ValueError):
        return f"`{new_ref}`"


def _apply_rename_map_to_deps(deps: str, rename_map: dict[str, str]) -> str:
    """Update doc refs in a Deps cell using the rename map."""
    if deps == "—" or not deps:
        return deps
    result = deps
    # Sort by length descending (longer refs first)
    for old_ref in sorted(rename_map.keys(), key=len, reverse=True):
        new_ref = rename_map[old_ref]
        pattern = re.compile(r'(?<!\w)' + re.escape(old_ref) + r'(?!\.\d)')
        result = pattern.sub(new_ref, result)
    return result


def apply_rename_to_manifest(
    data: ManifestData,
    rename_map: dict[str, str],
    carta_root: Path,
) -> ManifestData:
    """Apply a rename map to the ManifestData structure.

    - Updates Ref column values using rename_map
    - Updates File column values to reflect new filesystem paths
    - Updates Deps column values using rename_map
    - Moves rows between sections if the entry moved to a different title directory
    """
    if not rename_map:
        return data

    # Update verbatim content (preamble lines and non-row chunks) using text substitution.
    # This handles refs in prose, tag index, and other non-structured content.
    data.preamble = [apply_rename_to_text(line, rename_map) for line in data.preamble]

    # Process each section, updating rows and collecting cross-section migrations
    migrations: list[ManifestRow] = []  # rows that need to move to a new section

    for section in data.sections:
        new_chunks = []
        for chunk in section.chunks:
            if not isinstance(chunk, ManifestRow):
                # Apply text-level renames to verbatim string chunks
                if isinstance(chunk, str):
                    new_chunks.append(apply_rename_to_text(chunk, rename_map))
                else:
                    new_chunks.append(chunk)
                continue

            row = chunk
            if row.ref not in rename_map:
                new_chunks.append(row)
                continue

            new_ref = rename_map[row.ref]
            new_section_num = new_ref[3:5] if len(new_ref) > 4 else ""

            # Update deps
            new_deps = _apply_rename_map_to_deps(row.deps, rename_map)

            # Compute new file column
            new_file = _compute_file_column(new_ref, carta_root)

            updated_row = ManifestRow(
                ref=new_ref,
                file=new_file,
                summary=row.summary,
                tags=row.tags,
                deps=new_deps,
            )

            if new_section_num != section.title_dir_num:
                # This row needs to migrate to another section
                migrations.append((updated_row, new_section_num))
                # Don't add it to new_chunks (remove from current section)
            else:
                new_chunks.append(updated_row)

        section.chunks = new_chunks

    # Insert migrated rows into their target sections
    for migrated_row, target_num in migrations:
        target_section = next(
            (s for s in data.sections if s.title_dir_num == target_num),
            None,
        )
        if target_section is None:
            # No matching section found — append to last regular section
            if data.sections:
                target_section = data.sections[-1]
            else:
                continue

        # Find the index of the last ManifestRow in target_section.chunks
        last_row_idx = None
        for i, chunk in enumerate(target_section.chunks):
            if isinstance(chunk, ManifestRow):
                last_row_idx = i

        if last_row_idx is not None:
            target_section.chunks.insert(last_row_idx + 1, migrated_row)
        else:
            # No rows yet — append at the end
            target_section.chunks.append(migrated_row)

    return data


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def serialize_manifest(data: ManifestData) -> str:
    """Render ManifestData back to a MANIFEST.md string."""
    parts: list[str] = []

    for line in data.preamble:
        parts.append(line if line.endswith("\n") else line + "\n")

    for section in data.sections:
        parts.append(section.header + "\n")
        for chunk in section.chunks:
            if isinstance(chunk, ManifestRow):
                parts.append(chunk.to_line() + "\n")
            else:
                # Verbatim line (already has \n if it came from splitlines(keepends=True))
                if isinstance(chunk, str):
                    parts.append(chunk if chunk.endswith("\n") else chunk + "\n")

    return "".join(parts)
