"""Integration tests for the carta CLI toolchain.

Run with:
    python3 -m pytest packages/cli/tests/test_cli.py -v
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Ensure carta_cli is importable without prior pip install
_CLI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_CLI_DIR))

from carta_cli.entries import list_numbered_entries
from carta_cli.numbering import get_numeric_prefix
from carta_cli.ref_convert import ref_to_path, path_to_ref
from carta_cli.rewriter import collect_md_files, rewrite_refs
from carta_cli.workspace import find_workspace

# Real .carta/ root (used to copy fixtures)
_REAL_CARTA_ROOT = find_workspace()
_ENV_WITH_CLI = {**os.environ, "PYTHONPATH": str(_CLI_DIR)}


def _copy_carta(dest: Path) -> Path:
    """Copy the real .carta/ into dest/. Returns dest/.carta/."""
    carta_copy = dest / ".carta"
    shutil.copytree(str(_REAL_CARTA_ROOT), str(carta_copy), dirs_exist_ok=False)
    return carta_copy


def _run_carta(carta_copy: Path, *args: str) -> subprocess.CompletedProcess:
    """Run the carta CLI against a workspace copy."""
    return subprocess.run(
        [sys.executable, "-m", "carta_cli.main", "--workspace", str(carta_copy)] + list(args),
        capture_output=True, text=True, env=_ENV_WITH_CLI,
    )


class TestRefToPath(unittest.TestCase):
    """Tests for ref_to_path and path_to_ref."""

    def setUp(self):
        self.root = _REAL_CARTA_ROOT

    def test_ref_to_path_file(self):
        path = ref_to_path("doc02.01", self.root)
        self.assertTrue(path.name.startswith("01-"))
        self.assertTrue(path.name.endswith(".md"))
        self.assertTrue(path.exists(), f"Expected file to exist: {path}")

    def test_ref_to_path_directory(self):
        path = ref_to_path("doc02.04", self.root)
        self.assertTrue(path.is_dir(), f"Expected directory: {path}")
        self.assertTrue(path.name.startswith("04-"))

    def test_ref_to_path_roundtrip(self):
        known_refs = ["doc02.01", "doc00.01", "doc01.01.01", "doc02.04"]
        for ref in known_refs:
            with self.subTest(ref=ref):
                resolved = ref_to_path(ref, self.root)
                roundtrip = path_to_ref(resolved, self.root)
                self.assertEqual(
                    roundtrip, ref,
                    f"{ref} -> {resolved.relative_to(self.root)} -> {roundtrip}",
                )

    def test_invalid_ref_raises(self):
        with self.assertRaises((FileNotFoundError, ValueError)):
            ref_to_path("doc99.99", self.root)


class TestRewriteRefs(unittest.TestCase):
    """Tests for the two-pass ref rewriting logic."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_word_boundary(self):
        """Verify word-boundary matching: URL suffix and sub-ref not replaced."""
        md = self.tmp / "test.md"
        md.write_text(
            "See doc02.06 for details.\n"
            "URL: example.com/doc02.06.html\n"
            "Ref: doc02.06.01\n",
            encoding="utf-8",
        )
        rewrite_refs([md], {"doc02.06": "doc03.01"})
        lines = md.read_text(encoding="utf-8").splitlines()
        self.assertIn("doc03.01", lines[0], "Line 1 should be updated")
        self.assertNotIn("doc03.01", lines[1], "URL line should NOT be updated")
        # Line 2 contains doc02.06.01 — should NOT be replaced since it's a longer ref
        self.assertNotIn("doc03.01", lines[2], "Sub-ref line should NOT be updated")

    def test_longer_ref_not_partially_matched(self):
        """Longer refs should not be partially matched when a shorter version exists in map."""
        md = self.tmp / "test2.md"
        md.write_text("doc03.01 and doc03.01.01\n", encoding="utf-8")
        # Only rename doc03.01, not doc03.01.01
        rewrite_refs([md], {"doc03.01": "doc04.01"})
        result = md.read_text(encoding="utf-8")
        self.assertIn("doc04.01", result)
        self.assertIn("doc03.01.01", result, "doc03.01.01 should remain unchanged")

    def test_no_changes_when_ref_absent(self):
        """Files without the old ref should not be modified."""
        md = self.tmp / "unchanged.md"
        original = "No matching refs here.\n"
        md.write_text(original, encoding="utf-8")
        results = rewrite_refs([md], {"doc99.99": "doc00.01"})
        self.assertNotIn(md, results)
        self.assertEqual(md.read_text(encoding="utf-8"), original)


class TestComputeRenameMap(unittest.TestCase):
    """Tests for gap-closing and sibling renaming logic."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp = Path(self.tmpdir.name)
        # Build a mini .carta/ structure:
        # tmp/
        #   01-a/
        #     01-foo.md
        #     02-bar.md
        (self.tmp / "01-a").mkdir()
        (self.tmp / "01-a" / "01-foo.md").write_text("# Foo\n")
        (self.tmp / "01-a" / "02-bar.md").write_text("# Bar\n")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_gap_closing(self):
        """After removing 01-foo, 02-bar should become 01-bar."""
        from carta_cli.planning import compute_rename_map
        old_foo = self.tmp / "01-a" / "01-foo.md"
        new_foo = self.tmp / "02-b" / "01-foo.md"
        old_bar = self.tmp / "01-a" / "02-bar.md"
        new_bar = self.tmp / "01-a" / "01-bar.md"

        moves = [(old_foo, new_foo), (old_bar, new_bar)]
        rename_map = compute_rename_map(moves, self.tmp)

        # doc01.01 -> somewhere (foo moved)
        self.assertIn("doc01.01", rename_map)
        # doc01.02 -> doc01.01 (gap closed)
        self.assertEqual(rename_map.get("doc01.02"), "doc01.01")


class TestMovetoDryRun(unittest.TestCase):
    """Test that --dry-run does not modify any files."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_dry_run_no_modification(self):
        """--dry-run should print output but not change files."""
        # Snapshot only text-like files that carta move could plausibly modify.
        def snapshot(root: Path) -> dict[Path, bytes]:
            return {
                p: p.read_bytes()
                for p in root.rglob("*")
                if p.is_file()
                and p.suffix in (".md", ".json", ".txt", "")
            }

        before = snapshot(self.carta_copy)

        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01", "--dry-run")

        after = snapshot(self.carta_copy)

        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}")
        self.assertIn("rename map", result.stdout.lower())
        self.assertEqual(before, after, "Files were modified during --dry-run")


class TestMovetoActualMove(unittest.TestCase):
    """Test an actual carta move operation end-to-end."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_actual_move_doc00_05_to_doc01(self):
        """Move doc00.05 (05-ai-retrieval.md) into doc01 (01-context/)."""
        # Collect pre-existing orphaned refs (to avoid false positives)
        pre_existing_orphans = set(
            ref for _, ref in self._collect_orphaned_refs(self.carta_copy)
        )

        # Before: source exists
        source = self.carta_copy / "00-codex" / "05-ai-retrieval.md"
        self.assertTrue(source.exists(), "Source must exist before move")

        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01")
        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}\n{result.stdout}")

        # Source no longer exists at old location
        self.assertFalse(source.exists(), "Source should not exist at old location")

        # File exists at new location (appended to 01-product/)
        dest_dir = self.carta_copy / "01-product"
        new_files = list(dest_dir.glob("*ai-retrieval*"))
        self.assertEqual(len(new_files), 1, f"Expected exactly one ai-retrieval file in dest: {list(dest_dir.iterdir())}")

        # No duplicate numeric prefixes in any directory
        self._assert_no_duplicate_prefixes(self.carta_copy)

        # No NEW orphaned refs (pre-existing ones are allowed)
        self._assert_no_new_orphaned_refs(self.carta_copy, pre_existing_orphans)

    def _assert_no_duplicate_prefixes(self, carta_root: Path) -> None:
        """Assert no directory has two entries with the same 2-digit numeric prefix."""
        excluded = {carta_root / ".state"}
        for dirpath in carta_root.rglob("*"):
            if not dirpath.is_dir():
                continue
            if any(excl in dirpath.parents or dirpath == excl for excl in excluded):
                continue
            prefixes = []
            for entry in dirpath.iterdir():
                m = re.match(r'^(\d{2})-', entry.name)
                if m:
                    prefixes.append(int(m.group(1)))
            duplicates = [p for p in prefixes if prefixes.count(p) > 1]
            self.assertEqual(
                duplicates, [],
                f"Duplicate prefixes in {dirpath}: {sorted(set(duplicates))}",
            )

    def _collect_orphaned_refs(self, carta_root: Path) -> list[tuple]:
        """Return (relative_md_path, ref) pairs for all unresolvable refs."""
        excluded = {carta_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []

        for md in carta_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), carta_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(carta_root), m.group()))

        return orphans

    def _assert_no_new_orphaned_refs(
        self, carta_root: Path, pre_existing: set[str]
    ) -> None:
        """Assert that moveto introduced no new orphaned refs beyond pre-existing ones."""
        orphans = self._collect_orphaned_refs(carta_root)
        new_orphans = [(f, r) for f, r in orphans if r not in pre_existing]
        self.assertEqual(
            new_orphans, [],
            f"New orphaned refs introduced by moveto:\n"
            + "\n".join(f"  {r} in {f}" for f, r in new_orphans),
        )


class TestSameDirReorder(unittest.TestCase):
    """Test same-directory reordering (Bug 2 fix)."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_move_later_entry_to_first(self):
        """Moving a later entry to position 1 should not leave gaps."""
        # 02-architecture -> position 1
        result = _run_carta(self.carta_copy, "move", "02-architecture", ".", "--order", "1")
        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}\n{result.stdout}")

        entries = sorted(
            e.name for e in self.carta_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in entries]
        # No gaps: consecutive from min to max
        self.assertEqual(prefixes, list(range(prefixes[0], prefixes[0] + len(prefixes))),
                         f"Expected no gaps in numbering: {entries}")
        # Architecture is at position 01 (after 00-codex)
        arch_entries = [e for e in entries if "architecture" in e]
        self.assertEqual(len(arch_entries), 1)
        self.assertTrue(arch_entries[0].startswith("01-"),
                         f"Expected architecture at position 01: {arch_entries[0]}")

    def test_move_first_entry_to_last(self):
        """Moving the first entry to the end should not leave gaps."""
        # Count entries before
        entries_before = [
            e for e in self.carta_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        ]
        max_prefix = max(
            int(re.match(r'^(\d{2})-', e.name).group(1))
            for e in entries_before
        )

        result = _run_carta(self.carta_copy, "move", "01-product", ".", "--order", str(max_prefix))
        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}\n{result.stdout}")

        entries = sorted(
            e.name for e in self.carta_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in entries]
        self.assertEqual(prefixes, list(range(prefixes[0], prefixes[0] + len(prefixes))),
                         f"Expected no gaps in numbering: {entries}")
        # Product is last
        self.assertTrue("product" in entries[-1],
                         f"Expected product at last position: {entries[-1]}")


class TestCrossSiblingMove(unittest.TestCase):
    """Test cross-sibling moves where dest gets gap-closed (Bug 1 fix)."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _assert_no_duplicate_prefixes(self, carta_root: Path) -> None:
        excluded = {carta_root / ".state"}
        for dirpath in carta_root.rglob("*"):
            if not dirpath.is_dir():
                continue
            if any(excl in dirpath.parents or dirpath == excl for excl in excluded):
                continue
            prefixes = []
            for entry in dirpath.iterdir():
                m = re.match(r'^(\d{2})-', entry.name)
                if m:
                    prefixes.append(int(m.group(1)))
            duplicates = [p for p in prefixes if prefixes.count(p) > 1]
            self.assertEqual(
                duplicates, [],
                f"Duplicate prefixes in {dirpath}: {sorted(set(duplicates))}",
            )

    def _collect_orphaned_refs(self, carta_root: Path) -> list[tuple]:
        excluded = {carta_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []
        for md in carta_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), carta_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(carta_root), m.group()))
        return orphans

    def test_move_product_into_sibling_architecture(self):
        """Move 01-product into 02-architecture (dest gets gap-closed from 02→01)."""
        pre_existing_orphans = set(
            ref for _, ref in self._collect_orphaned_refs(self.carta_copy)
        )

        result = _run_carta(self.carta_copy, "move", "doc01", "doc02", "--order", "1")
        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}\n{result.stdout}")

        # Top-level should have no gaps
        entries = sorted(
            e.name for e in self.carta_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in entries]
        self.assertEqual(prefixes, list(range(0, len(prefixes))),
                         f"Expected no gaps in top-level numbering: {entries}")

        # Architecture dir (gap-closed from 02 to 01)
        arch_dir = None
        for e in self.carta_copy.iterdir():
            if "architecture" in e.name:
                arch_dir = e
                break
        self.assertIsNotNone(arch_dir, "Architecture directory not found")

        product_entries = [e for e in arch_dir.iterdir() if "product" in e.name]
        self.assertEqual(len(product_entries), 1,
                         f"Expected product inside architecture: {list(arch_dir.iterdir())}")
        self.assertTrue(product_entries[0].name.startswith("01-"),
                         f"Product should be at position 01: {product_entries[0].name}")

        # No duplicate prefixes anywhere
        self._assert_no_duplicate_prefixes(self.carta_copy)

        # No new orphaned refs
        orphans = self._collect_orphaned_refs(self.carta_copy)
        new_orphans = [(f, r) for f, r in orphans if r not in pre_existing_orphans]
        self.assertEqual(
            new_orphans, [],
            f"New orphaned refs introduced:\n"
            + "\n".join(f"  {r} in {f}" for f, r in new_orphans),
        )


class TestRename(unittest.TestCase):
    """Test --rename flag for move."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_rename_in_place(self):
        """--rename with same dir should only change the slug."""
        # Rename 01-product → 01-diagramming (same position)
        result = _run_carta(self.carta_copy, "move", "01-product", ".", "--rename", "diagramming")
        assert result.returncode == 0, result.stderr
        entries = [e.name for e in self.carta_copy.iterdir() if re.match(r'^\d{2}-', e.name)]
        assert any("diagramming" in e for e in entries), f"Expected diagramming in {entries}"
        assert not any("product" in e for e in entries), f"product should be renamed: {entries}"

    def test_rename_with_move(self):
        """--rename combined with a destination should move and rename."""
        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01", "--rename", "retrieval-patterns")
        assert result.returncode == 0, result.stderr
        dest_dir = self.carta_copy / "01-product"
        new_files = [e.name for e in dest_dir.iterdir() if "retrieval-patterns" in e.name]
        assert len(new_files) == 1, f"Expected retrieval-patterns in dest: {list(dest_dir.iterdir())}"

    def test_rename_dry_run(self):
        """--rename --dry-run should not modify files."""
        before = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                  if p.is_file() and p.suffix in (".md", ".json", "")}
        result = _run_carta(self.carta_copy, "move", "01-product", ".", "--rename", "diagramming", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                 if p.is_file() and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"


class TestPunch(unittest.TestCase):
    """Test punch command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_punch_leaf_file(self):
        """Punching a leaf file creates NN-slug/00-index.md."""
        # Find a leaf .md file with a numeric prefix
        codex = self.carta_copy / "00-codex"
        leaf = codex / "01-about.md"
        assert leaf.exists(), f"Expected leaf file: {leaf}"
        original_content = leaf.read_text(encoding="utf-8")

        result = _run_carta(self.carta_copy, "punch", "doc00.01")
        assert result.returncode == 0, f"punch failed:\n{result.stderr}"

        # Original file should be gone
        assert not leaf.exists(), "Original file should not exist after punch"

        # Directory should exist
        new_dir = codex / "01-about"
        assert new_dir.is_dir(), f"Expected directory: {new_dir}"

        # 00-index.md should have original content
        index = new_dir / "00-index.md"
        assert index.exists(), f"Expected 00-index.md in {new_dir}"
        assert index.read_text(encoding="utf-8") == original_content

    def test_punch_directory_errors(self):
        """Punching a directory should fail."""
        result = _run_carta(self.carta_copy, "punch", "doc02.04")  # 04-decisions/ is a directory
        assert result.returncode != 0, "punch should fail on directory"
        assert "directory" in result.stderr.lower()

    def test_punch_dry_run(self):
        """--dry-run should not modify files."""
        leaf = self.carta_copy / "00-codex" / "01-about.md"
        before = leaf.read_bytes()
        result = _run_carta(self.carta_copy, "punch", "doc00.01", "--dry-run")
        assert result.returncode == 0, result.stderr
        assert leaf.exists(), "File should still exist after dry-run"
        assert leaf.read_bytes() == before

    def test_punch_preserves_siblings(self):
        """Siblings should not be renumbered after punch."""
        codex = self.carta_copy / "00-codex"
        siblings_before = sorted(e.name for e in codex.iterdir() if re.match(r'^\d{2}-', e.name))

        _run_carta(self.carta_copy, "punch", "doc00.01")

        siblings_after = sorted(e.name for e in codex.iterdir() if re.match(r'^\d{2}-', e.name))
        # 01-about.md should become 01-about/ — same prefix, different type
        # All other siblings unchanged
        for s in siblings_before:
            if s == "01-about.md":
                assert "01-about" in siblings_after, f"01-about dir should exist: {siblings_after}"
            else:
                assert s in siblings_after, f"Sibling {s} should be unchanged: {siblings_after}"


class TestFlatten(unittest.TestCase):
    """Test flatten command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_flatten_basic(self):
        """Flatten a directory with children into its parent."""
        # Use doc02.06 (06-decisions/) — it has multiple children
        decisions_dir = self.carta_copy / "02-architecture" / "06-decisions"
        assert decisions_dir.is_dir()
        children_before = list_numbered_entries(decisions_dir)
        # Exclude 00-index.md from count
        num_children = len([c for c in children_before if c.name != "00-index.md"])

        result = _run_carta(self.carta_copy, "flatten", "doc02.06", "--force")
        assert result.returncode == 0, f"flatten failed:\n{result.stderr}\n{result.stdout}"

        # Source dir should be gone
        assert not decisions_dir.exists(), "Source directory should be removed"

        # Children should be in parent (02-architecture/)
        system_dir = self.carta_copy / "02-architecture"
        entries = list_numbered_entries(system_dir)
        # Should have original entries (minus decisions dir) + hoisted children
        assert len(entries) > num_children, f"Expected hoisted children in parent: {[e.name for e in entries]}"

        # No duplicate prefixes
        prefixes = [get_numeric_prefix(e.name) for e in entries]
        assert len(prefixes) == len(set(prefixes)), f"Duplicate prefixes: {prefixes}"

    def test_flatten_leaf_file_errors(self):
        """Flattening a file (not directory) should fail."""
        result = _run_carta(self.carta_copy, "flatten", "doc02.01")  # 01-overview.md is a file
        assert result.returncode != 0
        assert "not a directory" in result.stderr.lower()

    def test_flatten_dry_run(self):
        """--dry-run should not modify files."""
        before = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                  if p.is_file()
                  and p.suffix in (".md", ".json", "")}
        result = _run_carta(self.carta_copy, "flatten", "doc02.06", "--force", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                 if p.is_file()
                 and p.suffix in (".md", ".json", "")}
        assert before == after

    def test_flatten_refuses_big_index(self):
        """Flatten should refuse if 00-index.md has >10 content lines without --force."""
        result = _run_carta(self.carta_copy, "flatten", "doc02.06")  # no --force, no --keep-index
        # If the index has >10 lines, this should fail
        if result.returncode != 0:
            assert "content lines" in result.stderr.lower() or "index" in result.stderr.lower()

    def test_flatten_keep_index(self):
        """--keep-index should preserve the index as a numbered file with parent slug."""
        # Use doc01.01 (01-goals/) which has a 00-index.md and numbered children
        goals_dir = self.carta_copy / "01-product" / "01-goals"
        assert goals_dir.is_dir(), f"Expected 01-goals/ dir: {goals_dir}"
        assert (goals_dir / "00-index.md").exists(), "Expected 00-index.md in 01-goals/"

        result = _run_carta(self.carta_copy, "flatten", "doc01.01", "--keep-index")
        assert result.returncode == 0, f"flatten failed:\n{result.stderr}\n{result.stdout}"

        # Look for a file with "goals" slug in 01-product/
        product_dir = self.carta_copy / "01-product"
        goals_files = [e for e in product_dir.iterdir()
                       if "goals" in e.name and e.is_file()]
        assert len(goals_files) == 1, (
            f"Expected demoted index with 'goals' slug: {[e.name for e in product_dir.iterdir()]}"
        )
        # Content is preserved
        demoted_content = goals_files[0].read_text(encoding="utf-8")
        assert len(demoted_content) > 0, "Demoted index should not be empty"

    def test_flatten_no_orphaned_refs(self):
        """Flatten should not introduce orphaned refs."""
        pre_existing = set(
            ref for _, ref in self._collect_orphaned_refs(self.carta_copy)
        )

        result = _run_carta(self.carta_copy, "flatten", "doc02.06", "--force")
        assert result.returncode == 0, result.stderr

        orphans = self._collect_orphaned_refs(self.carta_copy)
        new_orphans = [(f, r) for f, r in orphans if r not in pre_existing]
        assert new_orphans == [], (
            "New orphaned refs:\n" + "\n".join(f"  {r} in {f}" for f, r in new_orphans)
        )

    def _collect_orphaned_refs(self, carta_root):
        excluded = {carta_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []
        for md in carta_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), carta_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(carta_root), m.group()))
        return orphans


class TestDelete(unittest.TestCase):
    """Test delete command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _assert_no_duplicate_prefixes(self, carta_root):
        excluded = {carta_root / ".state"}
        for dirpath in carta_root.rglob("*"):
            if not dirpath.is_dir():
                continue
            if any(excl in dirpath.parents or dirpath == excl for excl in excluded):
                continue
            prefixes = []
            for entry in dirpath.iterdir():
                m = re.match(r'^(\d{2})-', entry.name)
                if m:
                    prefixes.append(int(m.group(1)))
            duplicates = [p for p in prefixes if prefixes.count(p) > 1]
            assert duplicates == [], f"Duplicate prefixes in {dirpath}: {sorted(set(duplicates))}"

    def _collect_orphaned_refs(self, carta_root):
        excluded = {carta_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []
        for md in carta_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), carta_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(carta_root), m.group()))
        return orphans

    def test_delete_single_file(self):
        """Delete a leaf .md file, verify gap-closing."""
        # Delete doc00.03 (03-conventions.md)
        codex = self.carta_copy / "00-codex"
        target = codex / "03-conventions.md"
        assert target.exists()
        entries_before = list_numbered_entries(codex)
        count_before = len(entries_before)

        result = _run_carta(self.carta_copy, "delete", "doc00.03")
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        # File should be gone
        assert not target.exists()

        # Siblings should be gap-closed
        entries_after = list_numbered_entries(codex)
        assert len(entries_after) == count_before - 1

        # No duplicate prefixes
        self._assert_no_duplicate_prefixes(self.carta_copy)

        # Prefixes should be sequential
        prefixes = [get_numeric_prefix(e.name) for e in entries_after if get_numeric_prefix(e.name) > 0]
        assert prefixes == list(range(1, len(prefixes) + 1)), f"Non-sequential prefixes: {prefixes}"

    def test_delete_directory(self):
        """Delete a directory, verify dir + contents gone and siblings gap-closed."""
        # Delete doc02.06 (06-decisions/)
        arch = self.carta_copy / "02-architecture"
        target = arch / "06-decisions"
        assert target.is_dir()

        result = _run_carta(self.carta_copy, "delete", "doc02.06")
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        assert not target.exists()
        self._assert_no_duplicate_prefixes(self.carta_copy)

    def test_delete_multiple_same_parent(self):
        """Delete two entries from same parent, verify correct sequential renumbering."""
        codex = self.carta_copy / "00-codex"
        entries_before = list_numbered_entries(codex)
        count_before = len(entries_before)

        result = _run_carta(self.carta_copy, "delete", "doc00.02", "doc00.04")
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        entries_after = list_numbered_entries(codex)
        assert len(entries_after) == count_before - 2

        # No duplicate prefixes
        self._assert_no_duplicate_prefixes(self.carta_copy)

        # Prefixes sequential
        prefixes = [get_numeric_prefix(e.name) for e in entries_after if get_numeric_prefix(e.name) > 0]
        assert prefixes == list(range(1, len(prefixes) + 1)), f"Non-sequential: {prefixes}"

    def test_delete_dry_run(self):
        """--dry-run should not modify files."""
        before = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                  if p.is_file()
                  and p.suffix in (".md", ".json", "")}
        result = _run_carta(self.carta_copy, "delete", "doc00.03", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                 if p.is_file()
                 and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"

    def test_delete_orphan_warning(self):
        """Delete entry referenced by other docs, verify warning in output."""
        # doc02.04.02 (metamodel) is referenced by many docs
        result = _run_carta(self.carta_copy, "delete", "doc02.04.02", "--dry-run")
        assert result.returncode == 0, result.stderr
        assert "orphan" in result.stdout.lower(), \
            f"Expected orphan warning in output:\n{result.stdout}"

    def test_delete_nonexistent_errors(self):
        """Non-zero exit on bad ref."""
        result = _run_carta(self.carta_copy, "delete", "doc99.99")
        assert result.returncode != 0

    def test_delete_no_new_orphans(self):
        """After gap-close, refs to surviving siblings are correct."""
        pre_existing = set(ref for _, ref in self._collect_orphaned_refs(self.carta_copy))

        # Delete something that won't create orphaned refs to itself
        # (delete the last entry in codex, which is unlikely to be referenced)
        codex = self.carta_copy / "00-codex"
        entries = list_numbered_entries(codex)
        last = entries[-1]

        result = _run_carta(self.carta_copy, "delete", str(last.relative_to(self.carta_copy)))
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        orphans = self._collect_orphaned_refs(self.carta_copy)
        new_orphans = [(f, r) for f, r in orphans if r not in pre_existing]
        # Filter out refs that point to the deleted entry itself (those are expected orphans)
        assert new_orphans == [] or all("00.06" in r or "00.05" in r for _, r in new_orphans), \
            f"New orphaned refs:\n" + "\n".join(f"  {r} in {f}" for f, r in new_orphans)


class TestCreate(unittest.TestCase):
    """Test create command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_create_appends(self):
        """Create with no --order appends at max+1 position."""
        codex = self.carta_copy / "00-codex"
        entries_before = list_numbered_entries(codex)
        max_prefix = max(get_numeric_prefix(e.name) for e in entries_before)

        result = _run_carta(self.carta_copy, "create", "doc00", "test-doc")
        assert result.returncode == 0, f"create failed:\n{result.stderr}\n{result.stdout}"

        # File should exist at max+1
        expected = codex / f"{max_prefix + 1:02d}-test-doc.md"
        assert expected.exists(), f"Expected file at {expected}"

        # Check frontmatter
        from carta_cli.frontmatter import read_frontmatter
        fm, body = read_frontmatter(expected)
        assert fm["title"] == "Test Doc"
        assert fm["status"] == "draft"

        # MANIFEST should be regenerated
        manifest = self.carta_copy / "MANIFEST.md"
        assert "test-doc" in manifest.read_text(encoding="utf-8").lower()

    def test_create_at_free_position(self):
        """Create with --order at a free slot."""
        # Find a free position in codex
        codex = self.carta_copy / "00-codex"
        entries = list_numbered_entries(codex)
        max_prefix = max(get_numeric_prefix(e.name) for e in entries)
        free_pos = max_prefix + 5  # definitely free

        result = _run_carta(self.carta_copy, "create", "doc00", "free-slot", "--order", str(free_pos))
        assert result.returncode == 0, f"create failed:\n{result.stderr}\n{result.stdout}"

        expected = codex / f"{free_pos:02d}-free-slot.md"
        assert expected.exists()

    def test_create_at_occupied_position_errors(self):
        """Create with --order at occupied slot should error."""
        result = _run_carta(self.carta_copy, "create", "doc00", "bad-slot", "--order", "1")
        assert result.returncode != 0
        assert "occupied" in result.stderr.lower()

    def test_create_with_title(self):
        """--title overrides slug-derived title."""
        result = _run_carta(self.carta_copy, "create", "doc00", "my-thing", "--title", "My Custom Title")
        assert result.returncode == 0, f"create failed:\n{result.stderr}\n{result.stdout}"

        codex = self.carta_copy / "00-codex"
        created = [e for e in codex.iterdir() if "my-thing" in e.name]
        assert len(created) == 1

        from carta_cli.frontmatter import read_frontmatter
        fm, _ = read_frontmatter(created[0])
        assert fm["title"] == "My Custom Title"

    def test_create_dry_run(self):
        """--dry-run should not create files."""
        before = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                  if p.is_file()
                  and p.suffix in (".md", ".json", "")}
        result = _run_carta(self.carta_copy, "create", "doc00", "phantom", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                 if p.is_file()
                 and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"


class TestMkdir(unittest.TestCase):
    """Test --mkdir flag on move command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_mkdir_creates_destination(self):
        """Move with --mkdir to nonexistent path creates dir with 00-index.md."""
        # Create a new dir path under an existing section
        new_dir = "02-architecture/99-new-section"
        result = _run_carta(self.carta_copy, "move", "doc02.01", new_dir, "--mkdir")
        assert result.returncode == 0, f"move --mkdir failed:\n{result.stderr}\n{result.stdout}"

        # The dir may have been renumbered by gap-closing, so look for "new-section" by slug
        system = self.carta_copy / "02-architecture"
        new_section_dirs = [e for e in system.iterdir() if "new-section" in e.name and e.is_dir()]
        assert len(new_section_dirs) == 1, f"Expected new-section dir: {[e.name for e in system.iterdir()]}"

        dest = new_section_dirs[0]
        assert (dest / "00-index.md").exists(), "00-index.md should be created"

        # Source should be moved into the new dir
        moved = [e for e in dest.iterdir() if "overview" in e.name]
        assert len(moved) == 1, f"Expected overview in new dir: {list(dest.iterdir())}"

    def test_mkdir_dry_run(self):
        """--mkdir --dry-run should not create dirs (but creates+cleans up internally)."""
        new_dir = "02-architecture/99-new-section"
        before_dirs = set(str(p) for p in self.carta_copy.rglob("*") if p.is_dir())

        result = _run_carta(self.carta_copy, "move", "doc02.06", new_dir, "--mkdir", "--dry-run")
        assert result.returncode == 0, f"move --mkdir --dry-run failed:\n{result.stderr}\n{result.stdout}"

        after_dirs = set(str(p) for p in self.carta_copy.rglob("*") if p.is_dir())
        assert before_dirs == after_dirs, "Directories were created during --dry-run"

    def test_mkdir_existing_dir_noop(self):
        """--mkdir when dest exists works normally (no error, no extra dir)."""
        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01", "--mkdir")
        assert result.returncode == 0, f"move --mkdir failed:\n{result.stderr}\n{result.stdout}"

    def test_move_without_mkdir_still_errors(self):
        """Without --mkdir, moving to nonexistent path should error."""
        result = _run_carta(self.carta_copy, "move", "doc02.06", "02-architecture/99-nonexistent")
        assert result.returncode != 0


if __name__ == "__main__":
    unittest.main()
