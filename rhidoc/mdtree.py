"""mdtree.py — Parse a markdown document into an addressable heading+list tree."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterator

from markdown_it import MarkdownIt


@dataclass
class MdNode:
    marker_kind: str          # h1..h6 | ol | ul
    marker_text: str          # heading inline text or list-item first-line text
    body_text: str            # prose between this marker and first child
    children: list[MdNode] = field(default_factory=list)
    address: str = ""
    depth: int = 0


@dataclass
class MdTree:
    frontmatter: str                    # raw frontmatter incl. delimiters, or ""
    roots: list[MdNode] = field(default_factory=list)
    preamble: str = ""                  # body text before the first node (if any)

    # ------------------------------------------------------------------
    # Parse
    # ------------------------------------------------------------------

    @classmethod
    def parse(cls, text: str) -> "MdTree":
        fm_raw, body = _split_frontmatter(text)
        body_lines = body.splitlines(keepends=True)

        md = MarkdownIt()
        tokens = md.parse(body)

        parser = _Parser(tokens, body_lines)
        roots, preamble = parser.parse()

        _assign_addresses(roots, "")

        return cls(frontmatter=fm_raw, roots=roots, preamble=preamble)

    # ------------------------------------------------------------------
    # Resolve
    # ------------------------------------------------------------------

    def resolve(self, address: str) -> MdNode | None:
        parts = address.split(".")
        nodes = self.roots
        node: MdNode | None = None
        for part in parts:
            try:
                idx = int(part) - 1
            except ValueError:
                return None
            if idx < 0 or idx >= len(nodes):
                return None
            node = nodes[idx]
            nodes = node.children
        return node

    # ------------------------------------------------------------------
    # Walk (pre-order)
    # ------------------------------------------------------------------

    def walk(self) -> Iterator[MdNode]:
        def _walk(nodes: list[MdNode]) -> Iterator[MdNode]:
            for n in nodes:
                yield n
                yield from _walk(n.children)

        yield from _walk(self.roots)

    # ------------------------------------------------------------------
    # Render
    # ------------------------------------------------------------------

    def render(self) -> str:
        parts: list[str] = []
        if self.frontmatter:
            parts.append(self.frontmatter)
            if not self.frontmatter.endswith("\n"):
                parts.append("\n")
        if self.preamble:
            parts.append(self.preamble)
        for node in self.roots:
            parts.append(_render_node(node, indent=""))
        return "".join(parts)

    # ------------------------------------------------------------------
    # Equality (structural, for hypothesis round-trip test)
    # ------------------------------------------------------------------

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, MdTree):
            return NotImplemented
        return (
            self.frontmatter == other.frontmatter
            and self.preamble == other.preamble
            and _nodes_equal(self.roots, other.roots)
        )


# ---------------------------------------------------------------------------
# Frontmatter splitting (works on raw text, not Path)
# ---------------------------------------------------------------------------

def _split_frontmatter(text: str) -> tuple[str, str]:
    """Return (raw_frontmatter, body).  raw_frontmatter is "" if absent."""
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return "", text
    after_open = text[4:]
    m = re.search(r'\n---[ \t]*(\n|$)', after_open)
    if m is None:
        return "", text
    fm_raw = "---\n" + after_open[: m.start()] + "\n---"
    body = after_open[m.end():]
    return fm_raw, body


# ---------------------------------------------------------------------------
# Recursive-descent parser over markdown-it token stream
# ---------------------------------------------------------------------------

class _Parser:
    def __init__(self, tokens: list, body_lines: list[str]) -> None:
        self.tokens = tokens
        self.body_lines = body_lines
        self.i = 0

    # -- top-level ---------------------------------------------------------

    def parse(self) -> tuple[list[MdNode], str]:
        """Return (roots, preamble)."""
        roots: list[MdNode] = []
        preamble_parts: list[str] = []
        # heading_stack: list of (level, MdNode) for heading nesting
        heading_stack: list[tuple[int, MdNode]] = []

        while self.i < len(self.tokens):
            tok = self.tokens[self.i]

            if tok.type == "heading_open":
                level = int(tok.tag[1])
                node = self._parse_heading(level)
                # pop headings at same or deeper level
                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()
                if heading_stack:
                    heading_stack[-1][1].children.append(node)
                else:
                    roots.append(node)
                heading_stack.append((level, node))

            elif tok.type in ("bullet_list_open", "ordered_list_open"):
                kind = "ul" if tok.type == "bullet_list_open" else "ol"
                list_nodes = self._parse_list(kind)
                if heading_stack:
                    heading_stack[-1][1].children.extend(list_nodes)
                else:
                    roots.extend(list_nodes)

            elif tok.type == "paragraph_open":
                raw = self._parse_paragraph_raw()
                if heading_stack:
                    heading_stack[-1][1].body_text += raw
                else:
                    preamble_parts.append(raw)

            elif tok.type in ("fence", "code_block", "hr"):
                # Opaque block: belongs to current heading body_text
                raw = self._block_raw()
                if heading_stack:
                    heading_stack[-1][1].body_text += raw
                else:
                    preamble_parts.append(raw)

            else:
                self.i += 1

        return roots, "".join(preamble_parts)

    # -- heading -----------------------------------------------------------

    def _parse_heading(self, level: int) -> MdNode:
        """Consume heading_open, inline, heading_close; return MdNode."""
        self.i += 1  # skip heading_open
        text = ""
        if self.i < len(self.tokens) and self.tokens[self.i].type == "inline":
            text = self.tokens[self.i].content
            self.i += 1
        if self.i < len(self.tokens) and self.tokens[self.i].type == "heading_close":
            self.i += 1
        return MdNode(marker_kind=f"h{level}", marker_text=text, body_text="", depth=level)

    # -- lists -------------------------------------------------------------

    def _parse_list(self, kind: str, depth: int = 1) -> list[MdNode]:
        """Consume bullet/ordered list open…close; return list of MdNode."""
        self.i += 1  # skip list_open
        close_type = "bullet_list_close" if kind == "ul" else "ordered_list_close"
        nodes: list[MdNode] = []

        while self.i < len(self.tokens) and self.tokens[self.i].type != close_type:
            tok = self.tokens[self.i]
            if tok.type == "list_item_open":
                nodes.append(self._parse_list_item(kind, depth))
            else:
                self.i += 1

        if self.i < len(self.tokens):
            self.i += 1  # skip list_close

        return nodes

    def _parse_list_item(self, kind: str, depth: int) -> MdNode:
        """Consume list_item_open…close; return MdNode."""
        self.i += 1  # skip list_item_open

        marker_text = ""
        body_parts: list[str] = []
        children: list[MdNode] = []
        got_marker = False

        while self.i < len(self.tokens) and self.tokens[self.i].type != "list_item_close":
            tok = self.tokens[self.i]

            if tok.type == "paragraph_open":
                if not got_marker:
                    # First paragraph: extract marker_text from inline content.
                    marker_text = self._parse_paragraph_inline().split("\n")[0].strip()
                    got_marker = True
                else:
                    # Subsequent paragraphs: capture raw source lines to preserve indentation.
                    body_parts.append(self._parse_paragraph_raw())

            elif tok.type == "inline":
                # tight list: inline directly in list_item (no paragraph wrapper)
                if not got_marker:
                    marker_text = tok.content.split("\n")[0].strip()
                    got_marker = True
                self.i += 1

            elif tok.type in ("fence", "code_block", "hr"):
                body_parts.append(self._block_raw())

            elif tok.type == "blockquote_open":
                body_parts.append(self._raw_container("blockquote_open", "blockquote_close"))

            elif tok.type in ("bullet_list_open", "ordered_list_open"):
                nested_kind = "ul" if tok.type == "bullet_list_open" else "ol"
                children.extend(self._parse_list(nested_kind, depth + 1))

            else:
                self.i += 1

        if self.i < len(self.tokens):
            self.i += 1  # skip list_item_close

        return MdNode(
            marker_kind=kind,
            marker_text=marker_text,
            body_text="".join(body_parts),
            children=children,
            depth=depth,
        )

    # -- helpers -----------------------------------------------------------

    def _parse_paragraph_raw(self) -> str:
        """Consume paragraph_open, inline, paragraph_close; return raw source lines."""
        tok = self.tokens[self.i]
        start = tok.map[0] if tok.map else 0
        self.i += 1  # skip paragraph_open

        inline_map_end = tok.map[1] if tok.map else start + 1
        if self.i < len(self.tokens) and self.tokens[self.i].type == "inline":
            if self.tokens[self.i].map:
                inline_map_end = self.tokens[self.i].map[1]
            self.i += 1

        if self.i < len(self.tokens) and self.tokens[self.i].type == "paragraph_close":
            if self.tokens[self.i].map:
                inline_map_end = self.tokens[self.i].map[1]
            self.i += 1

        lines = self.body_lines[start:inline_map_end]
        raw = "".join(lines)
        if raw and not raw.endswith("\n"):
            raw += "\n"
        return raw + "\n"  # blank line separator

    def _parse_paragraph_inline(self) -> str:
        """Consume paragraph_open, inline, paragraph_close; return inline content string."""
        self.i += 1  # skip paragraph_open
        content = ""
        if self.i < len(self.tokens) and self.tokens[self.i].type == "inline":
            content = self.tokens[self.i].content
            self.i += 1
        if self.i < len(self.tokens) and self.tokens[self.i].type == "paragraph_close":
            self.i += 1
        return content

    def _block_raw(self) -> str:
        """Consume a fence/code_block/hr token; return raw source lines."""
        tok = self.tokens[self.i]
        self.i += 1
        if tok.map:
            lines = self.body_lines[tok.map[0]: tok.map[1]]
            raw = "".join(lines)
            if raw and not raw.endswith("\n"):
                raw += "\n"
            return raw + "\n"
        return ""

    def _raw_container(self, open_type: str, close_type: str) -> str:
        """Consume an open…close block pair; return raw source lines covering the full range."""
        open_tok = self.tokens[self.i]
        map_start = open_tok.map[0] if open_tok.map else 0
        map_end = open_tok.map[1] if open_tok.map else map_start + 1
        self.i += 1  # skip open
        depth = 1
        while self.i < len(self.tokens) and depth > 0:
            t = self.tokens[self.i]
            if t.type == open_type:
                depth += 1
            elif t.type == close_type:
                depth -= 1
            if t.map and len(t.map) >= 2 and t.map[1] > map_end:
                map_end = t.map[1]
            self.i += 1
        lines = self.body_lines[map_start:map_end]
        raw = "".join(lines)
        if raw and not raw.endswith("\n"):
            raw += "\n"
        return raw + "\n"


# ---------------------------------------------------------------------------
# Address assignment
# ---------------------------------------------------------------------------

def _assign_addresses(nodes: list[MdNode], prefix: str) -> None:
    for i, node in enumerate(nodes, 1):
        node.address = f"{prefix}.{i}" if prefix else str(i)
        _assign_addresses(node.children, node.address)


def assign_addresses(nodes: list[MdNode], prefix: str = "") -> None:
    """Public entry point: (re-)assign positional addresses after in-memory mutations."""
    _assign_addresses(nodes, prefix)


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def _render_node(node: MdNode, indent: str) -> str:
    parts: list[str] = []

    if node.marker_kind.startswith("h"):
        level = int(node.marker_kind[1])
        parts.append(indent + "#" * level + " " + node.marker_text + "\n")
    elif node.marker_kind == "ul":
        parts.append(indent + "- " + node.marker_text + "\n")
    else:
        parts.append(indent + "1. " + node.marker_text + "\n")

    if node.body_text:
        body = node.body_text
        if not body.endswith("\n"):
            body += "\n"
        if not node.marker_kind.startswith("h"):
            # Blank line required so markdown-it re-parses body as block content, not lazy continuation.
            parts.append("\n")
        parts.append(body)

    for child in node.children:
        if node.marker_kind.startswith("h"):
            parts.append(_render_node(child, indent))
        else:
            # list children indented by 2
            parts.append(_render_node(child, indent + "  "))

    return "".join(parts)


# ---------------------------------------------------------------------------
# Structural equality
# ---------------------------------------------------------------------------

def _nodes_equal(a: list[MdNode], b: list[MdNode]) -> bool:
    if len(a) != len(b):
        return False
    for na, nb in zip(a, b):
        if (
            na.marker_kind != nb.marker_kind
            or na.marker_text != nb.marker_text
            or na.body_text != nb.body_text
            or not _nodes_equal(na.children, nb.children)
        ):
            return False
    return True
