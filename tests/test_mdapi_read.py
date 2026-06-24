"""Tests for rhidoc mdapi read commands: outline, read, locate."""

import argparse
import io
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from rhidoc.commands.mdapi import (
    cmd_mdapi_outline,
    cmd_mdapi_read,
    cmd_mdapi_locate,
)
from rhidoc.errors import RhidocError
from rhidoc.mdtree import MdTree


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DOC_TEXT = """\
---
title: Test Doc
---

Preamble text.

# Alpha

Alpha body.

## Alpha-One

Alpha-One body.

## Alpha-Two

Alpha-Two body.

# Beta

Beta body.

## Beta-One

Beta-One body.

# Gamma

Gamma body.
"""


def _make_args(doc_path: str, **kwargs) -> argparse.Namespace:
    ns = argparse.Namespace(doc=doc_path, **kwargs)
    if not hasattr(ns, "range"):
        ns.range = None
    if not hasattr(ns, "at"):
        ns.at = None
    if not hasattr(ns, "depth"):
        ns.depth = None
    if not hasattr(ns, "text"):
        ns.text = None
    return ns


def _run(fn, doc_file: Path, **kwargs):
    """Run a command handler and capture stdout."""
    ns = _make_args(str(doc_file), **kwargs)
    buf = io.StringIO()
    with patch("sys.stdout", buf):
        fn(ns, doc_file.parent)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def doc_file(tmp_path) -> Path:
    """Write DOC_TEXT to a tmp .md file and return its path."""
    f = tmp_path / "01-test.md"
    f.write_text(DOC_TEXT, encoding="utf-8")
    return f


# ---------------------------------------------------------------------------
# outline — addresses
# ---------------------------------------------------------------------------

def test_outline_all_addresses(doc_file):
    out = _run(cmd_mdapi_outline, doc_file)
    lines = out.strip().splitlines()
    addresses = [l.split("  ")[0] for l in lines]
    assert addresses == ["1", "1.1", "1.2", "2", "2.1", "3"]


def test_outline_marker_texts(doc_file):
    out = _run(cmd_mdapi_outline, doc_file)
    lines = {l.split("  ")[0]: l.split("  ", 1)[1] for l in out.strip().splitlines()}
    assert lines["1"] == "Alpha"
    assert lines["1.1"] == "Alpha-One"
    assert lines["1.2"] == "Alpha-Two"
    assert lines["2"] == "Beta"
    assert lines["2.1"] == "Beta-One"
    assert lines["3"] == "Gamma"


def test_outline_no_body_text(doc_file):
    out = _run(cmd_mdapi_outline, doc_file)
    assert "Alpha body" not in out
    assert "Beta body" not in out


# ---------------------------------------------------------------------------
# read — depth truncation
# ---------------------------------------------------------------------------

def test_read_depth_1_no_children(doc_file):
    out = _run(cmd_mdapi_read, doc_file, depth=1)
    # depth=1 means selected nodes only, no children
    assert "## Alpha-One" not in out
    assert "## Alpha-Two" not in out
    assert "## Beta-One" not in out
    # top-level markers present
    assert "# Alpha" in out
    assert "# Beta" in out
    assert "# Gamma" in out


def test_read_depth_1_includes_body(doc_file):
    out = _run(cmd_mdapi_read, doc_file, depth=1)
    # body_text of top-level nodes should appear
    assert "Alpha body" in out
    assert "Beta body" in out
    assert "Gamma body" in out


def test_read_depth_2_includes_children(doc_file):
    out = _run(cmd_mdapi_read, doc_file, depth=2)
    assert "## Alpha-One" in out
    assert "## Alpha-Two" in out
    assert "## Beta-One" in out


def test_read_no_depth_full_doc(doc_file):
    out = _run(cmd_mdapi_read, doc_file)
    assert "# Alpha" in out
    assert "## Alpha-One" in out
    assert "Alpha-One body" in out


# ---------------------------------------------------------------------------
# read — range sibling-span selection
# ---------------------------------------------------------------------------

def test_read_range_root_span(doc_file):
    out = _run(cmd_mdapi_read, doc_file, **{"range": "1:2"})
    assert "# Alpha" in out
    assert "# Beta" in out
    assert "# Gamma" not in out


def test_read_range_single_root(doc_file):
    out = _run(cmd_mdapi_read, doc_file, **{"range": "2:2"})
    assert "# Beta" in out
    assert "# Alpha" not in out
    assert "# Gamma" not in out


def test_read_range_child_span(doc_file):
    out = _run(cmd_mdapi_read, doc_file, **{"range": "1.1:1.2"})
    assert "## Alpha-One" in out
    assert "## Alpha-Two" in out
    # no siblings from other roots
    assert "## Beta-One" not in out
    # root heading not in output (note: "# Alpha" would match "## Alpha-One" as substring)
    assert "# Alpha\n" not in out


def test_read_range_mismatched_parents_raises(doc_file):
    with pytest.raises(RhidocError, match="not siblings"):
        _run(cmd_mdapi_read, doc_file, **{"range": "1.1:2.1"})


def test_read_range_out_of_bounds_raises(doc_file):
    with pytest.raises(RhidocError, match="out of range"):
        _run(cmd_mdapi_read, doc_file, **{"range": "1:99"})


def test_read_range_inverted_raises(doc_file):
    with pytest.raises(RhidocError, match="after end"):
        _run(cmd_mdapi_read, doc_file, **{"range": "3:1"})


# ---------------------------------------------------------------------------
# read — range + depth composition
# ---------------------------------------------------------------------------

def test_read_range_and_depth(doc_file):
    # Select root nodes 1:2 with depth=1 — should show Alpha + Beta but not their children
    out = _run(cmd_mdapi_read, doc_file, **{"range": "1:2", "depth": 1})
    assert "# Alpha" in out
    assert "# Beta" in out
    assert "## Alpha-One" not in out
    assert "## Beta-One" not in out


# ---------------------------------------------------------------------------
# read — --at single node
# ---------------------------------------------------------------------------

def test_read_at_single_node(doc_file):
    out = _run(cmd_mdapi_read, doc_file, at="2")
    assert "# Beta" in out
    assert "## Beta-One" in out
    assert "# Alpha" not in out
    assert "# Gamma" not in out


def test_read_at_with_depth(doc_file):
    out = _run(cmd_mdapi_read, doc_file, at="1", depth=1)
    assert "# Alpha" in out
    assert "## Alpha-One" not in out


def test_read_at_child_node(doc_file):
    out = _run(cmd_mdapi_read, doc_file, at="1.1")
    assert "## Alpha-One" in out
    assert "## Alpha-Two" not in out


def test_read_at_nonexistent_returns_empty(doc_file):
    # --at with an address that doesn't exist → empty output, exit 0 (not an error)
    out = _run(cmd_mdapi_read, doc_file, at="99")
    assert out == ""


# ---------------------------------------------------------------------------
# locate — by text
# ---------------------------------------------------------------------------

def test_locate_by_marker_text(doc_file):
    ns = _make_args(str(doc_file), text="Beta")
    buf = io.StringIO()
    with patch("sys.stdout", buf):
        cmd_mdapi_locate(ns, doc_file.parent)
    assert buf.getvalue().strip() == "2"


def test_locate_by_body_text(doc_file):
    ns = _make_args(str(doc_file), text="Alpha-One body")
    buf = io.StringIO()
    with patch("sys.stdout", buf):
        cmd_mdapi_locate(ns, doc_file.parent)
    assert buf.getvalue().strip() == "1.1"


def test_locate_first_match(doc_file):
    # "body" appears in multiple nodes; should return first (Alpha at address 1)
    ns = _make_args(str(doc_file), text="Alpha body")
    buf = io.StringIO()
    with patch("sys.stdout", buf):
        cmd_mdapi_locate(ns, doc_file.parent)
    assert buf.getvalue().strip() == "1"


def test_locate_not_found_raises(doc_file):
    ns = _make_args(str(doc_file), text="NONEXISTENT_XYZ")
    with pytest.raises(RhidocError, match="No node found"):
        cmd_mdapi_locate(ns, doc_file.parent)
