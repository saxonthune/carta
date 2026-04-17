import re
from pathlib import Path

from .numbering import get_numeric_prefix
from .ref_convert import ref_to_path
from .errors import CartaError


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
    workspace_name = carta_root.name
    if arg == workspace_name or arg.startswith(f"{workspace_name}/"):
        stripped = arg[len(workspace_name) + 1:] if arg != workspace_name else ""
        hint = f" Try: {stripped!r}" if stripped else ""
        raise CartaError(
            f"Error: path must be relative to workspace root, without the "
            f"{workspace_name!r} prefix. Got: {arg!r}.{hint}"
        )
    path = (carta_root / arg).resolve()
    return path


def resolve_and_validate(arg: str, carta_root: Path, *, must_exist: bool = True) -> Path:
    """Resolve a ref or path and validate it exists. Raises CartaError on failure."""
    try:
        path = resolve_arg(arg, carta_root)
    except (FileNotFoundError, ValueError) as e:
        raise CartaError(f"Error resolving {arg!r}: {e}")
    if must_exist and not path.exists():
        raise CartaError(f"Error: does not exist: {path}")
    return path


def display_path(path: Path, carta_root: Path) -> str:
    """Format a path for display, relative to workspace or repo root."""
    try:
        return str(path.relative_to(carta_root))
    except ValueError:
        try:
            return str(path.relative_to(carta_root.parent))
        except ValueError:
            return str(path)
