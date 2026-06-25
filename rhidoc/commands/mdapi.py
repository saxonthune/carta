"""rhidoc — mdapi commands: outline, read, locate (Phase 2) + write verbs (Phase 3)."""
import argparse
import sys
from pathlib import Path

from ..errors import RhidocError
from ..entries import resolve_arg
from ..mdtree import MdTree, MdNode, assign_addresses
from ..mdlint import lint_node, check_duplicate_body


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _marker_line(node: MdNode, indent: str = "") -> str:
    if node.marker_kind.startswith("h"):
        level = int(node.marker_kind[1])
        return indent + "#" * level + " " + node.marker_text + "\n"
    if node.marker_kind == "ul":
        return indent + "- " + node.marker_text + "\n"
    return indent + "1. " + node.marker_text + "\n"


def _render_depth(node: MdNode, remaining: int | None, indent: str = "") -> str:
    """Render node with depth limit. remaining=None means unlimited."""
    parts: list[str] = [_marker_line(node, indent)]

    if node.body_text:
        body = node.body_text
        if not body.endswith("\n"):
            body += "\n"
        parts.append(body)

    if remaining is None or remaining > 1:
        child_indent = indent + "  " if not node.marker_kind.startswith("h") else indent
        next_remaining = None if remaining is None else remaining - 1
        for child in node.children:
            parts.append(_render_depth(child, next_remaining, child_indent))

    return "".join(parts)


def _parse_address(addr: str) -> tuple[str, int]:
    """Return (parent_prefix, 1-based index). '2.3' -> ('2', 3); '2' -> ('', 2)."""
    parts = addr.rsplit(".", 1)
    try:
        if len(parts) == 1:
            return "", int(parts[0])
        return parts[0], int(parts[1])
    except ValueError:
        raise RhidocError(f"Invalid address: {addr!r}")


def _select_range(tree: MdTree, start: str, end: str) -> list[MdNode]:
    start_prefix, start_idx = _parse_address(start)
    end_prefix, end_idx = _parse_address(end)

    if start_prefix != end_prefix:
        raise RhidocError(
            f"Range endpoints {start!r} and {end!r} are not siblings "
            f"(parent prefixes {start_prefix!r} vs {end_prefix!r})"
        )

    if start_prefix == "":
        siblings = tree.roots
    else:
        parent = tree.resolve(start_prefix)
        if parent is None:
            raise RhidocError(f"Cannot resolve parent address {start_prefix!r}")
        siblings = parent.children

    if start_idx < 1 or end_idx < 1 or start_idx > len(siblings) or end_idx > len(siblings):
        raise RhidocError(
            f"Address out of range: {start!r}..{end!r} (sibling count: {len(siblings)})"
        )
    if start_idx > end_idx:
        raise RhidocError(f"Range start {start!r} is after end {end!r}")

    return siblings[start_idx - 1 : end_idx]


def _resolve_doc(args: argparse.Namespace, rhidoc_root: Path) -> tuple[Path, MdTree]:
    doc_arg = args.doc
    workspace_name = rhidoc_root.name
    if doc_arg.startswith(f"{workspace_name}/"):
        doc_arg = doc_arg[len(workspace_name) + 1:]
    entry = resolve_arg(doc_arg, rhidoc_root)
    path = entry.path
    if path.is_dir():
        path = path / "00-index.md"
    if not path.exists():
        raise RhidocError(f"Error: {path} does not exist")
    text = path.read_text(encoding="utf-8")
    return path, MdTree.parse(text)


def _get_siblings(tree: MdTree, parent_prefix: str) -> list[MdNode]:
    """Return the sibling list for a given parent prefix ('' for roots)."""
    if parent_prefix == "":
        return tree.roots
    parent = tree.resolve(parent_prefix)
    if parent is None:
        raise RhidocError(f"Cannot resolve parent address {parent_prefix!r}")
    return parent.children


def _is_ancestor(ancestor_addr: str, descendant_addr: str) -> bool:
    """True if ancestor_addr is a proper prefix of descendant_addr."""
    return descendant_addr == ancestor_addr or descendant_addr.startswith(ancestor_addr + ".")


def _run_lint(new_nodes: list[MdNode], tree: MdTree) -> list:
    """Run caps + banned-pattern + duplicate checks on new_nodes; return violations."""
    all_nodes = list(tree.walk())
    violations = []
    for node in new_nodes:
        violations.extend(lint_node(node))
        violations.extend(check_duplicate_body(node, all_nodes))
    return violations


def _print_violations(violations: list) -> None:
    for v in violations:
        sys.stderr.write(v.format() + "\n")


# ---------------------------------------------------------------------------
# outline
# ---------------------------------------------------------------------------

def cmd_mdapi_outline(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Print every node as ADDRESS  marker_text."""
    _, tree = _resolve_doc(args, rhidoc_root)
    for node in tree.walk():
        sys.stdout.write(f"{node.address}  {node.marker_text}\n")


# ---------------------------------------------------------------------------
# read
# ---------------------------------------------------------------------------

def cmd_mdapi_read(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Print selected nodes with optional depth truncation."""
    _, tree = _resolve_doc(args, rhidoc_root)

    depth: int | None = getattr(args, "depth", None)
    range_arg: str | None = getattr(args, "range", None)
    at_arg: str | None = getattr(args, "at", None)

    if at_arg is not None:
        node = tree.resolve(at_arg.strip())
        if node is None:
            return
        nodes = [node]
    elif range_arg is not None:
        if ":" not in range_arg:
            raise RhidocError(f"--range requires A:B format, got {range_arg!r}")
        start, end = range_arg.split(":", 1)
        nodes = _select_range(tree, start.strip(), end.strip())
    else:
        nodes = tree.roots

    parts: list[str] = []
    if tree.preamble and at_arg is None and range_arg is None:
        parts.append(tree.preamble)

    for node in nodes:
        parts.append(_render_depth(node, depth))

    output = "".join(parts)
    sys.stdout.write(output)


# ---------------------------------------------------------------------------
# locate
# ---------------------------------------------------------------------------

def cmd_mdapi_locate(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Find first node whose marker_text or body_text contains the search text."""
    _, tree = _resolve_doc(args, rhidoc_root)
    needle = args.text

    for node in tree.walk():
        if needle in node.marker_text or needle in node.body_text:
            sys.stdout.write(f"{node.address}\n")
            return

    raise RhidocError(f"No node found containing text: {needle!r}")


# ---------------------------------------------------------------------------
# insert
# ---------------------------------------------------------------------------

def cmd_mdapi_insert(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Insert new node(s) from stdin before or after --at ADDR."""
    path, tree = _resolve_doc(args, rhidoc_root)
    draft = sys.stdin.read()

    new_nodes = MdTree.parse(draft).roots
    if not new_nodes:
        raise RhidocError("insert: stdin produced no nodes (marker line required)")

    addr = args.at.strip()
    parent_prefix, idx = _parse_address(addr)
    siblings = _get_siblings(tree, parent_prefix)

    if idx < 1 or idx > len(siblings):
        raise RhidocError(
            f"Address out of range: {addr!r} (sibling count: {len(siblings)})"
        )

    before = getattr(args, "before", False)
    insert_pos = idx - 1 if before else idx  # 0-based

    for i, node in enumerate(new_nodes):
        siblings.insert(insert_pos + i, node)

    assign_addresses(tree.roots)

    no_lint = getattr(args, "no_lint", False)
    if not no_lint:
        violations = _run_lint(new_nodes, tree)
        if violations:
            _print_violations(violations)
            raise RhidocError("insert aborted: lint violations (use --no-lint to bypass)")

    path.write_text(tree.render(), encoding="utf-8")


# ---------------------------------------------------------------------------
# set-body
# ---------------------------------------------------------------------------

def cmd_mdapi_set_body(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Overwrite one node's body_text from stdin; structure and siblings unchanged."""
    path, tree = _resolve_doc(args, rhidoc_root)
    new_body = sys.stdin.read()

    addr = args.at.strip()
    node = tree.resolve(addr)
    if node is None:
        raise RhidocError(f"Address not found: {addr!r}")

    node.body_text = new_body

    no_lint = getattr(args, "no_lint", False)
    if not no_lint:
        all_nodes = list(tree.walk())
        violations = lint_node(node) + check_duplicate_body(node, all_nodes)
        if violations:
            _print_violations(violations)
            raise RhidocError("set-body aborted: lint violations (use --no-lint to bypass)")

    path.write_text(tree.render(), encoding="utf-8")


# ---------------------------------------------------------------------------
# move
# ---------------------------------------------------------------------------

def cmd_mdapi_move(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Relocate a whole subtree (node + all descendants) from --from to --to."""
    path, tree = _resolve_doc(args, rhidoc_root)

    from_addr = args.from_addr.strip()
    to_addr = args.to_addr.strip()

    if from_addr == to_addr:
        return  # no-op

    if _is_ancestor(from_addr, to_addr) and from_addr != to_addr:
        raise RhidocError(
            f"Cannot move {from_addr!r} into its own subtree ({to_addr!r})"
        )

    from_prefix, from_idx = _parse_address(from_addr)
    to_prefix, to_idx = _parse_address(to_addr)

    from_siblings = _get_siblings(tree, from_prefix)
    if from_idx < 1 or from_idx > len(from_siblings):
        raise RhidocError(
            f"Source address out of range: {from_addr!r} (sibling count: {len(from_siblings)})"
        )

    # Resolve to_siblings before extraction (its length may change if same list)
    to_siblings = _get_siblings(tree, to_prefix)
    to_max = len(to_siblings) + 1  # allow appending after last
    if to_idx < 1 or to_idx > to_max:
        raise RhidocError(
            f"Destination address out of range: {to_addr!r} (sibling count: {len(to_siblings)})"
        )

    # Extract the subtree
    node = from_siblings.pop(from_idx - 1)

    # Compute 0-based insertion point
    insert_0 = to_idx - 1
    if from_siblings is to_siblings and (from_idx - 1) < insert_0:
        # List shrank by 1 before the insertion point
        insert_0 -= 1

    to_siblings.insert(insert_0, node)
    assign_addresses(tree.roots)

    path.write_text(tree.render(), encoding="utf-8")


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

def cmd_mdapi_delete(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Remove node + entire subtree at --at ADDR; siblings renumber."""
    path, tree = _resolve_doc(args, rhidoc_root)

    addr = args.at.strip()
    parent_prefix, idx = _parse_address(addr)
    siblings = _get_siblings(tree, parent_prefix)

    if idx < 1 or idx > len(siblings):
        raise RhidocError(
            f"Address out of range: {addr!r} (sibling count: {len(siblings)})"
        )

    siblings.pop(idx - 1)
    assign_addresses(tree.roots)

    path.write_text(tree.render(), encoding="utf-8")


# ---------------------------------------------------------------------------
# hoist
# ---------------------------------------------------------------------------

def cmd_mdapi_hoist(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Dissolve node at --at ADDR, lifting its children one level into its slot.

    Body disposition: the dissolved node's body_text is prepended to the first
    hoisted child's body_text.  If there are no children, the body is appended to
    the parent's body_text (or tree.preamble for root-level nodes).
    """
    path, tree = _resolve_doc(args, rhidoc_root)

    addr = args.at.strip()
    parent_prefix, idx = _parse_address(addr)
    siblings = _get_siblings(tree, parent_prefix)

    if idx < 1 or idx > len(siblings):
        raise RhidocError(
            f"Address out of range: {addr!r} (sibling count: {len(siblings)})"
        )

    node = siblings[idx - 1]
    children = node.children
    body = node.body_text

    # Body disposition
    if body:
        if children:
            # Prepend dissolved body to the first hoisted child
            sep = "\n" if body and not body.endswith("\n") else ""
            children[0].body_text = body + sep + children[0].body_text
        else:
            # No children: append to parent context
            if parent_prefix == "":
                sep = "\n" if tree.preamble and not tree.preamble.endswith("\n") else ""
                tree.preamble = tree.preamble + sep + body
            else:
                parent = tree.resolve(parent_prefix)
                if parent is not None:
                    sep = "\n" if parent.body_text and not parent.body_text.endswith("\n") else ""
                    parent.body_text = parent.body_text + sep + body

    # Replace the dissolved node with its children in the sibling list
    siblings[idx - 1 : idx] = children

    assign_addresses(tree.roots)

    path.write_text(tree.render(), encoding="utf-8")


# ---------------------------------------------------------------------------
# frontmatter / set-frontmatter
# ---------------------------------------------------------------------------

def cmd_mdapi_frontmatter(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Print the doc's frontmatter inner YAML (between the --- fences, fences excluded)."""
    _, tree = _resolve_doc(args, rhidoc_root)
    fm = tree.frontmatter
    if not fm:
        return
    inner = fm
    if inner.startswith("---\n"):
        inner = inner[4:]
    if inner.endswith("\n---"):
        inner = inner[:-4]
    sys.stdout.write(inner + "\n")


def cmd_mdapi_set_frontmatter(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Replace the doc's frontmatter block with inner YAML read from stdin; body unchanged."""
    path, tree = _resolve_doc(args, rhidoc_root)
    inner = sys.stdin.read().strip("\n")
    tree.frontmatter = "---\n" + inner + "\n---"
    path.write_text(tree.render(), encoding="utf-8")


# ---------------------------------------------------------------------------
# lint
# ---------------------------------------------------------------------------

def cmd_mdapi_lint(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Lint a candidate draft from stdin against DOC's tree; write nothing.

    Same checks insert runs pre-write (caps, banned patterns, duplicate body vs the
    existing doc). Exits non-zero on any violation; the doc is never touched.
    """
    _, tree = _resolve_doc(args, rhidoc_root)
    draft = sys.stdin.read()

    new_nodes = MdTree.parse(draft).roots
    if not new_nodes:
        raise RhidocError("lint: stdin produced no nodes (marker line required)")

    violations = _run_lint(new_nodes, tree)
    if violations:
        _print_violations(violations)
        raise RhidocError("lint: violations found")


# ---------------------------------------------------------------------------
# Dispatcher (called from _parser.py)
# ---------------------------------------------------------------------------

def cmd_mdapi(args: argparse.Namespace, rhidoc_root: Path) -> None:
    verb = getattr(args, "mdapi_verb", None)
    if verb == "outline":
        cmd_mdapi_outline(args, rhidoc_root)
    elif verb == "read":
        cmd_mdapi_read(args, rhidoc_root)
    elif verb == "locate":
        cmd_mdapi_locate(args, rhidoc_root)
    elif verb == "insert":
        cmd_mdapi_insert(args, rhidoc_root)
    elif verb == "set-body":
        cmd_mdapi_set_body(args, rhidoc_root)
    elif verb == "move":
        cmd_mdapi_move(args, rhidoc_root)
    elif verb == "delete":
        cmd_mdapi_delete(args, rhidoc_root)
    elif verb == "hoist":
        cmd_mdapi_hoist(args, rhidoc_root)
    elif verb == "lint":
        cmd_mdapi_lint(args, rhidoc_root)
    elif verb == "frontmatter":
        cmd_mdapi_frontmatter(args, rhidoc_root)
    elif verb == "set-frontmatter":
        cmd_mdapi_set_frontmatter(args, rhidoc_root)
    else:
        raise RhidocError(
            "Usage: rhidoc mdapi <outline|read|locate|insert|set-body|move|delete|hoist|lint|frontmatter|set-frontmatter> DOC [options]"
        )
