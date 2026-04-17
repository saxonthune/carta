"""Bundle resolver — pure filesystem-structural grouping of .carta/ entries.

No frontmatter parsing, no I/O beyond Path.iterdir().
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from .errors import CartaError
from .numbering import get_numeric_prefix


@dataclass(frozen=True)
class Bundle:
    prefix: int
    root: Path | None
    attachments: list[Path]
    is_directory_bundle: bool = False

    @property
    def is_orphan(self) -> bool:
        return self.root is None and not self.is_directory_bundle

    @property
    def slug(self) -> str | None:
        if self.root is None:
            return None
        m = re.match(r'^\d{2}-(.*?)\.md$', self.root.name)
        return m.group(1) if m else None


def list_bundles(directory: Path) -> list[Bundle]:
    """Group numbered entries in directory into Bundle objects.

    Non-numbered entries are ignored. Sorted by prefix.
    Raises CartaError if two .md files share a prefix.
    """
    groups: dict[int, list[Path]] = defaultdict(list)
    for entry in directory.iterdir():
        prefix = get_numeric_prefix(entry.name)
        if prefix is not None:
            groups[prefix].append(entry)

    bundles: list[Bundle] = []
    for prefix in sorted(groups):
        entries = groups[prefix]
        dirs = sorted([e for e in entries if e.is_dir()], key=lambda p: p.name)
        files = [e for e in entries if not e.is_dir()]

        for d in dirs:
            bundles.append(Bundle(prefix=prefix, root=None, attachments=[d], is_directory_bundle=True))

        if not files:
            continue

        if dirs:
            # Directories present: all files are orphan attachments
            bundles.append(Bundle(prefix=prefix, root=None, attachments=sorted(files, key=lambda p: p.name)))
            continue

        md_files = [f for f in files if f.suffix == '.md']
        non_md = sorted([f for f in files if f.suffix != '.md'], key=lambda p: p.name)

        if len(md_files) > 1:
            names = sorted(f.name for f in md_files)
            raise CartaError(f"bundle at prefix {prefix:02d} has multiple root candidates: {names}")

        if len(md_files) == 1:
            bundles.append(Bundle(prefix=prefix, root=md_files[0], attachments=non_md))
        else:
            bundles.append(Bundle(prefix=prefix, root=None, attachments=sorted(files, key=lambda p: p.name)))

    return bundles


def find_bundle(path: Path) -> Bundle | None:
    """Return the Bundle rooted at path, or None if path isn't a numbered .md file."""
    if get_numeric_prefix(path.name) is None:
        return None
    if path.suffix != '.md':
        return None
    if not path.is_file():
        return None
    for bundle in list_bundles(path.parent):
        if bundle.root == path:
            return bundle
    return None


def bundle_members(md_path: Path) -> list[Path]:
    """Return [root, *attachments] in deterministic order (root first, attachments sorted)."""
    bundle = find_bundle(md_path)
    if bundle is None or bundle.root is None:
        return [md_path]
    return [bundle.root, *bundle.attachments]


def slug_matched_attachments(bundle: Bundle, slug: str) -> list[Path]:
    """Return attachments whose name starts with 'NN-slug.'"""
    prefix_str = f"{bundle.prefix:02d}-{slug}."
    return [a for a in bundle.attachments if a.name.startswith(prefix_str)]


def detect_orphans(directory: Path) -> list[Bundle]:
    """Return all bundles with is_orphan=True."""
    return [b for b in list_bundles(directory) if b.is_orphan]
