"""manifest.py — MANIFEST.md parsing.

Parses MANIFEST.md into a structured representation.
Used by migrate-frontmatter to read existing MANIFEST data into doc frontmatter.
"""

import re
from dataclasses import dataclass
from pathlib import Path


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
