"""DocRef and EntryName — the two formal grammars for carta doc references.

DocRef owns the coordinate grammar (docXX.YY.ZZ).
EntryName owns the filesystem entry-name grammar (NN-slug.ext).

Neither is wired into existing call sites yet; this module is a standalone
foundation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar

from .errors import CartaError

# ---------------------------------------------------------------------------
# DocRef — the coordinate value object
# ---------------------------------------------------------------------------

_LENIENT_PREFIX = re.compile(r'^(?:doc|d)?(\d{2}(?:\.\d{2})*)$')
_SEGMENT_RE = re.compile(r'^\d{2}$')
_SIDECAR_RE = re.compile(r'^(\d{2})-(.*?)(\.[^.]+)$')
_NUMERIC_PREFIX_RE = re.compile(r'^(\d{2})-')


@dataclass(frozen=True)
class DocRef:
    """Coordinate for a .carta/ document: XX.YY.ZZ as a tuple of ints.

    Two grammars, intentionally kept separate:
    - parse()  — lenient (CLI input), accepts doc/d/bare prefixes
    - SCAN     — strict (prose scanning), canonical ``docNN`` form only
    """

    segments: tuple[int, ...]

    # Strict regex for finding refs embedded in prose.
    # Matches canonical `docNN(.NN)*` only — bare coordinates are excluded
    # to avoid false-positives on dates and version numbers.
    # Negative lookahead blocks file extensions (`.md`, `.yaml`, etc.)
    # and single-digit continuations.
    SCAN: ClassVar[re.Pattern] = re.compile(
        r'(?<!\w)doc\d{2}(?:\.\d{2})*(?!\.[a-zA-Z0-9])'
    )

    @classmethod
    def parse(cls, raw: str) -> DocRef:
        """Parse a doc ref in any of the three accepted surface forms.

        Accepts: docXX.YY.ZZ | dXX.YY.ZZ | XX.YY.ZZ
        Raises CartaError on malformed input.
        """
        s = raw.strip()

        # Strip optional doc/d prefix
        if s.startswith("doc"):
            s = s[3:]
        elif s.startswith("d") and len(s) > 1 and s[1].isdigit():
            s = s[1:]

        # Validate: non-empty, and each part is exactly two digits
        if not s:
            raise CartaError(f"Invalid doc ref: {raw!r}")

        parts = s.split(".")
        for part in parts:
            if not _SEGMENT_RE.match(part):
                raise CartaError(
                    f"Invalid doc ref {raw!r}: each segment must be exactly 2 digits, "
                    f"got {part!r}"
                )

        return cls(segments=tuple(int(p) for p in parts))

    def __str__(self) -> str:
        """Canonical form: docXX.YY.ZZ (zero-padded 2-digit segments)."""
        return "doc" + ".".join(f"{s:02d}" for s in self.segments)

    def to_path(self, carta_root: Path) -> Path:
        """Resolve this ref to a filesystem path under carta_root.

        Walks segment by segment, preferring .md files or directories when
        a prefix is shared with sidecars (bundle attachment tiebreak).

        Raises FileNotFoundError if any segment cannot be resolved.
        """
        current = carta_root
        for seg in self.segments:
            prefix = f"{seg:02d}-"
            matches = [p for p in current.iterdir() if p.name.startswith(prefix)]
            if not matches:
                raise FileNotFoundError(
                    f"Cannot resolve segment '{seg:02d}' in {current}: "
                    f"no entry starting with {prefix!r}"
                )
            if len(matches) > 1:
                md_or_dir = [p for p in matches if p.suffix == ".md" or p.is_dir()]
                if len(md_or_dir) == 1:
                    matches = md_or_dir
                else:
                    raise FileNotFoundError(
                        f"Ambiguous segment '{seg:02d}' in {current}: "
                        f"multiple matches: {[p.name for p in matches]}"
                    )
            current = matches[0]
        return current

    @classmethod
    def from_path(cls, path: Path, carta_root: Path) -> DocRef:
        """Derive a DocRef from a filesystem path under carta_root.

        For .md files and directories: extracts the NN prefix from each
        path component relative to carta_root.

        For non-md sidecars with a NN- prefix: validates a host .md exists
        (raises ValueError for orphans), then returns the coordinate that
        includes the sidecar's own prefix as the final segment.

        Raises ValueError if any component lacks a 2-digit prefix.
        """
        rel = path.relative_to(carta_root)
        parts = list(rel.parts)

        last = parts[-1]
        if not last.endswith(".md") and len(parts) >= 2:
            sidecar_m = _SIDECAR_RE.match(last)
            if sidecar_m:
                prefix_str = sidecar_m.group(1)

                parent_dir = path.parent
                has_md_root = any(
                    p.suffix == ".md" and p.name.startswith(f"{prefix_str}-")
                    for p in parent_dir.iterdir()
                )
                if not has_md_root:
                    raise ValueError(
                        f"Sidecar {last!r} is an orphan — "
                        f"no host .md with prefix {prefix_str}"
                    )

                segments: list[int] = []
                for part in parts[:-1]:
                    stem = part[:-3] if part.endswith(".md") else part
                    m = _NUMERIC_PREFIX_RE.match(stem)
                    if not m:
                        raise ValueError(
                            f"Path component {part!r} does not have a "
                            f"2-digit numeric prefix"
                        )
                    segments.append(int(m.group(1)))
                segments.append(int(prefix_str))
                return cls(segments=tuple(segments))

        # Standard: .md files and directories
        segments = []
        for part in parts:
            stem = part[:-3] if part.endswith(".md") else part
            m = _NUMERIC_PREFIX_RE.match(stem)
            if not m:
                raise ValueError(
                    f"Path component {part!r} does not have a "
                    f"2-digit numeric prefix"
                )
            segments.append(int(m.group(1)))
        return cls(segments=tuple(segments))


# ---------------------------------------------------------------------------
# EntryName — the NN-slug.ext decomposition
# ---------------------------------------------------------------------------

_ENTRY_NAME_RE = re.compile(r'^(\d{2})-(.+)$')


@dataclass(frozen=True)
class EntryName:
    """Decomposition of a .carta/ filesystem entry name into its structural parts.

    The slug is descriptive only; it is never load-bearing for navigation.
    The prefix is the 2-digit coordinate segment.
    """

    prefix: int
    slug: str
    ext: str | None

    @classmethod
    def parse(cls, name: str) -> EntryName | None:
        """Parse a NN-slug.ext entry name.

        Returns None when the name has no NN- prefix (e.g. README.md).
        The slug is everything between the dash and the final extension.
        ext is the final '.xxx' suffix, or None for directory names.
        """
        m = _ENTRY_NAME_RE.match(name)
        if not m:
            return None

        prefix = int(m.group(1))
        rest = m.group(2)

        dot_idx = rest.rfind(".")
        if dot_idx == -1:
            slug = rest
            ext = None
        else:
            slug = rest[:dot_idx]
            ext = rest[dot_idx:]

        return cls(prefix=prefix, slug=slug, ext=ext)


# ---------------------------------------------------------------------------
# DocEntry — a resolved coordinate bound to its filesystem location
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DocEntry:
    """A DocRef paired with the filesystem path it resolved to.

    ref  — the logical coordinate (DocRef); may be DocRef(segments=()) for
            brand-new unnumbered targets where derivation is not possible.
    path — the physical location (absolute Path).
    """

    ref: DocRef
    path: Path

    @property
    def slug(self) -> str:
        entry = EntryName.parse(self.path.name)
        return entry.slug if entry is not None else self.path.stem
