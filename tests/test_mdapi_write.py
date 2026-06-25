"""Tests for rhidoc mdapi write verbs: insert, set-body, move, delete, hoist + lint."""

import argparse
import io
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from rhidoc.commands.mdapi import (
    cmd_mdapi_insert,
    cmd_mdapi_set_body,
    cmd_mdapi_move,
    cmd_mdapi_delete,
    cmd_mdapi_hoist,
    cmd_mdapi_outline,
    cmd_mdapi_lint,
)
from rhidoc.errors import RhidocError
from rhidoc.mdtree import MdTree
from rhidoc.mdlint import (
    WORD_CAP,
    LINE_CAP,
    BANNED_PATTERNS,
    lint_node,
    check_duplicate_body,
    LintViolation,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

DOC_TEXT = """\
---
title: Test Doc
---

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


def _doc(tmp_path: Path, text: str = DOC_TEXT) -> Path:
    f = tmp_path / "01-test.md"
    f.write_text(text, encoding="utf-8")
    return f


def _args(doc_path: str, **kwargs) -> argparse.Namespace:
    ns = argparse.Namespace(doc=doc_path, **kwargs)
    # provide defaults for optional flags
    for attr, default in [("at", None), ("before", False), ("no_lint", False),
                           ("from_addr", None), ("to_addr", None), ("text", None)]:
        if not hasattr(ns, attr):
            setattr(ns, attr, default)
    return ns


def _outline(doc_file: Path) -> list[str]:
    """Return list of 'ADDRESS  marker_text' lines from outline."""
    ns = _args(str(doc_file))
    buf = io.StringIO()
    with patch("sys.stdout", buf):
        cmd_mdapi_outline(ns, doc_file.parent)
    return buf.getvalue().strip().splitlines()


def _addresses(doc_file: Path) -> list[str]:
    return [line.split("  ")[0] for line in _outline(doc_file)]


def _run_insert(doc_file: Path, at: str, draft: str, before: bool = False, no_lint: bool = False):
    ns = _args(str(doc_file), at=at, before=before, no_lint=no_lint)
    with patch("sys.stdin", io.StringIO(draft)):
        cmd_mdapi_insert(ns, doc_file.parent)


def _run_set_body(doc_file: Path, at: str, body: str, no_lint: bool = False):
    ns = _args(str(doc_file), at=at, no_lint=no_lint)
    with patch("sys.stdin", io.StringIO(body)):
        cmd_mdapi_set_body(ns, doc_file.parent)


def _run_move(doc_file: Path, from_addr: str, to_addr: str):
    ns = _args(str(doc_file), from_addr=from_addr, to_addr=to_addr)
    cmd_mdapi_move(ns, doc_file.parent)


def _run_delete(doc_file: Path, at: str):
    ns = _args(str(doc_file), at=at)
    cmd_mdapi_delete(ns, doc_file.parent)


def _run_hoist(doc_file: Path, at: str):
    ns = _args(str(doc_file), at=at)
    cmd_mdapi_hoist(ns, doc_file.parent)


# ---------------------------------------------------------------------------
# insert — basic placement
# ---------------------------------------------------------------------------

def test_insert_after_renumbers(tmp_path):
    doc = _doc(tmp_path)
    _run_insert(doc, at="2", draft="# Delta\n\nDelta body.\n", no_lint=True)
    addrs = _addresses(doc)
    # original: 1=Alpha, 2=Beta, 3=Gamma
    # after insert after "2": 1=Alpha, 2=Beta, 3=Delta, 4=Gamma
    assert "3" in addrs
    assert "4" in addrs
    tree = MdTree.parse(doc.read_text())
    assert tree.roots[2].marker_text == "Delta"
    assert tree.roots[3].marker_text == "Gamma"


def test_insert_before_renumbers(tmp_path):
    doc = _doc(tmp_path)
    _run_insert(doc, at="2", draft="# Delta\n\nDelta body.\n", before=True, no_lint=True)
    tree = MdTree.parse(doc.read_text())
    # Delta inserted before Beta (address 2), Delta becomes 2, Beta becomes 3, Gamma 4
    assert tree.roots[1].marker_text == "Delta"
    assert tree.roots[2].marker_text == "Beta"
    assert tree.roots[3].marker_text == "Gamma"


def test_insert_child_renumbers(tmp_path):
    doc = _doc(tmp_path)
    _run_insert(doc, at="1.1", draft="## Alpha-Zero\n\nNew body.\n", before=True, no_lint=True)
    tree = MdTree.parse(doc.read_text())
    # Alpha-Zero inserted before Alpha-One (1.1), so Alpha-Zero=1.1, Alpha-One=1.2, Alpha-Two=1.3
    assert tree.roots[0].children[0].marker_text == "Alpha-Zero"
    assert tree.roots[0].children[1].marker_text == "Alpha-One"
    assert tree.roots[0].children[2].marker_text == "Alpha-Two"


def test_insert_out_of_range_raises(tmp_path):
    doc = _doc(tmp_path)
    with pytest.raises(RhidocError, match="out of range"):
        _run_insert(doc, at="99", draft="# X\n", no_lint=True)


def test_insert_no_nodes_from_stdin_raises(tmp_path):
    doc = _doc(tmp_path)
    with pytest.raises(RhidocError, match="no nodes"):
        _run_insert(doc, at="1", draft="just plain text with no heading\n", no_lint=True)


def test_insert_round_trip_fidelity(tmp_path):
    doc = _doc(tmp_path)
    original = doc.read_text()
    _run_insert(doc, at="1", draft="# New\n\nbody.\n", no_lint=True)
    after = doc.read_text()
    # Round-trip: re-parse and re-render should be stable
    tree = MdTree.parse(after)
    assert MdTree.parse(tree.render()) == tree
    # Original unchanged until write succeeded
    assert after != original


# ---------------------------------------------------------------------------
# set-body
# ---------------------------------------------------------------------------

def test_set_body_replaces_body(tmp_path):
    doc = _doc(tmp_path)
    _run_set_body(doc, at="1", body="New Alpha body.\n", no_lint=True)
    tree = MdTree.parse(doc.read_text())
    assert "New Alpha body." in tree.roots[0].body_text


def test_set_body_does_not_renumber(tmp_path):
    doc = _doc(tmp_path)
    _run_set_body(doc, at="2", body="Replaced.\n", no_lint=True)
    addrs = _addresses(doc)
    # Sibling count unchanged
    assert addrs == ["1", "1.1", "1.2", "2", "2.1", "3"]


def test_set_body_structure_unchanged(tmp_path):
    doc = _doc(tmp_path)
    _run_set_body(doc, at="1", body="x\n", no_lint=True)
    tree = MdTree.parse(doc.read_text())
    # Alpha still has Alpha-One and Alpha-Two as children
    assert len(tree.roots[0].children) == 2
    assert tree.roots[0].children[0].marker_text == "Alpha-One"


def test_set_body_nonexistent_raises(tmp_path):
    doc = _doc(tmp_path)
    with pytest.raises(RhidocError, match="not found"):
        _run_set_body(doc, at="99", body="x\n", no_lint=True)


def test_set_body_round_trip_fidelity(tmp_path):
    doc = _doc(tmp_path)
    _run_set_body(doc, at="2.1", body="Replaced body.\n", no_lint=True)
    tree = MdTree.parse(doc.read_text())
    assert MdTree.parse(tree.render()) == tree


# ---------------------------------------------------------------------------
# move — whole subtree
# ---------------------------------------------------------------------------

def test_move_takes_whole_subtree(tmp_path):
    doc = _doc(tmp_path)
    # Move Alpha (1) before Gamma (3): it has 2 children that must travel with it
    _run_move(doc, from_addr="1", to_addr="3")
    tree = MdTree.parse(doc.read_text())
    # After move: Beta=1, Alpha=2 (with children 2.1, 2.2), Gamma=3
    assert tree.roots[0].marker_text == "Beta"
    assert tree.roots[1].marker_text == "Alpha"
    assert len(tree.roots[1].children) == 2
    assert tree.roots[1].children[0].marker_text == "Alpha-One"
    assert tree.roots[1].children[1].marker_text == "Alpha-Two"
    assert tree.roots[2].marker_text == "Gamma"


def test_move_renumbers_source_siblings(tmp_path):
    doc = _doc(tmp_path)
    _run_move(doc, from_addr="1", to_addr="3")
    addrs = _addresses(doc)
    # After moving Alpha (1) before Gamma (3): Beta=1 (with Beta-One=1.1), Alpha=2 (with 2.1, 2.2), Gamma=3
    assert addrs[0] == "1"    # Beta
    assert addrs[1] == "1.1"  # Beta-One
    assert addrs[2] == "2"    # Alpha
    assert addrs[3] == "2.1"  # Alpha-One
    assert addrs[4] == "2.2"  # Alpha-Two
    assert addrs[5] == "3"    # Gamma


def test_move_to_different_parent(tmp_path):
    doc = _doc(tmp_path)
    # Move Beta-One (2.1) to be a child of Alpha — it should appear as 1.3
    _run_move(doc, from_addr="2.1", to_addr="1.3")
    tree = MdTree.parse(doc.read_text())
    assert len(tree.roots[0].children) == 3
    assert tree.roots[0].children[2].marker_text == "Beta-One"
    # Beta should now have no children
    assert len(tree.roots[1].children) == 0


def test_move_same_parent_reorder(tmp_path):
    doc = _doc(tmp_path)
    # Move Gamma (3) before Alpha (1)
    _run_move(doc, from_addr="3", to_addr="1")
    tree = MdTree.parse(doc.read_text())
    assert tree.roots[0].marker_text == "Gamma"
    assert tree.roots[1].marker_text == "Alpha"
    assert tree.roots[2].marker_text == "Beta"


def test_move_same_address_noop(tmp_path):
    doc = _doc(tmp_path)
    original = doc.read_text()
    _run_move(doc, from_addr="2", to_addr="2")
    assert doc.read_text() == original


def test_move_into_own_subtree_raises(tmp_path):
    doc = _doc(tmp_path)
    with pytest.raises(RhidocError, match="subtree"):
        _run_move(doc, from_addr="1", to_addr="1.1")


def test_move_round_trip_fidelity(tmp_path):
    doc = _doc(tmp_path)
    _run_move(doc, from_addr="2", to_addr="1")
    tree = MdTree.parse(doc.read_text())
    assert MdTree.parse(tree.render()) == tree


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

def test_delete_removes_node_and_subtree(tmp_path):
    doc = _doc(tmp_path)
    _run_delete(doc, at="1")
    tree = MdTree.parse(doc.read_text())
    # Alpha (with its children) gone; Beta is now 1, Gamma is 2
    assert len(tree.roots) == 2
    assert tree.roots[0].marker_text == "Beta"
    assert tree.roots[1].marker_text == "Gamma"


def test_delete_renumbers_siblings(tmp_path):
    doc = _doc(tmp_path)
    _run_delete(doc, at="2")
    addrs = _addresses(doc)
    # Was: 1, 1.1, 1.2, 2, 2.1, 3
    # After deleting 2: 1, 1.1, 1.2, 2
    assert "3" not in addrs
    assert addrs == ["1", "1.1", "1.2", "2"]
    tree = MdTree.parse(doc.read_text())
    assert tree.roots[1].marker_text == "Gamma"


def test_delete_child_renumbers(tmp_path):
    doc = _doc(tmp_path)
    _run_delete(doc, at="1.1")
    tree = MdTree.parse(doc.read_text())
    # Alpha-Two is now child 1 (address 1.1)
    assert tree.roots[0].children[0].marker_text == "Alpha-Two"
    assert tree.roots[0].children[0].address == "1.1"


def test_delete_out_of_range_raises(tmp_path):
    doc = _doc(tmp_path)
    with pytest.raises(RhidocError, match="out of range"):
        _run_delete(doc, at="99")


def test_delete_round_trip_fidelity(tmp_path):
    doc = _doc(tmp_path)
    _run_delete(doc, at="1.2")
    tree = MdTree.parse(doc.read_text())
    assert MdTree.parse(tree.render()) == tree


# ---------------------------------------------------------------------------
# hoist — child lifting and body disposition
# ---------------------------------------------------------------------------

def test_hoist_lifts_children(tmp_path):
    doc = _doc(tmp_path)
    # Hoist Alpha (1) — Alpha-One and Alpha-Two should become root nodes
    _run_hoist(doc, at="1")
    tree = MdTree.parse(doc.read_text())
    # Alpha dissolved; its children now at root level; then Beta, Gamma
    assert tree.roots[0].marker_text == "Alpha-One"
    assert tree.roots[1].marker_text == "Alpha-Two"
    assert tree.roots[2].marker_text == "Beta"
    assert tree.roots[3].marker_text == "Gamma"


def test_hoist_renumbers_siblings(tmp_path):
    doc = _doc(tmp_path)
    _run_hoist(doc, at="1")
    addrs = _addresses(doc)
    # After hoisting Alpha (1): Alpha-One=1, Alpha-Two=2, Beta=3 (with Beta-One=3.1), Gamma=4
    assert addrs[0] == "1"    # Alpha-One
    assert addrs[1] == "2"    # Alpha-Two
    assert addrs[2] == "3"    # Beta
    assert addrs[3] == "3.1"  # Beta-One (child of Beta)
    assert addrs[4] == "4"    # Gamma


def test_hoist_body_prepended_to_first_child(tmp_path):
    doc = _doc(tmp_path)
    # Alpha has body "Alpha body.\n" and children Alpha-One, Alpha-Two
    _run_hoist(doc, at="1")
    tree = MdTree.parse(doc.read_text())
    # Alpha's body should be prepended to Alpha-One's body
    assert "Alpha body." in tree.roots[0].body_text


def test_hoist_leaf_body_goes_to_parent(tmp_path):
    """Hoist a leaf node (no children): body goes to parent's body_text."""
    doc = _doc(tmp_path)
    # Hoist Alpha-One (1.1) — it has no children, body goes to Alpha (1.1's parent)
    _run_hoist(doc, at="1.1")
    tree = MdTree.parse(doc.read_text())
    # Alpha-One dissolved; Alpha now has only Alpha-Two as child (now 1.1)
    assert len(tree.roots[0].children) == 1
    assert tree.roots[0].children[0].marker_text == "Alpha-Two"
    # Alpha-One's body appended to Alpha's body
    assert "Alpha-One body." in tree.roots[0].body_text


def test_hoist_out_of_range_raises(tmp_path):
    doc = _doc(tmp_path)
    with pytest.raises(RhidocError, match="out of range"):
        _run_hoist(doc, at="99")


def test_hoist_round_trip_fidelity(tmp_path):
    doc = _doc(tmp_path)
    _run_hoist(doc, at="2")
    tree = MdTree.parse(doc.read_text())
    assert MdTree.parse(tree.render()) == tree


# ---------------------------------------------------------------------------
# Lint — unit tests for lint_node
# ---------------------------------------------------------------------------

def _make_node(body: str, addr: str = "1") -> object:
    from rhidoc.mdtree import MdNode
    n = MdNode(marker_kind="h2", marker_text="Test", body_text=body)
    n.address = addr
    return n


def test_lint_word_cap():
    body = " ".join(["word"] * (WORD_CAP + 1))
    node = _make_node(body)
    violations = lint_node(node)
    kinds = [v.kind for v in violations]
    assert "word-cap" in kinds


def test_lint_line_cap():
    body = "\n".join(["line"] * (LINE_CAP + 1))
    node = _make_node(body)
    violations = lint_node(node)
    kinds = [v.kind for v in violations]
    assert "line-cap" in kinds


def test_lint_no_violation_clean():
    node = _make_node("Short clean text.")
    assert lint_node(node) == []


@pytest.mark.parametrize("pattern_name,text", [
    ("future-modal", "This will be implemented next."),
    ("future-modal", "It shall be done."),
    ("phase-language", "This is phase 2 of the project."),
    ("phase-language", "Introduced in version 2."),
    ("deferral-language", "TODO: finish this."),
    ("deferral-language", "TBD: decide later."),
    ("deferral-language", "This is to be determined."),
    ("deferral-language", "Deferred to next quarter."),
    ("dated-postscript", "As of January 2024, this is correct."),
    ("dated-postscript", "Last updated June 2023."),
    ("retrospective-framing", "We decided to use PostgreSQL."),
    ("retrospective-framing", "We chose the simpler approach."),
    ("volatile-snapshot", "Currently, this is the default."),
    ("volatile-snapshot", "At the time of writing this was true."),
    ("volatile-snapshot", "At present the system supports X."),
])
def test_lint_banned_pattern(pattern_name, text):
    node = _make_node(text)
    violations = lint_node(node)
    kinds = [v.kind for v in violations]
    assert "banned-pattern" in kinds
    details = [v.detail for v in violations]
    assert any(pattern_name in d for d in details), \
        f"Expected '{pattern_name}' in violation details, got: {details}"


# ---------------------------------------------------------------------------
# Lint — duplicate body detection
# ---------------------------------------------------------------------------

def test_lint_duplicate_body_detected():
    from rhidoc.mdtree import MdNode
    n1 = MdNode(marker_kind="h2", marker_text="A", body_text="same body.\n")
    n1.address = "1"
    n2 = MdNode(marker_kind="h2", marker_text="B", body_text="same body.\n")
    n2.address = "2"
    violations = check_duplicate_body(n2, [n1, n2])
    assert len(violations) == 1
    assert violations[0].kind == "duplicate-body"


def test_lint_duplicate_body_empty_body_ignored():
    from rhidoc.mdtree import MdNode
    n1 = MdNode(marker_kind="h2", marker_text="A", body_text="")
    n1.address = "1"
    n2 = MdNode(marker_kind="h2", marker_text="B", body_text="")
    n2.address = "2"
    assert check_duplicate_body(n2, [n1, n2]) == []


def test_lint_duplicate_body_self_not_flagged():
    from rhidoc.mdtree import MdNode
    n = MdNode(marker_kind="h2", marker_text="A", body_text="unique body.\n")
    n.address = "1"
    assert check_duplicate_body(n, [n]) == []


# ---------------------------------------------------------------------------
# Lint integration — insert rejection leaves doc unchanged
# ---------------------------------------------------------------------------

def test_insert_lint_future_modal_rejects(tmp_path):
    doc = _doc(tmp_path)
    original = doc.read_text()
    draft = "# New Section\n\nThis will be a great feature.\n"
    with pytest.raises(RhidocError, match="lint violations"):
        with patch("sys.stderr", io.StringIO()):
            _run_insert(doc, at="1", draft=draft)
    # File must be UNCHANGED
    assert doc.read_text() == original


def test_insert_lint_word_cap_rejects(tmp_path):
    doc = _doc(tmp_path)
    original = doc.read_text()
    long_body = " ".join(["word"] * (WORD_CAP + 1))
    draft = f"# Big Section\n\n{long_body}\n"
    with pytest.raises(RhidocError, match="lint violations"):
        with patch("sys.stderr", io.StringIO()):
            _run_insert(doc, at="1", draft=draft)
    assert doc.read_text() == original


def test_insert_lint_duplicate_rejects(tmp_path):
    doc = _doc(tmp_path)
    original = doc.read_text()
    # "Alpha body." is already in the doc
    draft = "# Duplicate Section\n\nAlpha body.\n"
    with pytest.raises(RhidocError, match="lint violations"):
        with patch("sys.stderr", io.StringIO()):
            _run_insert(doc, at="1", draft=draft)
    assert doc.read_text() == original


def test_insert_no_lint_bypasses(tmp_path):
    doc = _doc(tmp_path)
    draft = "# New Section\n\nThis will be a great feature.\n"
    _run_insert(doc, at="1", draft=draft, no_lint=True)
    # File was written despite lint violation
    tree = MdTree.parse(doc.read_text())
    assert any(n.marker_text == "New Section" for n in tree.walk())


# ---------------------------------------------------------------------------
# Lint integration — set-body rejection leaves doc unchanged
# ---------------------------------------------------------------------------

def test_set_body_lint_banned_pattern_rejects(tmp_path):
    doc = _doc(tmp_path)
    original = doc.read_text()
    with pytest.raises(RhidocError, match="lint violations"):
        with patch("sys.stderr", io.StringIO()):
            _run_set_body(doc, at="1", body="This will be done eventually.\n")
    assert doc.read_text() == original


def test_set_body_lint_duplicate_rejects(tmp_path):
    doc = _doc(tmp_path)
    original = doc.read_text()
    # "Beta body." is body of node 2; setting node 1 to the same body should be rejected
    with pytest.raises(RhidocError, match="lint violations"):
        with patch("sys.stderr", io.StringIO()):
            _run_set_body(doc, at="1", body="Beta body.\n")
    assert doc.read_text() == original


def test_set_body_no_lint_bypasses(tmp_path):
    doc = _doc(tmp_path)
    _run_set_body(doc, at="1", body="This will be done.\n", no_lint=True)
    tree = MdTree.parse(doc.read_text())
    assert "This will be done." in tree.roots[0].body_text


# ---------------------------------------------------------------------------
# mdapi lint — standalone pre-flight verb
# ---------------------------------------------------------------------------

def _run_lint_cmd(doc_file: Path, draft: str):
    ns = _args(str(doc_file))
    with patch("sys.stdin", io.StringIO(draft)):
        cmd_mdapi_lint(ns, doc_file.parent)


def test_lint_clean_draft_no_exception(tmp_path):
    doc = _doc(tmp_path)
    before = doc.read_text()
    _run_lint_cmd(doc, "# Clean\n\nA clean declarative body.\n")
    assert doc.read_text() == before


def test_lint_banned_pattern_raises_doc_unchanged(tmp_path):
    doc = _doc(tmp_path)
    before = doc.read_text()
    with pytest.raises(RhidocError, match="violations found"):
        with patch("sys.stderr", io.StringIO()):
            _run_lint_cmd(doc, "# Probe\n\nThis will fail lint.\n")
    assert doc.read_text() == before


def test_lint_word_cap_raises_doc_unchanged(tmp_path):
    doc = _doc(tmp_path)
    before = doc.read_text()
    long_body = " ".join(["word"] * (WORD_CAP + 1))
    with pytest.raises(RhidocError, match="violations found"):
        with patch("sys.stderr", io.StringIO()):
            _run_lint_cmd(doc, f"# Big\n\n{long_body}\n")
    assert doc.read_text() == before


def test_lint_line_cap_raises_doc_unchanged(tmp_path):
    doc = _doc(tmp_path)
    before = doc.read_text()
    tall_body = "\n".join(["line"] * (LINE_CAP + 1))
    with pytest.raises(RhidocError, match="violations found"):
        with patch("sys.stderr", io.StringIO()):
            _run_lint_cmd(doc, f"# Tall\n\n{tall_body}\n")
    assert doc.read_text() == before


def test_lint_duplicate_body_raises_doc_unchanged(tmp_path):
    doc = _doc(tmp_path)
    before = doc.read_text()
    # "Alpha body." is already in DOC_TEXT
    with pytest.raises(RhidocError, match="violations found"):
        with patch("sys.stderr", io.StringIO()):
            _run_lint_cmd(doc, "# Dup\n\nAlpha body.\n")
    assert doc.read_text() == before


def test_lint_empty_stdin_raises(tmp_path):
    doc = _doc(tmp_path)
    with pytest.raises(RhidocError, match="no nodes"):
        _run_lint_cmd(doc, "just plain text with no heading\n")


# ---------------------------------------------------------------------------
# LintViolation.format
# ---------------------------------------------------------------------------

def test_violation_format():
    v = LintViolation(kind="word-cap", address="1.2", detail="too long")
    assert v.format() == "lint [word-cap] @1.2: too long"
