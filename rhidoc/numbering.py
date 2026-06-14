from pathlib import Path

from .docref import EntryName


def compute_insertion_prefix(entries: list[Path], order: int | None) -> int:
    existing_prefixes = [e.prefix for p in entries if (e := EntryName.parse(p.name))]
    if order is None:
        return (max(existing_prefixes) + 1) if existing_prefixes else 1
    return order
