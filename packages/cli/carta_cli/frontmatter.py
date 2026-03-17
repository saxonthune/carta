"""frontmatter.py — YAML frontmatter read/write utilities for workspace docs."""

import re
from pathlib import Path


# Canonical field order for output
_CANONICAL_FIELDS = ["title", "status", "summary", "tags", "deps"]


def read_frontmatter(path: Path) -> tuple[dict, str]:
    """Read YAML frontmatter from a markdown file.

    Returns (frontmatter_dict, body) where body is everything after the
    closing ---. Returns ({}, full_text) if no frontmatter block exists.

    Parses simple key-value pairs:
    - Scalar: "key: value" -> {"key": "value"}
    - Inline list: "key: [a, b, c]" -> {"key": ["a", "b", "c"]}
    - Multi-line list: "key:\n  - a\n  - b" -> {"key": ["a", "b"]}
    - Comma-separated (tags/deps): "key: a, b" -> {"key": ["a", "b"]}
    """
    text = path.read_text(encoding="utf-8")

    # Must start with --- at beginning of file
    if not text.startswith("---\n"):
        return {}, text

    # Find closing ---
    rest = text[4:]  # after opening ---\n
    close_idx = rest.find("\n---")
    if close_idx == -1:
        return {}, text

    fm_text = rest[:close_idx]
    # Body starts after \n---\n (or \n--- at end)
    after_close = rest[close_idx + 4:]  # skip \n---
    if after_close.startswith("\n"):
        body = after_close[1:]  # skip the newline after ---
    else:
        body = after_close

    fm = _parse_fm(fm_text)
    return fm, body


def _parse_fm(fm_text: str) -> dict:
    """Parse simple YAML key-value pairs from frontmatter text."""
    result = {}
    lines = fm_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]

        if not line.strip():
            i += 1
            continue

        # Key: value
        m = re.match(r'^(\w[\w-]*):\s*(.*)', line)
        if not m:
            i += 1
            continue

        key = m.group(1)
        val = m.group(2).strip()

        # Inline list: [a, b, c]
        m_list = re.match(r'^\[([^\]]*)\]$', val)
        if m_list:
            content = m_list.group(1).strip()
            if content:
                result[key] = [item.strip() for item in content.split(",") if item.strip()]
            else:
                result[key] = []
            i += 1
            continue

        # Multi-line list
        if val == "" and i + 1 < len(lines) and re.match(r'^\s+-\s', lines[i + 1]):
            items = []
            i += 1
            while i < len(lines) and re.match(r'^\s+-\s', lines[i]):
                items.append(re.sub(r'^\s+-\s+', "", lines[i]))
                i += 1
            result[key] = items
            continue

        # Comma-separated list for tags/deps fields
        if key in ("tags", "deps") and "," in val:
            result[key] = [item.strip() for item in val.split(",") if item.strip()]
        else:
            # Strip surrounding quotes if present
            if (val.startswith('"') and val.endswith('"')) or \
               (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            result[key] = val

        i += 1

    return result


def write_frontmatter(path: Path, frontmatter: dict, body: str) -> None:
    """Write a markdown file with YAML frontmatter.

    Emits fields in canonical order: title, status, summary, tags, deps.
    Lists are emitted as inline YAML: [item1, item2].
    Body is everything after the closing ---.
    """
    lines = ["---"]

    # Canonical fields first
    for field in _CANONICAL_FIELDS:
        if field not in frontmatter:
            continue
        val = frontmatter[field]
        if isinstance(val, list):
            items = ", ".join(str(v) for v in val)
            lines.append(f"{field}: [{items}]")
        else:
            lines.append(f"{field}: {val}")

    # Any extra fields not in canonical order
    for key, val in frontmatter.items():
        if key in _CANONICAL_FIELDS:
            continue
        if isinstance(val, list):
            items = ", ".join(str(v) for v in val)
            lines.append(f"{key}: [{items}]")
        else:
            lines.append(f"{key}: {val}")

    lines.append("---")
    fm_text = "\n".join(lines) + "\n"

    # Body should start with a newline (blank line between --- and content)
    if body and not body.startswith("\n"):
        body = "\n" + body

    path.write_text(fm_text + body, encoding="utf-8")
