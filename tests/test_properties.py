"""Property-based tests for carta_cli invariants.

Uses hypothesis to generate inputs for roundtrip and idempotence properties
that the codebase relies on but only spot-checks elsewhere.
"""

import re
import sys
import tempfile
from pathlib import Path

from hypothesis import given, settings, strategies as st

_TESTS_DIR = Path(__file__).resolve().parent
_CLI_DIR = _TESTS_DIR.parent
sys.path.insert(0, str(_CLI_DIR))
sys.path.insert(0, str(_TESTS_DIR))

from conftest import _build_fixture, _run_carta
from carta_cli.numbering import get_numeric_prefix
from carta_cli.ref_convert import path_to_ref, ref_to_path

_REF_RE = re.compile(r'\bdoc\d{2}(\.\d{2})*\b')


def _collect_valid_refs(carta: Path) -> list[str]:
    """Return all doc refs that exist in the workspace filesystem."""
    seen: set[str] = set()
    for p in sorted(carta.rglob("*")):
        try:
            ref = path_to_ref(p, carta)
            seen.add(ref)
        except ValueError:
            pass
    return sorted(seen)


def _punchable_leaves(carta: Path) -> list[str]:
    """Return workspace-relative paths for non-index .md files."""
    results = []
    for p in sorted(carta.rglob("*.md")):
        if (get_numeric_prefix(p.name) or 0) == 0:
            continue
        results.append(str(p.relative_to(carta)))
    return results


def _snapshot(carta: Path) -> dict[str, str]:
    """Return {relative-path: content} for every file under carta."""
    snap: dict[str, str] = {}
    for p in sorted(carta.rglob("*")):
        if p.is_file():
            snap[str(p.relative_to(carta))] = p.read_text(encoding="utf-8")
    return snap


def _workspace_refs(carta: Path) -> list[str]:
    """Collect all doc refs mentioned in any .md file in the workspace."""
    refs: set[str] = set()
    for p in carta.rglob("*.md"):
        for m in _REF_RE.finditer(p.read_text(encoding="utf-8")):
            refs.add(m.group(0))
    return sorted(refs)


# ---------------------------------------------------------------------------
# Property 3a: ref_to_path ↔ path_to_ref roundtrip
# ---------------------------------------------------------------------------

@settings(max_examples=25, deadline=None)
@given(st.data())
def test_ref_to_path_roundtrip(data):
    with tempfile.TemporaryDirectory() as tmpdir:
        carta = _build_fixture(Path(tmpdir))
        valid_refs = _collect_valid_refs(carta)
        ref = data.draw(st.sampled_from(valid_refs))
        path = ref_to_path(ref, carta)
        assert path_to_ref(path, carta) == ref


# ---------------------------------------------------------------------------
# Property 3b: punch then flatten --keep-index is identity
# ---------------------------------------------------------------------------

@settings(max_examples=25, deadline=None)
@given(st.data())
def test_punch_flatten_identity(data):
    with tempfile.TemporaryDirectory() as tmpdir:
        carta = _build_fixture(Path(tmpdir))
        leaves = _punchable_leaves(carta)
        leaf_rel = data.draw(st.sampled_from(leaves))

        before = _snapshot(carta)

        punch_result = _run_carta(carta, "punch", leaf_rel)
        assert punch_result.returncode == 0, f"punch failed:\n{punch_result.stderr}"

        # The punched directory has the same stem as the leaf
        dir_rel = leaf_rel[:-3] if leaf_rel.endswith(".md") else leaf_rel
        flatten_result = _run_carta(carta, "flatten", dir_rel, "--keep-index")
        assert flatten_result.returncode == 0, f"flatten failed:\n{flatten_result.stderr}"

        after = _snapshot(carta)
        assert after == before, (
            f"Workspace changed after punch+flatten for {leaf_rel!r}.\n"
            f"Added: {sorted(set(after) - set(before))}\n"
            f"Removed: {sorted(set(before) - set(after))}"
        )


# ---------------------------------------------------------------------------
# Property 3c: moveto preserves ref resolvability
# ---------------------------------------------------------------------------

@settings(max_examples=25, deadline=None)
@given(st.data())
def test_moveto_preserves_refs(data):
    with tempfile.TemporaryDirectory() as tmpdir:
        carta = _build_fixture(Path(tmpdir))

        movable = _punchable_leaves(carta)
        all_dirs = sorted(
            str(p.relative_to(carta))
            for p in carta.rglob("*")
            if p.is_dir()
        )

        leaf_rel = data.draw(st.sampled_from(movable))
        src_parent = str(Path(leaf_rel).parent)

        other_dirs = [d for d in all_dirs if d != src_parent]
        dest_dir = data.draw(st.sampled_from(other_dirs if other_dirs else all_dirs))

        result = _run_carta(carta, "move", leaf_rel, dest_dir)
        assert result.returncode == 0, f"move failed:\n{result.stderr}"

        for ref in _workspace_refs(carta):
            try:
                ref_to_path(ref, carta)
            except FileNotFoundError as exc:
                raise AssertionError(
                    f"Ref {ref!r} no longer resolves after moving {leaf_rel!r} "
                    f"to {dest_dir!r}: {exc}"
                ) from exc


# ---------------------------------------------------------------------------
# Property 3d: delete closes numeric gaps
# ---------------------------------------------------------------------------

@settings(max_examples=25, deadline=None)
@given(st.data())
def test_delete_no_gaps(data):
    with tempfile.TemporaryDirectory() as tmpdir:
        carta = _build_fixture(Path(tmpdir))

        deletable = [
            p for p in sorted(carta.rglob("*.md"))
            if (get_numeric_prefix(p.name) or 0) > 0
        ]

        entry = data.draw(st.sampled_from(deletable))
        parent = entry.parent
        entry_rel = str(entry.relative_to(carta))

        result = _run_carta(carta, "delete", entry_rel)
        assert result.returncode == 0, f"delete failed:\n{result.stderr}"

        remaining_prefixes = sorted(
            get_numeric_prefix(p.name)
            for p in parent.iterdir()
            if get_numeric_prefix(p.name) is not None and get_numeric_prefix(p.name) > 0
        )
        if remaining_prefixes:
            expected = list(range(1, len(remaining_prefixes) + 1))
            assert remaining_prefixes == expected, (
                f"Gaps after deleting {entry_rel!r}: "
                f"prefixes={remaining_prefixes}, expected={expected}"
            )
