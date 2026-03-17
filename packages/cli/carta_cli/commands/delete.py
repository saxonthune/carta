"""delete command — delete doc entries with automatic gap-closing."""

import re
import shutil
from pathlib import Path

import click

from ..entries import resolve_arg, list_numbered_entries
from ..numbering import get_numeric_prefix, get_slug
from ..planning import compute_rename_map
from ..ref_convert import path_to_ref
from ..rewriter import collect_md_files, rewrite_refs
from ..workspace import load_workspace, get_external_ref_paths
from .regenerate import do_regenerate


def _collect_refs_under(path: Path, carta_root: Path) -> set[str]:
    """Collect all doc refs for a path and its descendants."""
    refs: set[str] = set()
    try:
        refs.add(path_to_ref(path, carta_root))
    except ValueError:
        pass

    if path.is_dir():
        for child in path.rglob("*"):
            try:
                refs.add(path_to_ref(child, carta_root))
            except ValueError:
                pass

    return refs


def _find_orphaned_refs(
    md_files: list[Path], deleted_refs: set[str]
) -> list[tuple[Path, str, str]]:
    """Scan md files for references to deleted refs.

    Returns (file_path, line_text, ref) triples.
    """
    if not deleted_refs:
        return []

    # Build pattern that matches any deleted ref
    ref_pattern = re.compile(r'(?<!\w)(doc\d{2}(?:\.\d{2})*)(?!\.[a-zA-Z0-9])')
    orphans: list[tuple[Path, str, str]] = []

    for fpath in md_files:
        try:
            text = fpath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        for m in ref_pattern.finditer(text):
            if m.group(1) in deleted_refs:
                # Get the line containing this match
                line_start = text.rfind("\n", 0, m.start()) + 1
                line_end = text.find("\n", m.end())
                if line_end == -1:
                    line_end = len(text)
                line_text = text[line_start:line_end].strip()
                orphans.append((fpath, line_text, m.group(1)))

    return orphans


@click.command()
@click.argument("targets", nargs=-1, required=True)
@click.option("--dry-run", is_flag=True, help="Print planned changes without executing.")
@click.option("--output-mapping", is_flag=True,
              help="Print the computed rename map as JSON to stdout after execution.")
@click.pass_context
def delete(ctx: click.Context, targets: tuple[str, ...], dry_run: bool, output_mapping: bool) -> None:
    """Delete one or more doc entries with automatic gap-closing."""
    carta_root = ctx.obj["workspace"]

    # Resolve all targets
    target_paths: list[Path] = []
    for target in targets:
        try:
            path = resolve_arg(target, carta_root)
        except (FileNotFoundError, ValueError) as e:
            click.echo(f"Error resolving {target!r}: {e}", err=True)
            raise SystemExit(1)

        if not path.exists():
            click.echo(f"Error: does not exist: {path}", err=True)
            raise SystemExit(1)

        target_paths.append(path)

    # Collect all refs that will be deleted
    deleted_refs: set[str] = set()
    for path in target_paths:
        deleted_refs |= _collect_refs_under(path, carta_root)

    # Group targets by parent directory for gap-closing
    parents: dict[Path, list[Path]] = {}
    for path in target_paths:
        parent = path.parent
        parents.setdefault(parent, []).append(path)

    # Compute gap-closing moves for each affected parent
    all_moves: list[tuple[Path, Path]] = []
    for parent_dir, deleted_in_parent in parents.items():
        deleted_set = {p.resolve() for p in deleted_in_parent}
        entries = list_numbered_entries(parent_dir)
        remaining = [e for e in entries if e.resolve() not in deleted_set]

        # Renumber remaining entries sequentially
        next_prefix = 1
        for entry in remaining:
            current_prefix = get_numeric_prefix(entry.name)
            # Skip 00-index entries
            if current_prefix == 0:
                next_prefix = 1
                continue
            if current_prefix != next_prefix:
                new_name = f"{next_prefix:02d}-{get_slug(entry.name)}"
                new_path = parent_dir / new_name
                all_moves.append((entry, new_path))
            next_prefix += 1

    # Compute rename map from gap-closing moves
    rename_map = compute_rename_map(all_moves, carta_root)

    # Scan for orphaned refs (refs pointing to deleted entries)
    manifest_path = carta_root / "MANIFEST.md"
    ws = load_workspace(carta_root)
    external_paths = get_external_ref_paths(ws, carta_root)
    md_files = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
        and not any(f.resolve() == tp.resolve() or
                    (tp.is_dir() and _is_under(f, tp))
                    for tp in target_paths)
    ]

    orphaned = _find_orphaned_refs(md_files, deleted_refs)

    repo_root = carta_root.parent

    def _display_path(p: Path) -> str:
        """Display path relative to carta_root if possible, else repo root."""
        try:
            return str(p.relative_to(carta_root))
        except ValueError:
            try:
                return str(p.relative_to(repo_root))
            except ValueError:
                return str(p)

    if dry_run:
        click.echo("=== Planned deletions ===")
        for path in target_paths:
            kind = "directory" if path.is_dir() else "file"
            click.echo(f"  DELETE {kind}: {path.relative_to(carta_root)}")

        if deleted_refs:
            click.echo(f"\nRefs removed ({len(deleted_refs)}):")
            for ref in sorted(deleted_refs):
                click.echo(f"  {ref}")

        if all_moves:
            click.echo(f"\n=== Gap-closing moves ({len(all_moves)}) ===")
            for old, new in all_moves:
                click.echo(f"  {old.relative_to(carta_root)} -> {new.relative_to(carta_root)}")

        if rename_map:
            click.echo(f"\n=== Ref rename map ({len(rename_map)} entries) ===")
            for old_ref, new_ref in sorted(rename_map.items()):
                click.echo(f"  {old_ref} -> {new_ref}")

        if orphaned:
            click.echo(f"\n=== Orphaned ref warnings ({len(orphaned)}) ===")
            for fpath, line, ref in orphaned:
                click.echo(f"  {ref} in {_display_path(fpath)}")

        if output_mapping and rename_map:
            import json
            click.echo(json.dumps(rename_map, indent=2))
        elif output_mapping:
            click.echo("{}")

        click.echo("\n(dry-run: no files modified)")
        return

    # Execute: delete targets
    for path in target_paths:
        if path.is_dir():
            shutil.rmtree(str(path))
        else:
            path.unlink()

    # Execute gap-closing moves (lowest-prefix first avoids collisions)
    for old_path, new_path in all_moves:
        if old_path.exists():
            shutil.move(str(old_path), str(new_path))

    # Rewrite refs across workspace
    # Re-collect md_files since some were deleted
    md_files_after = [
        f for f in collect_md_files(carta_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]
    rewrite_results = rewrite_refs(md_files_after, rename_map)

    # Rebuild manifest
    do_regenerate(carta_root)

    # Summary
    click.echo(f"Deleted {len(target_paths)} entry(ies):")
    for path in target_paths:
        click.echo(f"  {path.relative_to(carta_root)}")

    if all_moves:
        click.echo(f"Gap-closed: {len(all_moves)} sibling(s) renumbered")

    refs_touched = len(rewrite_results)
    total_replacements = sum(rewrite_results.values())
    if total_replacements:
        click.echo(f"Refs updated: {total_replacements} replacement(s) across {refs_touched} file(s)")

    if rename_map:
        click.echo(f"Rename map ({len(rename_map)} entries):")
        for old_ref, new_ref in sorted(rename_map.items()):
            click.echo(f"  {old_ref} -> {new_ref}")

    if orphaned:
        click.echo(f"\nWarning: {len(orphaned)} orphaned ref(s) remain in the workspace:")
        for fpath, line, ref in orphaned:
            click.echo(f"  {ref} in {_display_path(fpath)}")

    if output_mapping and rename_map:
        import json
        click.echo(json.dumps(rename_map, indent=2))
    elif output_mapping:
        click.echo("{}")


def _is_under(path: Path, parent: Path) -> bool:
    """Check if path is under parent directory."""
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False
