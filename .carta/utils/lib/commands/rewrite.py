"""rewrite command — rewrite doc refs across the workspace using user-supplied mappings."""

import json
import sys
from pathlib import Path

import click

from ..rewriter import collect_md_files, rewrite_refs
from ..workspace import find_carta_root, load_workspace, get_external_ref_paths


@click.command()
@click.option('--map', '-m', 'mappings', multiple=True,
              help='old=new ref mapping (repeatable). Example: -m doc01.02=doc01.05')
@click.option('--from-json', 'json_file', type=click.Path(exists=True),
              help='Read mappings from a JSON file ({"old": "new", ...}).')
@click.option('--dry-run', is_flag=True, help='Show what would change without modifying files.')
def rewrite(mappings: tuple[str, ...], json_file: str | None, dry_run: bool) -> None:
    """Rewrite doc refs across the workspace using user-supplied mappings."""
    rename_map: dict[str, str] = {}

    # Parse --map flags
    for pair in mappings:
        if '=' not in pair:
            click.echo(f"Error: invalid mapping {pair!r} — expected old=new format.", err=True)
            raise SystemExit(1)
        old, new = pair.split('=', 1)
        rename_map[old.strip()] = new.strip()

    # Parse --from-json
    if json_file:
        try:
            with open(json_file, encoding='utf-8') as f:
                json_map = json.load(f)
            if not isinstance(json_map, dict):
                click.echo("Error: JSON file must contain an object {\"old\": \"new\", ...}.", err=True)
                raise SystemExit(1)
            rename_map.update(json_map)
        except (json.JSONDecodeError, OSError) as e:
            click.echo(f"Error reading JSON file: {e}", err=True)
            raise SystemExit(1)

    if not rename_map:
        click.echo("Error: no mappings provided. Use --map or --from-json.", err=True)
        raise SystemExit(1)

    carta_root = find_carta_root()
    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)

    manifest_path = carta_root / "MANIFEST.md"
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]

    if dry_run:
        import re
        click.echo(f"=== Ref rewrite plan ({len(rename_map)} mappings) ===")
        for old, new in sorted(rename_map.items()):
            click.echo(f"  {old} -> {new}")
        click.echo(f"\nScanning {len(md_files)} file(s)...")

        # Do a dry-run scan: read files, count matches, don't write
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
                    try:
                        display = str(fpath.relative_to(carta_root))
                    except ValueError:
                        display = str(fpath)
                    click.echo(f"  {display}: {len(matches)} match(es) for {old}")

        click.echo(f"\nTotal: {total} replacement(s) would be made.")
        click.echo("(dry-run: no files modified)")
        return

    results = rewrite_refs(md_files, rename_map)

    total = sum(results.values())
    click.echo(f"Rewrote {total} ref(s) across {len(results)} file(s).")
    if results:
        for fpath, count in sorted(results.items(), key=lambda x: str(x[0])):
            try:
                display = str(fpath.relative_to(carta_root))
            except ValueError:
                display = str(fpath)
            click.echo(f"  {display}: {count}")
