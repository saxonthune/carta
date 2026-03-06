import re
from pathlib import Path

from .numbering import get_numeric_prefix
from .ref_convert import ref_to_path


_REF_RE = re.compile(r'^doc\d{2}(\.\d{2})*$')


def list_numbered_entries(directory: Path) -> list[Path]:
    """Return directory entries that have a 2-digit numeric prefix, sorted by prefix."""
    entries = [
        p for p in directory.iterdir()
        if get_numeric_prefix(p.name) is not None
    ]
    return sorted(entries, key=lambda p: get_numeric_prefix(p.name))


def resolve_arg(arg: str, carta_root: Path) -> Path:
    """Resolve a ref or relative path argument to an absolute filesystem path."""
    if _REF_RE.match(arg):
        return ref_to_path(arg, carta_root)
    # Treat as path relative to carta_root
    path = (carta_root / arg).resolve()
    return path
