"""Tests for carta_cli/docref.py — DocRef and EntryName value objects."""
import re
import sys
from pathlib import Path

import pytest

_CLI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_CLI_DIR))

from carta_cli.docref import DocRef, EntryName
from carta_cli.errors import CartaError


# ---------------------------------------------------------------------------
# DocRef.parse — lenient input
# ---------------------------------------------------------------------------

def test_parse_all_three_forms_equal():
    a = DocRef.parse("doc04.08.01")
    b = DocRef.parse("d04.08.01")
    c = DocRef.parse("04.08.01")
    assert a == b == c


def test_parse_canonical_form():
    ref = DocRef.parse("doc04.08.01")
    assert ref.segments == (4, 8, 1)


def test_parse_d_prefix():
    ref = DocRef.parse("d04.08.01")
    assert ref.segments == (4, 8, 1)


def test_parse_bare_coordinate():
    ref = DocRef.parse("04.08.01")
    assert ref.segments == (4, 8, 1)


def test_parse_single_segment():
    assert DocRef.parse("doc04").segments == (4,)
    assert DocRef.parse("04").segments == (4,)


def test_parse_deep_ref():
    ref = DocRef.parse("doc03.01.05.10")
    assert ref.segments == (3, 1, 5, 10)


def test_parse_zero_padded_segments():
    ref = DocRef.parse("doc00.01")
    assert ref.segments == (0, 1)


# ---------------------------------------------------------------------------
# DocRef.parse — malformed input raises CartaError
# ---------------------------------------------------------------------------

def test_parse_single_digit_segment_raises():
    with pytest.raises(CartaError):
        DocRef.parse("04.8")


def test_parse_trailing_dot_raises():
    with pytest.raises(CartaError):
        DocRef.parse("doc04.")


def test_parse_non_numeric_raises():
    with pytest.raises(CartaError):
        DocRef.parse("foo")


def test_parse_empty_raises():
    with pytest.raises(CartaError):
        DocRef.parse("")


def test_parse_slug_attached_raises():
    # "04-product" is an entry name, not a ref
    with pytest.raises(CartaError):
        DocRef.parse("04-product")


def test_parse_three_digit_segment_raises():
    with pytest.raises(CartaError):
        DocRef.parse("doc004.08")


def test_parse_leading_trailing_whitespace_stripped():
    # parse should tolerate surrounding whitespace
    ref = DocRef.parse("  doc04.08  ")
    assert ref.segments == (4, 8)


# ---------------------------------------------------------------------------
# DocRef.__str__ — canonical output
# ---------------------------------------------------------------------------

def test_str_canonical_from_bare():
    assert str(DocRef.parse("04.08.01")) == "doc04.08.01"


def test_str_canonical_from_d_prefix():
    assert str(DocRef.parse("d04.08.01")) == "doc04.08.01"


def test_str_zero_pads_segments():
    assert str(DocRef.parse("01.02")) == "doc01.02"


def test_str_single_segment():
    assert str(DocRef.parse("04")) == "doc04"


def test_str_round_trip():
    original = "doc03.01.05.10"
    assert str(DocRef.parse(original)) == original


# ---------------------------------------------------------------------------
# DocRef.SCAN — strict prose scanner
# ---------------------------------------------------------------------------

def test_scan_matches_canonical():
    m = DocRef.SCAN.search("See doc04.08 for details.")
    assert m is not None
    assert m.group() == "doc04.08"


def test_scan_matches_single_segment():
    m = DocRef.SCAN.search("Refer to doc04.")
    assert m is not None
    assert m.group() == "doc04"


def test_scan_matches_deep():
    m = DocRef.SCAN.search("Per doc03.01.05.10.")
    assert m is not None
    assert m.group() == "doc03.01.05.10"


def test_scan_does_not_match_bare_coordinate():
    assert DocRef.SCAN.search("see 04.08 for details") is None


def test_scan_does_not_match_date():
    assert DocRef.SCAN.search("date is 2026.06.13") is None


def test_scan_does_not_match_doc_with_md_extension():
    # doc04.08.md — the .md suffix should block the match
    assert DocRef.SCAN.search("doc04.08.md") is None


def test_scan_does_not_match_preceded_by_word_char():
    assert DocRef.SCAN.search("xdoc04.08") is None


def test_scan_finds_multiple_in_prose():
    text = "See doc01.02 and doc03.04 for context."
    matches = DocRef.SCAN.findall(text)
    assert matches == ["doc01.02", "doc03.04"]


def test_scan_blocks_continuation_digit():
    # doc04.08.1 — single-digit segment, should NOT match doc04.08 (blocked by .1)
    assert DocRef.SCAN.search("doc04.08.1") is None


# ---------------------------------------------------------------------------
# DocRef.to_path / from_path — round-trip against fixture workspace
# ---------------------------------------------------------------------------

def _make_workspace(tmp_path: Path) -> Path:
    """Build a minimal .carta/ workspace for path resolution tests."""
    root = tmp_path / ".carta"
    root.mkdir()

    # 00-codex/
    codex = root / "00-codex"
    codex.mkdir()
    (codex / "00-index.md").write_text("", encoding="utf-8")
    (codex / "01-about.md").write_text("", encoding="utf-8")

    # 01-strategy/
    strategy = root / "01-strategy"
    strategy.mkdir()
    (strategy / "00-index.md").write_text("", encoding="utf-8")

    # 01-strategy/04-primary-sources/ (sub-directory)
    primary = strategy / "04-primary-sources"
    primary.mkdir()
    (primary / "00-index.md").write_text("", encoding="utf-8")
    (primary / "01-experiment.md").write_text("", encoding="utf-8")

    # Sidecar: 00-codex/01-about.yaml (non-md with NN- prefix, has .md host)
    (codex / "01-about.yaml").write_text("", encoding="utf-8")

    return root


def test_to_path_single_segment(tmp_path):
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc00")
    assert ref.to_path(root) == root / "00-codex"


def test_to_path_two_segments(tmp_path):
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc00.01")
    assert ref.to_path(root) == root / "00-codex" / "01-about.md"


def test_to_path_nested_directory(tmp_path):
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc01.04")
    assert ref.to_path(root) == root / "01-strategy" / "04-primary-sources"


def test_to_path_deep(tmp_path):
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc01.04.01")
    assert ref.to_path(root) == root / "01-strategy" / "04-primary-sources" / "01-experiment.md"


def test_to_path_missing_raises(tmp_path):
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc99")
    with pytest.raises(FileNotFoundError):
        ref.to_path(root)


def test_from_path_md_file(tmp_path):
    root = _make_workspace(tmp_path)
    path = root / "00-codex" / "01-about.md"
    ref = DocRef.from_path(path, root)
    assert ref == DocRef.parse("doc00.01")


def test_from_path_directory(tmp_path):
    root = _make_workspace(tmp_path)
    path = root / "00-codex"
    ref = DocRef.from_path(path, root)
    assert ref == DocRef.parse("doc00")


def test_from_path_sidecar(tmp_path):
    root = _make_workspace(tmp_path)
    path = root / "00-codex" / "01-about.yaml"
    ref = DocRef.from_path(path, root)
    # Sidecar inherits host coordinate: doc00.01
    assert ref == DocRef.parse("doc00.01")


def test_from_path_orphan_sidecar_raises(tmp_path):
    root = _make_workspace(tmp_path)
    # Create an orphan: no matching .md host
    orphan = root / "00-codex" / "99-orphan.yaml"
    orphan.write_text("", encoding="utf-8")
    with pytest.raises(ValueError, match="orphan"):
        DocRef.from_path(orphan, root)


def test_to_path_sidecar_tiebreak(tmp_path):
    """When prefix is shared by .md and sidecar, to_path prefers the .md."""
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc00.01")
    resolved = ref.to_path(root)
    assert resolved == root / "00-codex" / "01-about.md"


def test_round_trip_md(tmp_path):
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc00.01")
    path = ref.to_path(root)
    recovered = DocRef.from_path(path, root)
    assert recovered == ref


def test_round_trip_directory(tmp_path):
    root = _make_workspace(tmp_path)
    ref = DocRef.parse("doc01.04")
    path = ref.to_path(root)
    recovered = DocRef.from_path(path, root)
    assert recovered == ref


# ---------------------------------------------------------------------------
# EntryName.parse
# ---------------------------------------------------------------------------

def test_entry_name_md_file():
    e = EntryName.parse("04-product-strategy.md")
    assert e is not None
    assert e.prefix == 4
    assert e.slug == "product-strategy"
    assert e.ext == ".md"


def test_entry_name_sidecar_yaml():
    e = EntryName.parse("04-diagram.yaml")
    assert e is not None
    assert e.prefix == 4
    assert e.slug == "diagram"
    assert e.ext == ".yaml"


def test_entry_name_directory():
    e = EntryName.parse("04-section")
    assert e is not None
    assert e.prefix == 4
    assert e.slug == "section"
    assert e.ext is None


def test_entry_name_no_prefix_returns_none():
    assert EntryName.parse("product-strategy") is None


def test_entry_name_readme_returns_none():
    assert EntryName.parse("README.md") is None


def test_entry_name_index():
    e = EntryName.parse("00-index.md")
    assert e is not None
    assert e.prefix == 0
    assert e.slug == "index"
    assert e.ext == ".md"


def test_entry_name_slug_with_dashes():
    e = EntryName.parse("08-research-deep-dive.md")
    assert e is not None
    assert e.prefix == 8
    assert e.slug == "research-deep-dive"
    assert e.ext == ".md"


def test_entry_name_plain_md_no_prefix_returns_none():
    assert EntryName.parse("about.md") is None
