"""carta — content commands: cat, regenerate, rewrite."""
import argparse
import re
import sys
from pathlib import Path

from ..errors import CartaError
from ..entries import resolve_arg, display_path
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
