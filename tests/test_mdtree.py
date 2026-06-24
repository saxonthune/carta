"""Tests for rhidoc/mdtree.py — addressing, resolve, body_text, code fences, frontmatter."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from rhidoc.mdtree import MdNode, MdTree


# ---------------------------------------------------------------------------
# Basic addressing
# ---------------------------------------------------------------------------

def test_heading_addresses():
    t = MdTree.parse("# A\n\n## B\n\n## C\n\n### D\n")
    addrs = [n.address for n in t.walk()]
    assert addrs == ["1", "1.1", "1.2", "1.2.1"]


def test_mixed_heading_list_addresses():
    t = MdTree.parse("# A\n\nlede\n\n## B\n\n- x\n  - y\n")
    addrs = [n.address for n in t.walk()]
    assert addrs == ["1", "1.1", "1.1.1", "1.1.1.1"]


def test_multiple_roots():
    t = MdTree.parse("# A\n\n# B\n\n# C\n")
    assert [n.address for n in t.roots] == ["1", "2", "3"]


def test_list_only_addresses():
    t = MdTree.parse("- alpha\n- beta\n  - nested\n")
    addrs = [n.address for n in t.walk()]
    assert addrs == ["1", "2", "2.1"]


# ---------------------------------------------------------------------------
# Resolve
# ---------------------------------------------------------------------------

def test_resolve_heading():
    t = MdTree.parse("# A\n\n## B\n")
    node = t.resolve("1.1")
    assert node is not None
    assert node.marker_kind == "h2"
    assert node.marker_text == "B"


def test_resolve_list_item():
    t = MdTree.parse("# A\n\n## B\n\n- x\n  - y\n")
    assert t.resolve("1.1") is not None
    node = t.resolve("1.1.1")
    assert node is not None
    assert node.marker_kind == "ul"
    assert node.marker_text == "x"
    nested = t.resolve("1.1.1.1")
    assert nested is not None
    assert nested.marker_text == "y"


def test_resolve_missing():
    t = MdTree.parse("# A\n")
    assert t.resolve("2") is None
    assert t.resolve("1.1") is None
    assert t.resolve("") is None
    assert t.resolve("abc") is None


def test_resolve_out_of_bounds():
    t = MdTree.parse("# A\n\n# B\n")
    assert t.resolve("3") is None


# ---------------------------------------------------------------------------
# body_text (prose on enclosing node)
# ---------------------------------------------------------------------------

def test_heading_body_text():
    t = MdTree.parse("# A\n\nlede paragraph\n\n## B\n")
    h1 = t.resolve("1")
    assert h1 is not None
    assert "lede paragraph" in h1.body_text


def test_empty_body_text():
    t = MdTree.parse("# A\n\n## B\n")
    h1 = t.resolve("1")
    assert h1 is not None
    assert h1.body_text == ""


def test_body_text_not_in_children():
    t = MdTree.parse("# A\n\nsome prose\n\n## B\n\nother prose\n")
    h1 = t.resolve("1")
    h2 = t.resolve("1.1")
    assert h1 is not None and h2 is not None
    assert "some prose" in h1.body_text
    assert "other prose" in h2.body_text
    # h1 body_text should NOT contain h2's prose
    assert "other prose" not in h1.body_text


# ---------------------------------------------------------------------------
# Code fences are opaque
# ---------------------------------------------------------------------------

def test_code_fence_not_a_node():
    src = "# A\n\n```python\n# comment\ndef foo():\n    pass\n```\n\n## B\n"
    t = MdTree.parse(src)
    # Only h1 and h2 are nodes; the fence content is opaque
    kinds = [n.marker_kind for n in t.walk()]
    assert kinds == ["h1", "h2"]


def test_list_marker_inside_fence_not_a_node():
    src = "# A\n\n```\n- not a list item\n```\n\n- real item\n"
    t = MdTree.parse(src)
    # h1 and one ul item
    kinds = [n.marker_kind for n in t.walk()]
    assert "h1" in kinds
    # Should have a real list item
    list_nodes = [n for n in t.walk() if n.marker_kind in ("ul", "ol")]
    assert len(list_nodes) == 1
    assert list_nodes[0].marker_text == "real item"


# ---------------------------------------------------------------------------
# Empty / edge cases
# ---------------------------------------------------------------------------

def test_empty_document():
    t = MdTree.parse("")
    assert t.roots == []
    assert t.frontmatter == ""


def test_only_whitespace():
    t = MdTree.parse("   \n\n  \n")
    assert t.roots == []


def test_single_heading():
    t = MdTree.parse("# Hello\n")
    assert len(t.roots) == 1
    assert t.roots[0].marker_text == "Hello"
    assert t.roots[0].address == "1"


# ---------------------------------------------------------------------------
# Frontmatter passthrough
# ---------------------------------------------------------------------------

def test_frontmatter_preserved():
    src = "---\ntitle: Test Doc\ntags: [a, b]\n---\n\n# Heading\n"
    t = MdTree.parse(src)
    assert "title: Test Doc" in t.frontmatter
    assert t.frontmatter.startswith("---")


def test_frontmatter_in_render():
    src = "---\ntitle: Test Doc\n---\n\n# Heading\n"
    t = MdTree.parse(src)
    rendered = t.render()
    assert rendered.startswith("---")
    assert "title: Test Doc" in rendered
    assert "# Heading" in rendered


def test_no_frontmatter():
    src = "# Heading\n"
    t = MdTree.parse(src)
    assert t.frontmatter == ""
    rendered = t.render()
    assert rendered.startswith("# Heading")


# ---------------------------------------------------------------------------
# Render / round-trip
# ---------------------------------------------------------------------------

def test_render_heading_structure():
    t = MdTree.parse("# A\n\n## B\n\n### C\n")
    rendered = t.render()
    assert "# A" in rendered
    assert "## B" in rendered
    assert "### C" in rendered


def test_render_list_structure():
    t = MdTree.parse("- alpha\n- beta\n  - nested\n")
    rendered = t.render()
    assert "alpha" in rendered
    assert "beta" in rendered
    assert "nested" in rendered


def test_render_idempotent_content():
    """parse(render(parse(t))) == parse(t) for a concrete example."""
    src = "# A\n\nlede\n\n## B\n\n- x\n  - y\n"
    t1 = MdTree.parse(src)
    t2 = MdTree.parse(t1.render())
    assert t1 == t2


def test_render_with_frontmatter_idempotent():
    src = "---\ntitle: Doc\n---\n\n# Heading\n\n## Sub\n"
    t1 = MdTree.parse(src)
    t2 = MdTree.parse(t1.render())
    assert t1 == t2


# ---------------------------------------------------------------------------
# Marker kind correctness
# ---------------------------------------------------------------------------

def test_ol_kind():
    t = MdTree.parse("1. first\n2. second\n")
    kinds = [n.marker_kind for n in t.walk()]
    assert all(k == "ol" for k in kinds)


def test_ul_kind():
    t = MdTree.parse("- first\n- second\n")
    kinds = [n.marker_kind for n in t.walk()]
    assert all(k == "ul" for k in kinds)


def test_heading_kinds():
    src = "# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6\n"
    t = MdTree.parse(src)
    kinds = [n.marker_kind for n in t.walk()]
    assert kinds == ["h1", "h2", "h3", "h4", "h5", "h6"]


# ---------------------------------------------------------------------------
# Depth field
# ---------------------------------------------------------------------------

def test_heading_depth():
    t = MdTree.parse("# A\n\n## B\n\n### C\n")
    nodes = list(t.walk())
    assert nodes[0].depth == 1
    assert nodes[1].depth == 2
    assert nodes[2].depth == 3


def test_list_item_depth():
    t = MdTree.parse("- top\n  - child\n    - grandchild\n")
    nodes = list(t.walk())
    assert nodes[0].depth == 1
    assert nodes[1].depth == 2
    assert nodes[2].depth == 3


# ---------------------------------------------------------------------------
# Hypothesis: structural idempotence
# ---------------------------------------------------------------------------

def _marker(kind: str, text: str, depth: int) -> str:
    if kind.startswith("h"):
        return "#" * int(kind[1]) + " " + text + "\n"
    elif kind == "ul":
        return "  " * (depth - 1) + "- " + text + "\n"
    else:
        return "  " * (depth - 1) + "1. " + text + "\n"


# Simple strategy: generate a small valid markdown doc with headings/lists
_words = st.text(alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")), min_size=1, max_size=10)
_heading_levels = st.sampled_from(["h1", "h2", "h3"])
_list_kinds = st.sampled_from(["ul", "ol"])


@st.composite
def conformant_markdown(draw):
    """Generate markdown with only headings and list items — no preamble prose."""
    lines: list[str] = []
    # 0-3 headings with optional nested items
    for _ in range(draw(st.integers(0, 3))):
        level = draw(st.integers(1, 3))
        text = draw(_words)
        lines.append("#" * level + " " + text + "\n")
        # 0-2 list items under this heading
        for _ in range(draw(st.integers(0, 2))):
            item_text = draw(_words)
            kind_char = draw(st.sampled_from(["-", "1."]))
            lines.append(kind_char + " " + item_text + "\n")
    return "".join(lines)


@given(conformant_markdown())
@settings(max_examples=200)
def test_hypothesis_structural_idempotence(src: str):
    """parse(render(parse(t))) == parse(t) over generated conformant markdown."""
    t1 = MdTree.parse(src)
    t2 = MdTree.parse(t1.render())
    assert t1 == t2
