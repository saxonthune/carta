"""workspace.py — read workspace.json and resolve externalRefPaths."""

from pathlib import Path
import json


def find_workspace() -> Path:
    """Walk up from cwd to find the .carta/ workspace root (contains workspace.json)."""
    current = Path.cwd().resolve()
    for candidate in [current, *current.parents]:
        carta_dir = candidate / ".carta"
        if (carta_dir / "workspace.json").exists():
            return carta_dir
    raise FileNotFoundError(
        "workspace.json not found in any .carta/ directory above the current directory. "
        "Are you inside a Carta workspace?"
    )


def load_workspace(root: Path) -> dict:
    """Parse workspace.json from the .carta/ root."""
    return json.loads((root / "workspace.json").read_text())


def get_external_ref_paths(ws: dict, root: Path) -> list[Path]:
    """Expand externalRefPaths globs relative to the repo root (parent of .carta/).

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
