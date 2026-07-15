"""rhidoc — content commands: cat, tree, regenerate, rewrite, attach, ls, bundle, orphans."""
import argparse
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from ..errors import RhidocError
from ..entries import resolve_arg, resolve_and_validate, list_numbered_entries, display_path
from ..frontmatter import read_frontmatter
from ..docref import DocRef, EntryName
from ..rewriter import rewrite_refs
from ..workspace import collect_rewritable_files
from ..regenerate_core import do_regenerate, _collect_all_orphans
from .setup import _load_preamble
from .. import bundle as bundle_mod
from .._glyphs import Glyphs, for_stream


# ---------------------------------------------------------------------------
# cat
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CatArgs:
    ref: str

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(ref=ns.ref)


def cmd_cat(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Print document contents to stdout."""
    a = CatArgs.from_namespace(args)
    target = resolve_arg(a.ref, rhidoc_root).path
    if target.is_dir():
        target = target / "00-index.md"
    if not target.exists():
        raise RhidocError(f"Error: {target} does not exist")
    sys.stdout.write(target.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# tree
# ---------------------------------------------------------------------------

def _entry_label(path: Path, rhidoc_root: Path, *, refs: bool, no_title: bool, glyphs: Glyphs) -> str:
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
            ref_str = str(DocRef.from_path(path, rhidoc_root))
        except (ValueError, Exception):
            pass

    parts = [name]
    if title:
        parts.append(title)
    if ref_str:
        parts.append(f"({ref_str})")
    return glyphs.dash.join(parts[:2]) + (" " + parts[2] if len(parts) == 3 else "")


def _walk_tree(directory: Path, rhidoc_root: Path, prefix: str, *,
               refs: bool, no_title: bool, no_sidecars: bool, lines: list[str],
               glyphs: Glyphs) -> None:
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
        connector = glyphs.leaf if is_last else glyphs.branch
        child_prefix = prefix + (glyphs.indent if is_last else glyphs.vguide)

        if kind == 'dir':
            assert extra is not None
            dir_entry = extra
            label = _entry_label(dir_entry, rhidoc_root, refs=refs, no_title=no_title, glyphs=glyphs)
            lines.append(prefix + connector + label)
            _walk_tree(dir_entry, rhidoc_root, child_prefix,
                       refs=refs, no_title=no_title, no_sidecars=no_sidecars, lines=lines,
                       glyphs=glyphs)
        elif kind == 'root':
            assert bndl.root is not None
            label = _entry_label(bndl.root, rhidoc_root, refs=refs, no_title=no_title, glyphs=glyphs)
            lines.append(prefix + connector + label)
            if not no_sidecars and bndl.attachments:
                for j, att in enumerate(bndl.attachments):
                    is_last_att = j == len(bndl.attachments) - 1
                    att_connector = glyphs.leaf if is_last_att else glyphs.branch
                    if refs:
                        try:
                            att_ref = str(DocRef.from_path(att, rhidoc_root))
                            att_label = glyphs.attach + att_ref
                        except Exception:
                            att_label = glyphs.attach + att.name
                    else:
                        att_label = glyphs.attach + att.name
                    lines.append(child_prefix + att_connector + att_label)
        else:  # orphan
            assert extra is not None
            att = extra
            lines.append(prefix + connector + att.name)


@dataclass(frozen=True)
class TreeArgs:
    target: str | None
    refs: bool
    no_title: bool
    no_sidecars: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(
            target=ns.target,
            refs=ns.refs,
            no_title=ns.no_title,
            no_sidecars=ns.no_sidecars,
        )


def cmd_tree(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Print workspace structure as a visual tree."""
    a = TreeArgs.from_namespace(args)
    if a.target:
        root = resolve_arg(a.target, rhidoc_root).path
        if not root.is_dir():
            raise RhidocError(f"Error: {root} is not a directory")
    else:
        root = rhidoc_root

    show_refs = a.refs
    no_title = a.no_title
    no_sidecars = a.no_sidecars
    glyphs = for_stream(sys.stdout)

    label = _entry_label(root, rhidoc_root, refs=show_refs, no_title=no_title, glyphs=glyphs)
    lines = [label]
    _walk_tree(root, rhidoc_root, "", refs=show_refs, no_title=no_title,
               no_sidecars=no_sidecars, lines=lines, glyphs=glyphs)
    print("\n".join(lines))


# ---------------------------------------------------------------------------
# regenerate
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RegenerateArgs:
    dry_run: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(dry_run=ns.dry_run)


def cmd_regenerate(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Rebuild MANIFEST.md from doc frontmatter."""
    a = RegenerateArgs.from_namespace(args)
    preamble = _load_preamble(rhidoc_root.name)
    do_regenerate(rhidoc_root, preamble, dry_run=a.dry_run)


# ---------------------------------------------------------------------------
# rewrite
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RewriteArgs:
    mappings: list[str]
    dry_run: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(mappings=ns.mappings, dry_run=ns.dry_run)


def cmd_rewrite(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Rewrite doc refs from mappings. Both sides of each mapping are normalized to canonical form."""
    a = RewriteArgs.from_namespace(args)
    rename_map: dict[DocRef, DocRef] = {}

    for pair in a.mappings:
        if '=' not in pair:
            raise RhidocError(f"Error: invalid mapping {pair!r} — expected old=new format.")
        raw_old, raw_new = pair.split('=', 1)
        try:
            old = DocRef.parse(raw_old.strip())
        except RhidocError as e:
            raise RhidocError(f"Error in mapping {pair!r} (old side): {e}")
        try:
            new = DocRef.parse(raw_new.strip())
        except RhidocError as e:
            raise RhidocError(f"Error in mapping {pair!r} (new side): {e}")
        rename_map[old] = new

    if not rename_map:
        raise RhidocError("Error: no mappings provided.")

    md_files = collect_rewritable_files(rhidoc_root)

    if a.dry_run:
        print(f"=== Ref rewrite plan ({len(rename_map)} mappings) ===")
        for old, new in sorted(rename_map.items(), key=lambda kv: str(kv[0])):
            print(f"  {old} -> {new}")
        print(f"\nScanning {len(md_files)} file(s)...")
        total = 0
        for fpath in md_files:
            try:
                text = fpath.read_text(encoding='utf-8')
            except (OSError, UnicodeDecodeError):
                continue
            for old in rename_map:
                matches = DocRef.SCAN.findall(text)
                matches = [m for m in matches if m == str(old)]
                if matches:
                    total += len(matches)
                    print(f"  {display_path(fpath, rhidoc_root)}: {len(matches)} match(es) for {old}")
        print(f"\nTotal: {total} replacement(s) would be made.")
        print("(dry-run: no files modified)")
        return

    results = rewrite_refs(md_files, rename_map)
    total = sum(results.values())
    print(f"Rewrote {total} ref(s) across {len(results)} file(s).")
    if results:
        for fpath, count in sorted(results.items(), key=lambda x: str(x[0])):
            print(f"  {display_path(fpath, rhidoc_root)}: {count}")


# ---------------------------------------------------------------------------
# attach
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AttachArgs:
    host: str
    source: str
    rename: str | None
    dry_run: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(
            host=ns.host,
            source=ns.source,
            rename=ns.rename,
            dry_run=ns.dry_run,
        )


def cmd_attach(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Copy an external file into a doc's bundle as an attachment."""
    a = AttachArgs.from_namespace(args)
    host_entry = resolve_and_validate(a.host, rhidoc_root)
    host = host_entry.path

    if host.is_dir():
        raise RhidocError(
            f"attach host must be a .md leaf doc (NN-<slug>.md), got directory: {host.name}"
        )
    if host.suffix != '.md':
        raise RhidocError(
            f"attach host must be a .md leaf doc (NN-<slug>.md), got {host.suffix} file: {host.name}. "
            f"Did you swap <host> and <source>? Usage: rhidoc attach <host> <source>"
        )

    source = Path(a.source)
    if not source.exists():
        raise RhidocError(f"Error: source does not exist: {source}")
    if source.is_dir():
        raise RhidocError("Error: source must be a file, not a directory")

    bndl = bundle_mod.find_bundle(host)
    if bndl is None:
        raise RhidocError(f"Error: host has no numeric prefix: {host.name}")

    rename_arg = a.rename
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
        raise RhidocError(
            f"Error: bundle already has an attachment with slug {slug!r} ({colliding.name}).\n"
            "Pass --rename to use a different slug."
        )

    dest = host.parent / dest_filename

    if dest.exists():
        raise RhidocError(
            f"Error: attachment already exists: {dest}\n"
            "Move or delete the existing file first."
        )

    try:
        bundle_label = f"{str(host_entry.ref)} ({host.name})"
    except Exception:
        bundle_label = host.name

    if a.dry_run:
        print(f"Would attach: {source} -> {display_path(dest, rhidoc_root)}")
        print(f"  Bundle: {bundle_label}")
        print(f"  Prefix: {bndl.prefix:02d}")
        print("(dry-run: no files modified)")
        return

    shutil.copy2(str(source), str(dest))
    preamble = _load_preamble(rhidoc_root.name)
    do_regenerate(rhidoc_root, preamble, dry_run=False)

    print(f"Attached: {source} -> {display_path(dest, rhidoc_root)}")
    print(f"  Bundle: {bundle_label}")
    print(f"  Prefix: {bndl.prefix:02d}")


# ---------------------------------------------------------------------------
# ls
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LsArgs:
    target: str | None
    no_sidecars: bool

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(target=ns.target, no_sidecars=ns.no_sidecars)


def cmd_ls(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """List entries in a directory (mirrors Unix ls)."""
    a = LsArgs.from_namespace(args)
    if a.target:
        target = resolve_arg(a.target, rhidoc_root).path
    else:
        target = rhidoc_root
    if not target.is_dir():
        raise RhidocError(f"Error: {target} is not a directory")

    no_sidecars = a.no_sidecars
    glyphs = for_stream(sys.stdout)

    for entry in sorted(target.iterdir(), key=lambda p: p.name):
        _en = EntryName.parse(entry.name)
        if _en is None:
            print(entry.name)
            continue

        if entry.is_dir():
            slug_str = _en.tail
            title = slug_str.replace("-", " ").title()
            index_file = entry / "00-index.md"
            if index_file.exists():
                try:
                    fm, _ = read_frontmatter(index_file)
                    title = fm.get("title", title)
                except Exception:
                    pass
            print(f"{entry.name}{glyphs.dash}{title}")
        elif entry.suffix == ".md":
            slug_str = _en.tail
            title = slug_str.replace("-", " ").title()
            try:
                fm, _ = read_frontmatter(entry)
                title = fm.get("title", title)
            except Exception:
                pass
            print(f"{entry.stem}{glyphs.dash}{title}")
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


@dataclass(frozen=True)
class BundleArgs:
    ref: str

    @classmethod
    def from_namespace(cls, ns: argparse.Namespace) :
        return cls(ref=ns.ref)


def cmd_bundle(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Show a doc's bundle: host doc + attachments with sizes and display refs."""
    a = BundleArgs.from_namespace(args)
    host_entry = resolve_and_validate(a.ref, rhidoc_root)
    host = host_entry.path
    if host.is_dir():
        raise RhidocError(
            f"Error: bundle command expects a .md leaf doc, got directory: {host.name}.\n"
            "Hint: specify a doc ref (e.g., doc01.02) that resolves to a .md file."
        )
    if host.suffix != '.md':
        raise RhidocError(
            f"Error: bundle command expects a .md file, got: {host.name}"
        )

    bndl = bundle_mod.find_bundle(host)

    try:
        host_ref = str(host_entry.ref)
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
            att_ref = str(DocRef.from_path(att, rhidoc_root))
        except Exception:
            att_ref = None
        att_label = f"  {att.name}  {_human_size(att_size)}"
        if att_ref:
            att_label += f"  ({att_ref})"
        print(att_label)


# ---------------------------------------------------------------------------
# orphans
# ---------------------------------------------------------------------------

def cmd_orphans(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """List all orphaned attachments in the workspace (read-only)."""
    orphan_paths = _collect_all_orphans(rhidoc_root)
    for p in orphan_paths:
        print(display_path(p, rhidoc_root))
    print(f"Total: {len(orphan_paths)} orphan(s)", file=sys.stderr)
