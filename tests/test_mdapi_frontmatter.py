"""Tests for rhidoc mdapi frontmatter and set-frontmatter verbs."""

import argparse
import io
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from rhidoc.commands.mdapi import cmd_mdapi_frontmatter, cmd_mdapi_set_frontmatter
from rhidoc.mdtree import MdTree


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

DOC_WITH_FM = """\
---
title: Test Doc
summary: a short summary
tags: [foo, bar]
---

# Alpha

Alpha body.

## Alpha-One

Alpha-One body.
"""

DOC_NO_FM = """\
# Alpha

Alpha body.

## Alpha-One

Alpha-One body.
"""


def _doc(tmp_path: Path, text: str = DOC_WITH_FM) -> Path:
    f = tmp_path / "01-test.md"
    f.write_text(text, encoding="utf-8")
    return f


def _args(doc_path: str) -> argparse.Namespace:
    return argparse.Namespace(doc=doc_path)


def _run_get(doc_file: Path) -> str:
    ns = _args(str(doc_file))
    buf = io.StringIO()
    with patch("sys.stdout", buf):
        cmd_mdapi_frontmatter(ns, doc_file.parent)
    return buf.getvalue()


def _run_set(doc_file: Path, inner: str) -> None:
    ns = _args(str(doc_file))
    with patch("sys.stdin", io.StringIO(inner)):
        cmd_mdapi_set_frontmatter(ns, doc_file.parent)


# ---------------------------------------------------------------------------
# frontmatter (get)
# ---------------------------------------------------------------------------

def test_get_prints_inner_yaml(tmp_path):
    doc = _doc(tmp_path)
    output = _run_get(doc)
    assert "title: Test Doc" in output
    assert "summary: a short summary" in output
    assert "tags: [foo, bar]" in output


def test_get_excludes_fences(tmp_path):
    doc = _doc(tmp_path)
    output = _run_get(doc)
    assert "---" not in output


def test_get_no_frontmatter_prints_nothing(tmp_path):
    doc = _doc(tmp_path, DOC_NO_FM)
    output = _run_get(doc)
    assert output == ""


# ---------------------------------------------------------------------------
# set-frontmatter
# ---------------------------------------------------------------------------

def test_set_replaces_block(tmp_path):
    doc = _doc(tmp_path)
    new_inner = "title: New Title\nsummary: new summary\ntags: [x]"
    _run_set(doc, new_inner)
    output = _run_get(doc)
    assert "title: New Title" in output
    assert "summary: new summary" in output
    assert "tags: [x]" in output
    assert "title: Test Doc" not in output


def test_set_body_after_fence_unchanged(tmp_path):
    doc = _doc(tmp_path)
    new_inner = "title: Changed\nsummary: s\ntags: []"
    _run_set(doc, new_inner)
    text = doc.read_text(encoding="utf-8")
    assert "# Alpha" in text
    assert "Alpha body." in text
    assert "## Alpha-One" in text
    assert "Alpha-One body." in text


def test_set_on_no_frontmatter_adds_block(tmp_path):
    doc = _doc(tmp_path, DOC_NO_FM)
    new_inner = "title: Added\nsummary: added frontmatter\ntags: []"
    _run_set(doc, new_inner)
    output = _run_get(doc)
    assert "title: Added" in output
    text = doc.read_text(encoding="utf-8")
    assert "# Alpha" in text
    assert "Alpha body." in text


# ---------------------------------------------------------------------------
# round-trip
# ---------------------------------------------------------------------------

def test_round_trip_is_noop(tmp_path):
    doc = _doc(tmp_path)
    original_tree = MdTree.parse(doc.read_text(encoding="utf-8"))
    inner = _run_get(doc)
    _run_set(doc, inner)
    result_tree = MdTree.parse(doc.read_text(encoding="utf-8"))
    assert result_tree == original_tree


