import re
from pathlib import Path

from .docref import DocRef, DocEntry, EntryName
from .errors import CartaError


# Lenient ref pattern: doc/d prefix optional, bare coordinates accepted.
# Matches docXX.YY.ZZ | dXX.YY.ZZ | XX.YY.ZZ (but NOT filesystem paths with slashes).
_REF_RE = re.compile(r'^(?:doc|d)?\d{2}(\.\d{2})*$')


def list_numbered_entries(directory: Path) -> list[Path]:
    """Return directory entries that have a 2-digit numeric prefix, sorted by prefix."""
    entries = [
        p for p in directory.iterdir()
        if EntryName.parse(p.name) is not None
    ]
    return sorted(entries, key=lambda p: EntryName.parse(p.name).prefix)


def _fuzzy_match(arg: str, carta_root: Path) -> Path | None:
    """Walk arg through the workspace looking for a close match. For error hints only."""
    segments = arg.split("/")
    current = carta_root
    for segment in segments:
        if not current.is_dir():
            return None
        # Exact name or stem-without-.md match
        exact = current / segment
        if exact.exists():
            current = exact
            continue
        exact_md = current / (segment + ".md")
        if exact_md.exists():
            current = exact_md
            continue
        # Prefix-only match: segment is exactly two digits
        if re.match(r'^\d{2}$', segment):
            prefix = segment + "-"
            matches = [p for p in current.iterdir() if p.name.startswith(prefix)]
            if not matches:
                return None
            if len(matches) == 1:
                current = matches[0]
                continue
            md_or_dir = [p for p in matches if p.suffix == ".md" or p.is_dir()]
            if len(md_or_dir) == 1:
                current = md_or_dir[0]
                continue
        return None
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
    """Resolve a ref or real filesystem path to a DocEntry.

    Accepts:
      - Doc ref forms: docXX.YY.ZZ | dXX.YY.ZZ | XX.YY.ZZ  (normalized to canonical)
      - Real existing filesystem paths relative to workspace root

    Raises CartaError for malformed refs or workspace-prefix paths.
    Returns a DocEntry with .path pointing to the resolved location (may not exist).
    """
    workspace_name = carta_root.name
    if arg == workspace_name or arg.startswith(f"{workspace_name}/"):
        stripped = arg[len(workspace_name) + 1:] if arg != workspace_name else ""
        hint = f" Try: {stripped!r}" if stripped else ""
        raise CartaError(
            f"Error: path must be relative to workspace root, without the "
            f"{workspace_name!r} prefix. Got: {arg!r}.{hint}"
        )

    # Ref form: docXX.YY | dXX.YY | XX.YY — parse and resolve via coordinate walk
    if _REF_RE.match(arg):
        ref = DocRef.parse(arg)  # raises CartaError on malformed input
        path = ref.to_path(carta_root)
        return DocEntry(ref=ref, path=path)

    # Real filesystem path (existing or not — callers check existence)
    literal = (carta_root / arg).resolve()
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
