"""workspace.py — read .rhidoc.json marker and resolve workspace paths."""

from pathlib import Path
import json

from .rewriter import collect_md_files

MARKER = ".rhidoc.json"


def find_marker() -> Path:
    """Walk up from cwd to find .rhidoc.json (like git finds .git/)."""
    current = Path.cwd().resolve()
    for candidate in [current, *current.parents]:
        marker = candidate / MARKER
        if marker.exists():
            return marker
    raise FileNotFoundError(
        f"{MARKER} not found in any directory above cwd. "
        "Are you inside a Rhidoc workspace?"
    )


def find_workspace() -> Path:
    """Find the workspace docs directory via .rhidoc.json marker."""
    marker = find_marker()
    config = json.loads(marker.read_text())
    root_rel = config.get("root", ".rhidoc/")
    workspace = (marker.parent / root_rel).resolve()
    if not workspace.is_dir():
        raise FileNotFoundError(
            f"Workspace root {root_rel!r} from {marker} does not exist."
        )
    return workspace


def load_workspace(root: Path) -> dict:
    """Parse .rhidoc.json from the repo root (parent of docs directory)."""
    marker = root.parent / MARKER
    if not marker.exists():
        raise FileNotFoundError(f"{MARKER} not found at {marker}")
    return json.loads(marker.read_text())


def get_external_ref_paths(ws: dict, root: Path) -> list[Path]:
    """Expand externalRefPaths globs relative to the repo root (parent of workspace dir).

    Returns a flat list of resolved Path objects for all matching files.
    Only returns paths that exist.
    """
    repo_root = root.parent
    globs = ws.get("externalRefPaths", [])
    paths: list[Path] = []
    for pattern in globs:
        for match in repo_root.glob(pattern):
            if match.is_file():
                paths.append(match.resolve())
    return paths


def collect_rewritable_files(rhidoc_root: Path) -> list[Path]:
    """Collect all .md files eligible for ref rewriting (excludes MANIFEST.md)."""
    manifest_path = rhidoc_root / "MANIFEST.md"
    ws = load_workspace(rhidoc_root)
    external_paths = get_external_ref_paths(ws, rhidoc_root)
    return [
        f for f in collect_md_files(rhidoc_root, external_paths)
        if f.resolve() != manifest_path.resolve()
    ]
