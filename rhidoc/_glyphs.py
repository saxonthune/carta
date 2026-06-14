"""_glyphs.py — terminal glyph vocabulary with ASCII fallback for non-UTF-8 consoles."""
from dataclasses import dataclass
from typing import TextIO
import sys


@dataclass(frozen=True)
class Glyphs:
    branch: str   # mid-list tree connector
    leaf: str     # last-in-list tree connector
    vguide: str   # vertical continuation
    indent: str   # blank continuation
    arrow: str    # "from <arrow> to"
    dash: str     # " -- " label separator
    attach: str   # attachment marker


UNICODE = Glyphs(branch="├── ", leaf="└── ", vguide="│   ", indent="    ",
                 arrow="→", dash=" -- ", attach="📎 ")

# Classic `tree`-command ASCII style. dash is " -- " in BOTH sets (no em-dash anywhere).
ASCII = Glyphs(branch="|-- ", leaf="`-- ", vguide="|   ", indent="    ",
               arrow="->", dash=" -- ", attach="* ")


def supports_unicode(stream: TextIO) -> bool:
    """True if the stream's encoding can represent the Unicode glyph set."""
    enc = getattr(stream, "encoding", None) or ""
    try:
        UNICODE.attach.encode(enc)
        return True
    except (UnicodeEncodeError, LookupError):
        return False


def for_stream(stream: TextIO = sys.stdout) -> Glyphs:
    """Resolve the appropriate glyph set for the given output stream."""
    return UNICODE if supports_unicode(stream) else ASCII
