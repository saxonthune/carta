"""regenerate_core — pure regenerate logic, no click or importlib dependencies."""

import re
from pathlib import Path

from .ref_convert import path_to_ref
from .frontmatter import read_frontmatter


# ---------------------------------------------------------------------------
# Entry collection
# ---------------------------------------------------------------------------

_NUMERIC_PREFIX_RE = re.compile(r'^\d{2}-')


def collect_entries(dir_path: Path, carta_root: Path, title_dir: Path) -> list[dict]:
    """Recursively collect all doc entries under dir_path.

    Returns a list of entry dicts:
      ref       — doc ref string (e.g. "doc02.06")
      path      — absolute Path to the .md file (or directory)
      is_dir    — True if this entry represents a directory
      file_rel  — path relative to title_dir (str), with trailing / for dirs
      fm        — frontmatter dict
    """
    entries = []

    for item in sorted(dir_path.iterdir(), key=lambda p: p.name):
        if not _NUMERIC_PREFIX_RE.match(item.name):
            continue

        if item.is_file() and item.suffix == ".md":
            try:
                ref = path_to_ref(item, carta_root)
            except ValueError:
                continue

            fm, _ = read_frontmatter(item)
            rel = item.relative_to(title_dir)
            entries.append({
                "ref": ref,
                "path": item,
                "is_dir": False,
                "file_rel": str(rel).replace("\\", "/"),
                "fm": fm,
            })

        elif item.is_dir():
            # Recurse into the directory; do not emit a row for the directory itself.
            # Files (including 00-index.md) inside get their own rows via the recursive call.
            entries.extend(collect_entries(item, carta_root, title_dir))

    return entries


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

TABLE_HEADER = "| Ref | File | Summary | Tags | Deps | Refs |"
TABLE_SEP    = "|-----|------|---------|------|------|------|"


def build_reverse_deps(all_entries: list[dict]) -> dict[str, list[str]]:
    """Build a reverse dep index: for each ref, which other refs depend on it."""
    reverse: dict[str, list[str]] = {}
    for entry in all_entries:
        source_ref = entry["ref"]
        raw_deps = entry["fm"].get("deps", [])
        if isinstance(raw_deps, list):
            deps = raw_deps
        elif isinstance(raw_deps, str) and raw_deps:
            deps = [d.strip() for d in raw_deps.split(",") if d.strip()]
        else:
            deps = []
        for dep in deps:
            if dep not in reverse:
                reverse[dep] = []
            if source_ref not in reverse[dep]:
                reverse[dep].append(source_ref)
    return reverse


def format_row(entry: dict, reverse_deps: dict[str, list[str]] | None = None) -> str:
    """Format a single MANIFEST table row."""
    ref = entry["ref"]
    file_col = f"`{entry['file_rel']}`"
    fm = entry["fm"]

    summary = fm.get("summary", "")
    if isinstance(summary, list):
        summary = ", ".join(summary)
    summary = str(summary)

    raw_tags = fm.get("tags", [])
    if isinstance(raw_tags, list):
        tags = ", ".join(raw_tags)
    else:
        tags = str(raw_tags)

    raw_deps = fm.get("deps", [])
    if isinstance(raw_deps, list):
        if raw_deps:
            deps = ", ".join(raw_deps)
        else:
            deps = "—"
    else:
        deps_str = str(raw_deps).strip()
        deps = deps_str if deps_str else "—"

    rev = reverse_deps.get(ref, []) if reverse_deps else []
    refs_col = ", ".join(sorted(rev)) if rev else "—"

    return f"| {ref} | {file_col} | {summary} | {tags} | {deps} | {refs_col} |"


# ---------------------------------------------------------------------------
# Section rendering
# ---------------------------------------------------------------------------

def render_section(title_dir: Path, carta_root: Path,
                   reverse_deps: dict[str, list[str]] | None = None) -> list[str]:
    """Render a full ## section for a title directory.

    Returns a list of lines (without trailing newlines).
    """
    # Section header from 00-index.md title
    index_file = title_dir / "00-index.md"
    section_title = title_dir.name  # fallback
    if index_file.exists():
        fm, _ = read_frontmatter(index_file)
        section_title = fm.get("title", title_dir.name)

    slug = title_dir.name  # e.g. "00-codex"
    lines = [f"## {slug} — {section_title}"]
    lines.append("")

    # Collect all entries
    entries = collect_entries(title_dir, carta_root, title_dir)

    # Sort by ref
    entries.sort(key=lambda e: e["ref"])

    if not entries:
        lines.append(TABLE_HEADER)
        lines.append(TABLE_SEP)
        lines.append("")
        return lines

    # Group entries by their first-level subdirectory relative to title_dir.
    # Entries in subdirs WITH a 00-index.md → get their own ### subsection.
    # All other entries (direct children + subdirs without 00-index.md) → root table.
    root_entries = []
    subsection_groups: dict[str, list[dict]] = {}  # subdir_name → entries
    subsection_order: list[str] = []  # insertion-ordered subdir names (with 00-index.md)

    for entry in entries:
        path = entry["path"]
        try:
            rel = path.relative_to(title_dir)
        except ValueError:
            root_entries.append(entry)
            continue

        parts = rel.parts
        if len(parts) == 1:
            # Direct child of title_dir
            root_entries.append(entry)
        else:
            subdir_name = parts[0]
            subdir_path = title_dir / subdir_name
            if (subdir_path / "00-index.md").exists():
                # Subdir has index → subsection
                if subdir_name not in subsection_groups:
                    subsection_groups[subdir_name] = []
                    subsection_order.append(subdir_name)
                subsection_groups[subdir_name].append(entry)
            else:
                # No index → merge into root table
                root_entries.append(entry)

    # Sort root entries by ref
    root_entries.sort(key=lambda e: e["ref"])

    # Render root table first (always emit, even if empty, to keep consistent structure)
    lines.append(TABLE_HEADER)
    lines.append(TABLE_SEP)
    lines.append("")
    for entry in root_entries:
        lines.append(format_row(entry, reverse_deps))

    # Render subsection groups (subdirs with 00-index.md)
    for subdir_name in subsection_order:
        subdir_path = title_dir / subdir_name
        fm, _ = read_frontmatter(subdir_path / "00-index.md")
        subdir_title = fm.get("title", subdir_name)
        group_entries = sorted(subsection_groups[subdir_name], key=lambda e: e["ref"])

        lines.append("")
        lines.append(f"### {subdir_title}")
        lines.append("")
        lines.append(TABLE_HEADER)
        lines.append(TABLE_SEP)
        lines.append("")
        for entry in group_entries:
            lines.append(format_row(entry, reverse_deps))

    return lines


# ---------------------------------------------------------------------------
# Tag index
# ---------------------------------------------------------------------------

def build_tag_index(all_entries: list[dict]) -> list[str]:
    """Build the tag index section from all entries."""
    tag_to_refs: dict[str, list[str]] = {}

    for entry in all_entries:
        fm = entry["fm"]
        raw_tags = fm.get("tags", [])
        if isinstance(raw_tags, list):
            tags = raw_tags
        elif isinstance(raw_tags, str) and raw_tags:
            tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
        else:
            tags = []

        ref = entry["ref"]
        for tag in tags:
            if tag not in tag_to_refs:
                tag_to_refs[tag] = []
            if ref not in tag_to_refs[tag]:
                tag_to_refs[tag].append(ref)

    lines = [
        "## Tag Index",
        "",
        "Quick lookup for file-path→doc mapping:",
        "",
        "| Tag | Relevant Docs |",
        "|-----|---------------|",
    ]

    for tag in sorted(tag_to_refs.keys()):
        refs = ", ".join(tag_to_refs[tag])
        lines.append(f"| `{tag}` | {refs} |")

    return lines


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def do_regenerate(carta_root: Path, preamble: str, dry_run: bool = False) -> None:
    """Rebuild MANIFEST.md from doc frontmatter.

    Args:
        carta_root: path to the workspace directory
        preamble: the manifest preamble text (already has {{dir_name}} substituted)
        dry_run: if True, print to stdout instead of writing
    """
    # Discover top-level title directories (NN-slug pattern)
    title_dirs = sorted(
        p for p in carta_root.iterdir()
        if p.is_dir() and _NUMERIC_PREFIX_RE.match(p.name)
    )

    # Collect all entries first so we can compute reverse deps
    all_entries: list[dict] = []
    for title_dir in title_dirs:
        all_entries.extend(collect_entries(title_dir, carta_root, title_dir))

    reverse_deps = build_reverse_deps(all_entries)

    # Render sections with reverse deps available
    output_lines: list[str] = []
    for title_dir in title_dirs:
        section_lines = render_section(title_dir, carta_root, reverse_deps)
        output_lines.extend(section_lines)
        output_lines.append("")  # blank line between sections

    # Tag index
    tag_lines = build_tag_index(all_entries)
    output_lines.extend(tag_lines)
    output_lines.append("")  # trailing newline

    output = preamble + "\n".join(output_lines)

    if dry_run:
        print(output, end="")
    else:
        manifest_path = carta_root / "MANIFEST.md"
        manifest_path.write_text(output, encoding="utf-8")
        print(f"Wrote {manifest_path}")
