"""carta — content commands: cat, tree, regenerate, rewrite."""
import argparse
import re
import sys
from pathlib import Path

from ..errors import CartaError
from ..entries import resolve_arg, list_numbered_entries, display_path
from ..frontmatter import read_frontmatter
from ..numbering import get_slug
from ..ref_convert import path_to_ref
from ..rewriter import rewrite_refs
from ..workspace import collect_rewritable_files
from ..regenerate_core import do_regenerate
from .setup import _load_preamble


# ---------------------------------------------------------------------------
# cat
# ---------------------------------------------------------------------------

def cmd_cat(args: argparse.Namespace, carta_root: Path) -> None:
    """Print document contents to stdout."""
    target = resolve_arg(args.ref, carta_root)
    if target.is_dir():
        target = target / "00-index.md"
    if not target.exists():
        raise CartaError(f"Error: {target} does not exist")
    sys.stdout.write(target.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# tree
# ---------------------------------------------------------------------------

def _entry_label(path: Path, carta_root: Path, *, refs: bool, no_title: bool) -> str:
    """Build the display label for a single tree entry."""
    name = path.name
    if path.suffix == ".md":
        name = path.stem

    title = ""
    if not no_title and path.is_file() and path.suffix == ".md":
        try:
            fm, _ = read_frontmatter(path)
            title = fm.get("title", "")
        except Exception:
            pass
    elif not no_title and path.is_dir():
        index = path / "00-index.md"
        if index.exists():
            try:
                fm, _ = read_frontmatter(index)
                title = fm.get("title", "")
            except Exception:
                pass

    ref_str = ""
    if refs:
        try:
            ref_str = path_to_ref(path, carta_root)
        except (ValueError, Exception):
            pass

    parts = [name]
    if title:
        parts.append(title)
    if ref_str:
        parts.append(f"({ref_str})")
    return " — ".join(parts[:2]) + (" " + parts[2] if len(parts) == 3 else "")


def _walk_tree(directory: Path, carta_root: Path, prefix: str, *,
               refs: bool, no_title: bool, lines: list[str]) -> None:
    """Recursively build tree lines for a directory."""
    entries = list_numbered_entries(directory)
    for i, entry in enumerate(entries):
        is_last = i == len(entries) - 1
        connector = "└── " if is_last else "├── "
        label = _entry_label(entry, carta_root, refs=refs, no_title=no_title)
        lines.append(prefix + connector + label)

        if entry.is_dir():
            extension = "    " if is_last else "│   "
            _walk_tree(entry, carta_root, prefix + extension,
                       refs=refs, no_title=no_title, lines=lines)


def cmd_tree(args: argparse.Namespace, carta_root: Path) -> None:
    """Print workspace structure as a visual tree."""
    if hasattr(args, "target") and args.target:
        root = resolve_arg(args.target, carta_root)
        if not root.is_dir():
            raise CartaError(f"Error: {root} is not a directory")
    else:
        root = carta_root

    show_refs = getattr(args, "refs", False)
    no_title = getattr(args, "no_title", False)

    label = _entry_label(root, carta_root, refs=show_refs, no_title=no_title)
    lines = [label]
    _walk_tree(root, carta_root, "", refs=show_refs, no_title=no_title, lines=lines)
    print("\n".join(lines))


# ---------------------------------------------------------------------------
# regenerate
# ---------------------------------------------------------------------------

def cmd_regenerate(args: argparse.Namespace, carta_root: Path) -> None:
    """Rebuild MANIFEST.md from doc frontmatter."""
    preamble = _load_preamble(carta_root.name)
    do_regenerate(carta_root, preamble, dry_run=args.dry_run)


# ---------------------------------------------------------------------------
# rewrite
# ---------------------------------------------------------------------------

def cmd_rewrite(args: argparse.Namespace, carta_root: Path) -> None:
    """Rewrite doc refs from mappings."""
    rename_map: dict[str, str] = {}

    for pair in args.mappings:
        if '=' not in pair:
            raise CartaError(f"Error: invalid mapping {pair!r} — expected old=new format.")
        old, new = pair.split('=', 1)
        rename_map[old.strip()] = new.strip()

    if not rename_map:
        raise CartaError("Error: no mappings provided.")

    md_files = collect_rewritable_files(carta_root)

    if args.dry_run:
        print(f"=== Ref rewrite plan ({len(rename_map)} mappings) ===")
        for old, new in sorted(rename_map.items()):
            print(f"  {old} -> {new}")
        print(f"\nScanning {len(md_files)} file(s)...")
        total = 0
        for fpath in md_files:
            try:
                text = fpath.read_text(encoding='utf-8')
            except (OSError, UnicodeDecodeError):
                continue
            for old in rename_map:
                pattern = re.compile(r'(?<!\w)' + re.escape(old) + r'(?!\.[a-zA-Z0-9])')
                matches = pattern.findall(text)
                if matches:
                    total += len(matches)
                    print(f"  {display_path(fpath, carta_root)}: {len(matches)} match(es) for {old}")
        print(f"\nTotal: {total} replacement(s) would be made.")
        print("(dry-run: no files modified)")
        return

    results = rewrite_refs(md_files, rename_map)
    total = sum(results.values())
    print(f"Rewrote {total} ref(s) across {len(results)} file(s).")
    if results:
        for fpath, count in sorted(results.items(), key=lambda x: str(x[0])):
            print(f"  {display_path(fpath, carta_root)}: {count}")
