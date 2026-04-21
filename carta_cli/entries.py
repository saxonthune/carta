import re
from pathlib import Path

from .numbering import get_numeric_prefix
from .ref_convert import ref_to_path, path_to_ref
from .errors import CartaError


_REF_RE = re.compile(r'^doc\d{2}(\.\d{2})*$')
_PREFIX_RE = re.compile(r'^\d{2}$')


def list_numbered_entries(directory: Path) -> list[Path]:
    """Return directory entries that have a 2-digit numeric prefix, sorted by prefix."""
    entries = [
        p for p in directory.iterdir()
        if get_numeric_prefix(p.name) is not None
    ]
    return sorted(entries, key=lambda p: get_numeric_prefix(p.name))


def _match_path_segment(directory: Path, segment: str) -> Path | None:
    """Match one path segment within directory. Returns None if no unambiguous match."""
    if not directory.is_dir():
        return None
    # Exact name or stem-without-.md match
    exact = directory / segment
    if exact.exists():
        return exact
    exact_md = directory / (segment + ".md")
    if exact_md.exists():
        return exact_md
    # Prefix-only match: segment is exactly two digits
    if _PREFIX_RE.match(segment):
        prefix = segment + "-"
        matches = [p for p in directory.iterdir() if p.name.startswith(prefix)]
        if not matches:
            return None
        if len(matches) == 1:
            return matches[0]
        # Tiebreak: prefer the single .md file or directory (mirrors ref_to_path)
        md_or_dir = [p for p in matches if p.suffix == ".md" or p.is_dir()]
        if len(md_or_dir) == 1:
            return md_or_dir[0]
        return None  # Ambiguous
    return None


def _fuzzy_match(arg: str, carta_root: Path) -> Path | None:
    """Walk arg split on '/' using _match_path_segment. Returns matched path or None."""
    segments = arg.split("/")
    current = carta_root
    for segment in segments:
        matched = _match_path_segment(current, segment)
        if matched is None:
            return None
        current = matched
    return current


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
    literal = (carta_root / arg).resolve()
    if literal.exists():
        return literal
    # Filesystem-aware fallback: accept stem-only and prefix-only path forms
    matched = _fuzzy_match(arg, carta_root)
    if matched is not None:
        return matched
    return literal


def resolve_and_validate(arg: str, carta_root: Path, *, must_exist: bool = True) -> Path:
    """Resolve a ref or path and validate it exists. Raises CartaError on failure."""
    try:
        path = resolve_arg(arg, carta_root)
    except (FileNotFoundError, ValueError) as e:
        raise CartaError(f"Error resolving {arg!r}: {e}")
    if must_exist and not path.exists():
        suggestion = _fuzzy_match(arg, carta_root)
        if suggestion is not None:
            try:
                ref = path_to_ref(suggestion, carta_root)
                hint = f"\n       did you mean: {suggestion} (or {ref})?"
            except ValueError:
                hint = f"\n       did you mean: {suggestion}?"
            raise CartaError(f"Error: does not exist: {path}{hint}")
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
