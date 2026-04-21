"""Shared test utilities for the carta_cli test suite."""


def normalize_output(text: str, *replace_paths) -> str:
    """Replace absolute temp-dir paths with <TMPDIR> for stable snapshots."""
    for p in replace_paths:
        text = text.replace(str(p), "<TMPDIR>")
    return text
