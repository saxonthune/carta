import re
from pathlib import Path

from .docref import DocRef, DocEntry, EntryName
from .errors import CartaError


_PREFIX_RE = re.compile(r'^\d{2}$')


def list_numbered_entries(directory: Path) -> list[Path]:
    """Return directory entries that have a 2-digit numeric prefix, sorted by prefix."""
    entries = [
        p for p in directory.iterdir()
        if EntryName.parse(p.name) is not None
    ]
    return sorted(entries, key=lambda p: EntryName.parse(p.name).prefix)


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
        # Tiebreak: prefer the single .md file or directory (mirrors DocRef.to_path)
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


def _make_entry(path: Path, carta_root: Path) -> DocEntry:
    """Construct a DocEntry, deriving the ref best-effort.

    If path lacks NN- prefixed components (brand-new unnumbered target,
    or path == carta_root itself), ref derivation falls back to a sentinel.
    Callers should use .path, not .ref, in those cases.
    """
    try:
        ref = DocRef.from_path(path, carta_root)
    except (ValueError, IndexError):
        ref = DocRef(segments=())
    return DocEntry(ref=ref, path=path)


def resolve_arg(arg: str, carta_root: Path) -> DocEntry:
    """Resolve a ref or relative path argument to a DocEntry."""
    if re.match(r'^doc\d{2}(\.\d{2})*$', arg):
        ref = DocRef.parse(arg)
        path = ref.to_path(carta_root)
        return DocEntry(ref=ref, path=path)
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
        return _make_entry(literal, carta_root)
    # Filesystem-aware fallback: accept stem-only and prefix-only path forms
    matched = _fuzzy_match(arg, carta_root)
    if matched is not None:
        return _make_entry(matched, carta_root)
    return _make_entry(literal, carta_root)


def resolve_and_validate(arg: str, carta_root: Path, *, must_exist: bool = True) -> DocEntry:
    """Resolve a ref or path and validate it exists. Returns DocEntry on success."""
    try:
        entry = resolve_arg(arg, carta_root)
    except (FileNotFoundError, ValueError) as e:
        raise CartaError(f"Error resolving {arg!r}: {e}")
    if must_exist and not entry.path.exists():
        suggestion = _fuzzy_match(arg, carta_root)
        if suggestion is not None:
            try:
                ref = DocRef.from_path(suggestion, carta_root)
                hint = f"\n       did you mean: {suggestion} (or {str(ref)})?"
            except ValueError:
                hint = f"\n       did you mean: {suggestion}?"
            raise CartaError(f"Error: does not exist: {entry.path}{hint}")
        raise CartaError(f"Error: does not exist: {entry.path}")
    return entry


def display_path(path: Path, carta_root: Path) -> str:
    """Format a path for display, relative to workspace or repo root."""
    try:
        return str(path.relative_to(carta_root))
    except ValueError:
        try:
            return str(path.relative_to(carta_root.parent))
        except ValueError:
            return str(path)
