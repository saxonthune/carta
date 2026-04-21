"""carta — content commands: cat, tree, regenerate, rewrite, attach, ls, bundle, orphans."""
import argparse
import re
import shutil
import sys
from pathlib import Path

from ..errors import CartaError
from ..entries import resolve_arg, resolve_and_validate, list_numbered_entries, display_path
from ..frontmatter import read_frontmatter
from ..numbering import get_slug, get_numeric_prefix
from ..ref_convert import path_to_ref
from ..rewriter import rewrite_refs
from ..workspace import collect_rewritable_files
from ..regenerate_core import do_regenerate, _collect_all_orphans
from .setup import _load_preamble
from .. import bundle as bundle_mod


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
               refs: bool, no_title: bool, no_sidecars: bool, lines: list[str]) -> None:
    """Recursively build tree lines for a directory using bundle-aware iteration."""
    bundles = bundle_mod.list_bundles(directory)

    # Flatten bundles into primary render items so connectors are calculated correctly
    # Each item: ('dir', bundle, dir_path) | ('root', bundle, None) | ('orphan', bundle, att_path)
    items: list[tuple[str, bundle_mod.Bundle, Path | None]] = []
    for bndl in bundles:
        if bndl.is_directory_bundle:
            items.append(('dir', bndl, bndl.attachments[0]))
        elif bndl.root is not None:
            items.append(('root', bndl, None))
        else:
            for att in bndl.attachments:
                items.append(('orphan', bndl, att))

    for i, (kind, bndl, extra) in enumerate(items):
        is_last = i == len(items) - 1
        connector = "└── " if is_last else "├── "
        child_prefix = prefix + ("    " if is_last else "│   ")

        if kind == 'dir':
            dir_entry = extra
            label = _entry_label(dir_entry, carta_root, refs=refs, no_title=no_title)
            lines.append(prefix + connector + label)
            _walk_tree(dir_entry, carta_root, child_prefix,
                       refs=refs, no_title=no_title, no_sidecars=no_sidecars, lines=lines)
        elif kind == 'root':
            label = _entry_label(bndl.root, carta_root, refs=refs, no_title=no_title)
            lines.append(prefix + connector + label)
            if not no_sidecars and bndl.attachments:
                for j, att in enumerate(bndl.attachments):
                    is_last_att = j == len(bndl.attachments) - 1
                    att_connector = "└── " if is_last_att else "├── "
                    if refs:
                        try:
                            att_ref = path_to_ref(att, carta_root)
                            att_label = "📎 " + att_ref
                        except Exception:
                            att_label = "📎 " + att.name
                    else:
                        att_label = "📎 " + att.name
                    lines.append(child_prefix + att_connector + att_label)
        else:  # orphan
            att = extra
            lines.append(prefix + connector + att.name)


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
    no_sidecars = getattr(args, "no_sidecars", False)

    label = _entry_label(root, carta_root, refs=show_refs, no_title=no_title)
    lines = [label]
    _walk_tree(root, carta_root, "", refs=show_refs, no_title=no_title,
               no_sidecars=no_sidecars, lines=lines)
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


# ---------------------------------------------------------------------------
# attach
# ---------------------------------------------------------------------------

def cmd_attach(args: argparse.Namespace, carta_root: Path) -> None:
    """Copy an external file into a doc's bundle as an attachment."""
    host = resolve_and_validate(args.host, carta_root)

    if host.is_dir():
        raise CartaError(
            f"attach host must be a .md leaf doc (NN-<slug>.md), got directory: {host.name}"
        )
    if host.suffix != '.md':
        raise CartaError(
            f"attach host must be a .md leaf doc (NN-<slug>.md), got {host.suffix} file: {host.name}. "
            f"Did you swap <host> and <source>? Usage: carta attach <host> <source>"
        )

    source = Path(args.source)
    if not source.exists():
        raise CartaError(f"Error: source does not exist: {source}")
    if source.is_dir():
        raise CartaError("Error: source must be a file, not a directory")

    bndl = bundle_mod.find_bundle(host)
    if bndl is None:
        raise CartaError(f"Error: host has no numeric prefix: {host.name}")

    rename_arg = args.rename
    if rename_arg:
        rename_path = Path(rename_arg)
        slug = rename_path.stem if rename_path.suffix else rename_arg
    else:
        slug = source.stem

    source_ext = source.suffix
    dest_filename = f"{bndl.prefix:02d}-{slug}{source_ext}"

    # Check for slug collision across extensions before the same-path check
    colliding = bundle_mod.slug_collision(bndl, slug)
    if colliding:
        raise CartaError(
            f"Error: bundle already has an attachment with slug {slug!r} ({colliding.name}).\n"
            "Pass --rename to use a different slug."
        )

    dest = host.parent / dest_filename

    if dest.exists():
        raise CartaError(
            f"Error: attachment already exists: {dest}\n"
            "Move or delete the existing file first."
        )

    try:
        ref_str = path_to_ref(host, carta_root)
        bundle_label = f"{ref_str} ({host.name})"
    except Exception:
        bundle_label = host.name

    if args.dry_run:
        print(f"Would attach: {source} -> {display_path(dest, carta_root)}")
        print(f"  Bundle: {bundle_label}")
        print(f"  Prefix: {bndl.prefix:02d}")
        print("(dry-run: no files modified)")
        return

    shutil.copy2(str(source), str(dest))
    preamble = _load_preamble(carta_root.name)
    do_regenerate(carta_root, preamble, dry_run=False)

    print(f"Attached: {source} -> {display_path(dest, carta_root)}")
    print(f"  Bundle: {bundle_label}")
    print(f"  Prefix: {bndl.prefix:02d}")


# ---------------------------------------------------------------------------
# ls
# ---------------------------------------------------------------------------

def cmd_ls(args: argparse.Namespace, carta_root: Path) -> None:
    """List entries in a directory (mirrors Unix ls)."""
    if hasattr(args, "target") and args.target:
        target = resolve_arg(args.target, carta_root)
    else:
        target = carta_root
    if not target.is_dir():
        raise CartaError(f"Error: {target} is not a directory")

    no_sidecars = getattr(args, "no_sidecars", False)

    for entry in sorted(target.iterdir(), key=lambda p: p.name):
        prefix = get_numeric_prefix(entry.name)
        if prefix is None:
            print(entry.name)
            continue

        if entry.is_dir():
            slug_str = get_slug(entry.name)
            title = slug_str.replace("-", " ").title()
            index_file = entry / "00-index.md"
            if index_file.exists():
                try:
                    fm, _ = read_frontmatter(index_file)
                    title = fm.get("title", title)
                except Exception:
                    pass
            print(f"{entry.name} — {title}")
        elif entry.suffix == ".md":
            slug_str = get_slug(entry.name)
            title = slug_str.replace("-", " ").title()
            try:
                fm, _ = read_frontmatter(entry)
                title = fm.get("title", title)
            except Exception:
                pass
            print(f"{entry.stem} — {title}")
        else:
            # Non-md numbered file (sidecar / attachment)
            if not no_sidecars:
                print(entry.name)


# ---------------------------------------------------------------------------
# bundle
# ---------------------------------------------------------------------------

def _human_size(size: int) -> str:
    """Format byte count as human-readable."""
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f}MB"
    if size >= 1024:
        return f"{size / 1024:.1f}KB"
    return f"{size}B"


def cmd_bundle(args: argparse.Namespace, carta_root: Path) -> None:
    """Show a doc's bundle: host doc + attachments with sizes and display refs."""
    host = resolve_and_validate(args.ref, carta_root)
    if host.is_dir():
        raise CartaError(
            f"Error: bundle command expects a .md leaf doc, got directory: {host.name}.\n"
            "Hint: specify a doc ref (e.g., doc01.02) that resolves to a .md file."
        )
    if host.suffix != '.md':
        raise CartaError(
            f"Error: bundle command expects a .md file, got: {host.name}"
        )

    bndl = bundle_mod.find_bundle(host)

    try:
        host_ref = path_to_ref(host, carta_root)
    except Exception:
        host_ref = None

    host_size = host.stat().st_size
    host_label = f"{host.name}  {_human_size(host_size)}"
    if host_ref:
        host_label += f"  ({host_ref})"
    print(host_label)

    if bndl is None:
        return

    for att in bndl.attachments:
        att_size = att.stat().st_size
        try:
            att_ref = path_to_ref(att, carta_root)
        except Exception:
            att_ref = None
        att_label = f"  {att.name}  {_human_size(att_size)}"
        if att_ref:
            att_label += f"  ({att_ref})"
        print(att_label)


# ---------------------------------------------------------------------------
# orphans
# ---------------------------------------------------------------------------

def cmd_orphans(args: argparse.Namespace, carta_root: Path) -> None:
    """List all orphaned attachments in the workspace (read-only)."""
    orphan_paths = _collect_all_orphans(carta_root)
    for p in orphan_paths:
        print(display_path(p, carta_root))
    print(f"Total: {len(orphan_paths)} orphan(s)", file=sys.stderr)
