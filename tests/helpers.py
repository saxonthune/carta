"""Shared test utilities for the carta_cli test suite."""

import re

_VERSION_RE = re.compile(r"v\d+\.\d+\.\d+(?:[-.][\w.]+)?")


def normalize_output(text: str, *replace_paths) -> str:
    """Scrub volatile values (temp paths, version strings) for stable snapshots."""
    for p in replace_paths:
        text = text.replace(str(p), "<TMPDIR>")
    text = _VERSION_RE.sub("<VERSION>", text)
    return text
