"""Property-based tests for rhidoc invariants.

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

from conftest import _build_fixture, _run_rhidoc
from rhidoc.docref import DocRef, EntryName


def get_numeric_prefix(name: str) -> int | None:
    en = EntryName.parse(name)
    return en.prefix if en is not None else None


def ref_to_path(ref: str, root):
    return DocRef.parse(ref).to_path(root)


def path_to_ref(path, root):
    return str(DocRef.from_path(path, root))

_REF_RE = re.compile(r'\bdoc\d{2}(\.\d{2})*\b')


def _collect_valid_refs(rhidoc: Path) -> list[str]:
    """Return all doc refs that exist in the workspace filesystem."""
    seen: set[str] = set()
    for p in sorted(rhidoc.rglob("*")):
        try:
            ref = path_to_ref(p, rhidoc)
            seen.add(ref)
        except ValueError:
            pass
    return sorted(seen)


def _punchable_leaves(rhidoc: Path) -> list[str]:
    """Return workspace-relative paths for non-index .md files."""
    results = []
    for p in sorted(rhidoc.rglob("*.md")):
        if (get_numeric_prefix(p.name) or 0) == 0:
            continue
        results.append(str(p.relative_to(rhidoc)))
    return results


def _snapshot(rhidoc: Path) -> dict[str, str]:
    """Return {relative-path: content} for every file under rhidoc."""
    snap: dict[str, str] = {}
    for p in sorted(rhidoc.rglob("*")):
        if p.is_file():
            snap[str(p.relative_to(rhidoc))] = p.read_text(encoding="utf-8")
    return snap


def _workspace_refs(rhidoc: Path) -> list[str]:
    """Collect all doc refs mentioned in any .md file in the workspace."""
    refs: set[str] = set()
    for p in rhidoc.rglob("*.md"):
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
        rhidoc = _build_fixture(Path(tmpdir))
        valid_refs = _collect_valid_refs(rhidoc)
        ref = data.draw(st.sampled_from(valid_refs))
        path = ref_to_path(ref, rhidoc)
        assert path_to_ref(path, rhidoc) == ref


# ---------------------------------------------------------------------------
# Property 3b: punch then hoist --keep-index is identity
# ---------------------------------------------------------------------------

@settings(max_examples=25, deadline=None)
@given(st.data())
def test_punch_hoist_identity(data):
    with tempfile.TemporaryDirectory() as tmpdir:
        rhidoc = _build_fixture(Path(tmpdir))
        leaves = _punchable_leaves(rhidoc)
        leaf_rel = data.draw(st.sampled_from(leaves))

        before = _snapshot(rhidoc)

        punch_result = _run_rhidoc(rhidoc, "punch", leaf_rel)
        assert punch_result.returncode == 0, f"punch failed:\n{punch_result.stderr}"

        # The punched directory has the same stem as the leaf
        dir_rel = leaf_rel[:-3] if leaf_rel.endswith(".md") else leaf_rel
        hoist_result = _run_rhidoc(rhidoc, "hoist", dir_rel, "--keep-index")
        assert hoist_result.returncode == 0, f"hoist failed:\n{hoist_result.stderr}"

        after = _snapshot(rhidoc)
        assert after == before, (
            f"Workspace changed after punch+hoist for {leaf_rel!r}.\n"
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
        rhidoc = _build_fixture(Path(tmpdir))

        movable = _punchable_leaves(rhidoc)
        all_dirs = sorted(
            str(p.relative_to(rhidoc))
            for p in rhidoc.rglob("*")
            if p.is_dir()
        )

        leaf_rel = data.draw(st.sampled_from(movable))
        src_parent = str(Path(leaf_rel).parent)

        other_dirs = [d for d in all_dirs if d != src_parent]
        dest_dir = data.draw(st.sampled_from(other_dirs if other_dirs else all_dirs))

        result = _run_rhidoc(rhidoc, "move", leaf_rel, dest_dir)
        assert result.returncode == 0, f"move failed:\n{result.stderr}"

        for ref in _workspace_refs(rhidoc):
            try:
                ref_to_path(ref, rhidoc)
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
        rhidoc = _build_fixture(Path(tmpdir))

        deletable = [
            p for p in sorted(rhidoc.rglob("*.md"))
            if (get_numeric_prefix(p.name) or 0) > 0
        ]

        entry = data.draw(st.sampled_from(deletable))
        parent = entry.parent
        entry_rel = str(entry.relative_to(rhidoc))

        result = _run_rhidoc(rhidoc, "delete", entry_rel)
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
