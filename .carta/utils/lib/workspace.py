"""workspace.py — read workspace.json and resolve externalRefPaths."""

from pathlib import Path
import json


def find_carta_root() -> Path:
    """Walk up from this file's location to find the .carta/ root (contains workspace.json)."""
    # This file is at .carta/utils/lib/workspace.py
    # .carta/ root is two levels up: lib -> utils -> .carta/
    candidate = Path(__file__).resolve().parent.parent.parent
    if (candidate / "workspace.json").exists():
        return candidate
    raise FileNotFoundError(
        f"workspace.json not found at {candidate}. "
        "Is this script inside a .carta/utils/lib/ directory?"
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
