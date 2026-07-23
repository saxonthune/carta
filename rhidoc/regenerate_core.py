"""regenerate_core — pure regenerate logic, no click or importlib dependencies."""

import re
import sys
from pathlib import Path

from . import bundle as _bundle
from .docref import DocRef
from .frontmatter import read_frontmatter, write_frontmatter


# ---------------------------------------------------------------------------
# Entry collection
# ---------------------------------------------------------------------------

_NUMERIC_PREFIX_RE = re.compile(r'^\d{2}-')


def collect_entries(dir_path: Path, rhidoc_root: Path, title_dir: Path) -> list[dict]:
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
                ref = str(DocRef.from_path(item, rhidoc_root))
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
            entries.extend(collect_entries(item, rhidoc_root, title_dir))

    return entries


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

TABLE_HEADER = "| Ref | File | Summary | Tags | Deps | Refs | Attachments |"
TABLE_SEP    = "|-----|------|---------|------|------|------|-------------|"


def _attachment_display_name(att_path: Path, b: "_bundle.Bundle") -> str:
    """Strip the NN-slug. prefix (or just NN-) from an attachment filename."""
    name = att_path.name
    slug = b.slug
    prefix_str = f"{b.prefix:02d}-"
    if slug:
        slug_prefix = f"{prefix_str}{slug}."
        if name.startswith(slug_prefix):
            return name[len(slug_prefix):]
    if name.startswith(prefix_str):
        return name[len(prefix_str):]
    return name


def _format_attachments_cell(doc_path: Path) -> str:
    """Return the Attachments cell content for a doc row."""
    b = _bundle.find_bundle(doc_path)
    if b is None or not b.attachments:
        return "—"
    names = sorted(_attachment_display_name(att, b) for att in b.attachments)
    if len(names) > 5:
        names = names[:5] + ["…"]
    return ", ".join(names)


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


def format_row(
    entry: dict,
    reverse_deps: dict[str, list[str]] | None = None,
    attachments_cell: str = "—",
) -> str:
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

    return f"| {ref} | {file_col} | {summary} | {tags} | {deps} | {refs_col} | {attachments_cell} |"


# ---------------------------------------------------------------------------
# Section rendering
# ---------------------------------------------------------------------------

def render_section(title_dir: Path, rhidoc_root: Path,
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

    slug = title_dir.name  # e.g. "00-handbook"
    lines = [f"## {slug} — {section_title}"]
    lines.append("")

    # Collect all entries
    entries = collect_entries(title_dir, rhidoc_root, title_dir)

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
        att_cell = _format_attachments_cell(entry["path"])
        lines.append(format_row(entry, reverse_deps, att_cell))

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
            att_cell = _format_attachments_cell(entry["path"])
            lines.append(format_row(entry, reverse_deps, att_cell))

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
# Orphan detection
# ---------------------------------------------------------------------------

def _collect_all_orphans(rhidoc_root: Path) -> list[Path]:
    """Walk all directories under rhidoc_root and collect orphaned attachment paths, sorted."""
    orphan_paths: list[Path] = []

    def _walk(directory: Path) -> None:
        for b in _bundle.detect_orphans(directory):
            orphan_paths.extend(b.attachments)
        for item in sorted(directory.iterdir()):
            if item.is_dir() and _NUMERIC_PREFIX_RE.match(item.name):
                _walk(item)

    for title_dir in sorted(
        p for p in rhidoc_root.iterdir()
        if p.is_dir() and _NUMERIC_PREFIX_RE.match(p.name)
    ):
        _walk(title_dir)

    return sorted(orphan_paths)


# ---------------------------------------------------------------------------
# Index body generation
# ---------------------------------------------------------------------------

INDEX_TABLE_HEADER = "| Ref | Item | Kind | Summary | Tags |"
INDEX_TABLE_SEP    = "|-----|------|------|---------|------|"


def build_index_body(dir_path: Path, rhidoc_root: Path) -> str:
    """Build the generated body for a directory's 00-index.md.

    Enumerates DIRECT children of dir_path only (never recurses into subgroups).
    Leaf .md files → doc rows with ref/title/summary/tags.
    Subdirectories with a 00-index.md → group rows with child count; no tag aggregation.
    """
    # Read title from existing 00-index.md (may not exist yet for brand-new dirs)
    index_file = dir_path / "00-index.md"
    if index_file.exists():
        fm, _ = read_frontmatter(index_file)
        title = fm.get("title", "")
    else:
        title = ""

    if not title:
        slug = dir_path.name
        m = _NUMERIC_PREFIX_RE.match(slug)
        if m:
            slug = slug[len(m.group(0)):]
        title = slug.replace("-", " ").title()

    # Collect direct NN-* children (excluding 00-index.md itself)
    children: list[Path] = []
    for child in dir_path.iterdir():
        if not _NUMERIC_PREFIX_RE.match(child.name):
            continue
        if child.is_file() and child.name == "00-index.md":
            continue
        children.append(child)

    def _prefix_int(p: Path) -> int:
        m = _NUMERIC_PREFIX_RE.match(p.name)
        return int(m.group(0)[:2]) if m else 999

    children.sort(key=_prefix_int)

    rows: list[str] = []
    leaf_tags: list[str] = []

    for child in children:
        if child.is_file() and child.suffix == ".md":
            try:
                ref = str(DocRef.from_path(child, rhidoc_root))
            except (ValueError, FileNotFoundError):
                continue
            cfm, _ = read_frontmatter(child)
            item_title = cfm.get("title", child.stem)
            summary = cfm.get("summary", "")
            if isinstance(summary, list):
                summary = ", ".join(str(s) for s in summary)
            summary = str(summary)
            raw_tags = cfm.get("tags", [])
            if isinstance(raw_tags, list):
                tags_str = ", ".join(raw_tags)
                leaf_tags.extend(raw_tags)
            elif isinstance(raw_tags, str) and raw_tags:
                tags_str = raw_tags
                leaf_tags.extend(t.strip() for t in raw_tags.split(",") if t.strip())
            else:
                tags_str = ""
            rows.append(f"| {ref} | {item_title} | doc | {summary} | {tags_str} |")

        elif child.is_dir() and (child / "00-index.md").exists():
            try:
                ref = str(DocRef.from_path(child, rhidoc_root))
            except (ValueError, FileNotFoundError):
                continue
            sfm, _ = read_frontmatter(child / "00-index.md")
            item_title = sfm.get("title", child.name)
            count = sum(
                1 for p in child.iterdir()
                if _NUMERIC_PREFIX_RE.match(p.name) and p.name != "00-index.md"
            )
            rows.append(f"| {ref} | {item_title} | group ({count}) | — | — |")

    lines: list[str] = [f"\n# {title}\n", ""]
    lines.append(INDEX_TABLE_HEADER)
    lines.append(INDEX_TABLE_SEP)
    lines.append("")
    lines.extend(rows)

    unique_tags = sorted(set(leaf_tags))
    if unique_tags:
        lines.append("")
        lines.append(f"Topics: {', '.join(unique_tags)}")

    lines.append("")
    return "\n".join(lines)


def write_all_indexes(rhidoc_root: Path, dry_run: bool = False) -> None:
    """Walk every directory under rhidoc_root that has a 00-index.md and rewrite its body."""

    def _walk(directory: Path) -> None:
        index_file = directory / "00-index.md"
        if index_file.exists():
            fm, _ = read_frontmatter(index_file)
            title = fm.get("title", "")
            if not title:
                slug = directory.name
                m = _NUMERIC_PREFIX_RE.match(slug)
                if m:
                    slug = slug[len(m.group(0)):]
                title = slug.replace("-", " ").title()
            new_fm = {"title": title, "summary": "", "tags": [], "deps": []}
            new_body = build_index_body(directory, rhidoc_root)
            if dry_run:
                rel = index_file.relative_to(rhidoc_root)
                print(f"Would write index: {rel}")
            else:
                write_frontmatter(index_file, new_fm, new_body)
                rel = index_file.relative_to(rhidoc_root)
                print(f"Wrote index: {rel}")

        for child in sorted(directory.iterdir()):
            if child.is_dir() and _NUMERIC_PREFIX_RE.match(child.name):
                _walk(child)

    for title_dir in sorted(
        p for p in rhidoc_root.iterdir()
        if p.is_dir() and _NUMERIC_PREFIX_RE.match(p.name)
    ):
        _walk(title_dir)


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def do_regenerate(rhidoc_root: Path, preamble: str, dry_run: bool = False) -> None:
    """Rebuild MANIFEST.md from doc frontmatter.

    Args:
        rhidoc_root: path to the workspace directory
        preamble: the manifest preamble text (already has {{dir_name}} substituted)
        dry_run: if True, print to stdout instead of writing
    """
    # Write generated index bodies first so MANIFEST reads consistent frontmatter.
    # (write_all_indexes clears summary/tags in 00-index.md frontmatter; doing it
    # before collect_entries ensures MANIFEST reflects the post-generation state.)
    write_all_indexes(rhidoc_root, dry_run=dry_run)

    # Discover top-level title directories (NN-slug pattern)
    title_dirs = sorted(
        p for p in rhidoc_root.iterdir()
        if p.is_dir() and _NUMERIC_PREFIX_RE.match(p.name)
    )

    # Collect all entries first so we can compute reverse deps
    all_entries: list[dict] = []
    for title_dir in title_dirs:
        all_entries.extend(collect_entries(title_dir, rhidoc_root, title_dir))

    reverse_deps = build_reverse_deps(all_entries)

    # Render sections with reverse deps available
    output_lines: list[str] = []
    for title_dir in title_dirs:
        section_lines = render_section(title_dir, rhidoc_root, reverse_deps)
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
        manifest_path = rhidoc_root / "MANIFEST.md"
        manifest_path.write_text(output, encoding="utf-8")
        print(f"Wrote {manifest_path}")

    # Orphan detection — warn to stderr, never raise
    orphan_paths = _collect_all_orphans(rhidoc_root)
    if orphan_paths:
        count = len(orphan_paths)
        print(f"Warning: {count} orphaned attachment(s) found:", file=sys.stderr)
        for p in orphan_paths:
            print(f"  {p}", file=sys.stderr)
