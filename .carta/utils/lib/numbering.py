import re
from pathlib import Path


def get_numeric_prefix(name: str) -> int | None:
    """Extract the leading 2-digit numeric prefix from a directory entry name."""
    m = re.match(r'^(\d{2})-', name)
    return int(m.group(1)) if m else None


def get_slug(name: str) -> str:
    """Get everything after NN- from a directory entry name."""
    m = re.match(r'^\d{2}-(.*)', name)
    return m.group(1) if m else name


def compute_insertion_prefix(entries: list[Path], order: int | None) -> int:
    existing_prefixes = [get_numeric_prefix(p.name) for p in entries]
    if order is None:
        return (max(existing_prefixes) + 1) if existing_prefixes else 1
    return order
