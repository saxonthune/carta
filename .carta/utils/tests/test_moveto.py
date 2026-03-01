"""Integration tests for the moveto toolchain.

Run with:
    cd .carta/utils && python3 -m unittest tests.test_moveto -v
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Ensure lib/ is importable
_UTILS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_UTILS_DIR))

from lib.refs import ref_to_path, path_to_ref, collect_md_files, rewrite_refs
from lib.workspace import find_carta_root

# Real .carta/ root (used to copy fixtures)
_REAL_CARTA_ROOT = find_carta_root()
_MOVETO_SCRIPT = _UTILS_DIR / "moveto"


def _copy_carta(dest: Path) -> Path:
    """Copy the real .carta/ into dest/. Returns dest/.carta/."""
    carta_copy = dest / ".carta"
    shutil.copytree(str(_REAL_CARTA_ROOT), str(carta_copy), dirs_exist_ok=False)
    # Remove the utils/ directory from the copy to avoid re-entrancy
    utils_copy = carta_copy / "utils"
    if utils_copy.exists():
        shutil.rmtree(str(utils_copy))
    return carta_copy


class TestRefToPath(unittest.TestCase):
    """Tests for ref_to_path and path_to_ref."""

    def setUp(self):
        self.root = _REAL_CARTA_ROOT

    def test_ref_to_path_file(self):
        path = ref_to_path("doc02.06", self.root)
        self.assertTrue(path.name.startswith("06-"))
        self.assertTrue(path.name.endswith(".md"))
        self.assertTrue(path.exists(), f"Expected file to exist: {path}")

    def test_ref_to_path_directory(self):
        path = ref_to_path("doc02.04", self.root)
        self.assertTrue(path.is_dir(), f"Expected directory: {path}")
        self.assertTrue(path.name.startswith("04-"))

    def test_ref_to_path_roundtrip(self):
        known_refs = ["doc02.06", "doc00.01", "doc01.02.01.01", "doc02.04"]
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
        from lib.refs import compute_rename_map
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
        # We need a fresh copy of utils/ in the carta_copy for the script to find carta_root
        utils_copy = self.carta_copy / "utils"
        shutil.copytree(str(_UTILS_DIR), str(utils_copy), dirs_exist_ok=False)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_dry_run_no_modification(self):
        """--dry-run should print output but not change files."""
        moveto = self.carta_copy / "utils" / "moveto"

        # Snapshot only text-like files that moveto could plausibly modify.
        # Exclude __pycache__ (created by Python imports in subprocess).
        def snapshot(root: Path) -> dict[Path, bytes]:
            return {
                p: p.read_bytes()
                for p in root.rglob("*")
                if p.is_file()
                and "__pycache__" not in p.parts
                and p.suffix in (".md", ".json", ".txt", "")
            }

        before = snapshot(self.carta_copy)

        result = subprocess.run(
            [sys.executable, str(moveto), "doc00.05", "doc01", "--dry-run"],
            capture_output=True, text=True,
        )

        after = snapshot(self.carta_copy)

        self.assertEqual(result.returncode, 0, f"moveto failed:\n{result.stderr}")
        self.assertIn("rename map", result.stdout.lower())
        self.assertEqual(before, after, "Files were modified during --dry-run")


class TestMovetoActualMove(unittest.TestCase):
    """Test an actual moveto operation end-to-end."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))
        utils_copy = self.carta_copy / "utils"
        shutil.copytree(str(_UTILS_DIR), str(utils_copy), dirs_exist_ok=False)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_moveto(self, *args: str) -> subprocess.CompletedProcess:
        moveto = self.carta_copy / "utils" / "moveto"
        return subprocess.run(
            [sys.executable, str(moveto)] + list(args),
            capture_output=True, text=True,
        )

    def test_actual_move_doc00_05_to_doc01(self):
        """Move doc00.05 (05-ai-retrieval.md) into doc01 (01-context/)."""
        # Collect pre-existing orphaned refs (to avoid false positives)
        pre_existing_orphans = set(
            ref for _, ref in self._collect_orphaned_refs(self.carta_copy)
        )

        # Before: source exists
        source = self.carta_copy / "00-codex" / "05-ai-retrieval.md"
        self.assertTrue(source.exists(), "Source must exist before move")

        result = self._run_moveto("doc00.05", "doc01")
        self.assertEqual(result.returncode, 0, f"moveto failed:\n{result.stderr}\n{result.stdout}")

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
        excluded = {carta_root / ".state", carta_root / "utils"}
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
        excluded = {carta_root / ".state", carta_root / "utils"}
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
        utils_copy = self.carta_copy / "utils"
        shutil.copytree(str(_UTILS_DIR), str(utils_copy), dirs_exist_ok=False)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_moveto(self, *args: str) -> subprocess.CompletedProcess:
        moveto = self.carta_copy / "utils" / "moveto"
        return subprocess.run(
            [sys.executable, str(moveto)] + list(args),
            capture_output=True, text=True,
        )

    def test_move_later_entry_to_first(self):
        """Moving a later entry to position 1 should not leave gaps."""
        # 03-operations -> position 1
        result = self._run_moveto("03-operations", ".", "--order", "1")
        self.assertEqual(result.returncode, 0, f"moveto failed:\n{result.stderr}\n{result.stdout}")

        # Check: entries should be 01-operations, 02-product, 03-system, 04-research (renumbered)
        entries = sorted(
            e.name for e in self.carta_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in entries]
        # No gaps: consecutive from min to max
        self.assertEqual(prefixes, list(range(prefixes[0], prefixes[0] + len(prefixes))),
                         f"Expected no gaps in numbering: {entries}")
        # Operations is at position 01 (after 00-codex)
        ops_entries = [e for e in entries if "operations" in e]
        self.assertEqual(len(ops_entries), 1)
        self.assertTrue(ops_entries[0].startswith("01-"),
                         f"Expected operations at position 01: {ops_entries[0]}")

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

        result = self._run_moveto("01-product", ".", "--order", str(max_prefix))
        self.assertEqual(result.returncode, 0, f"moveto failed:\n{result.stderr}\n{result.stdout}")

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
        utils_copy = self.carta_copy / "utils"
        shutil.copytree(str(_UTILS_DIR), str(utils_copy), dirs_exist_ok=False)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_moveto(self, *args: str) -> subprocess.CompletedProcess:
        moveto = self.carta_copy / "utils" / "moveto"
        return subprocess.run(
            [sys.executable, str(moveto)] + list(args),
            capture_output=True, text=True,
        )

    def _assert_no_duplicate_prefixes(self, carta_root: Path) -> None:
        excluded = {carta_root / ".state", carta_root / "utils"}
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
        excluded = {carta_root / ".state", carta_root / "utils"}
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

    def test_move_product_into_sibling_operations(self):
        """Move 01-product into 03-operations (dest gets gap-closed from 03→02)."""
        pre_existing_orphans = set(
            ref for _, ref in self._collect_orphaned_refs(self.carta_copy)
        )

        result = self._run_moveto("doc01", "doc03", "--order", "1")
        self.assertEqual(result.returncode, 0, f"moveto failed:\n{result.stderr}\n{result.stdout}")

        # Top-level should have no gaps
        entries = sorted(
            e.name for e in self.carta_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in entries]
        self.assertEqual(prefixes, list(range(0, len(prefixes))),
                         f"Expected no gaps in top-level numbering: {entries}")

        # Operations dir (gap-closed from 03 to 02)
        ops_dir = None
        for e in self.carta_copy.iterdir():
            if "operations" in e.name:
                ops_dir = e
                break
        self.assertIsNotNone(ops_dir, "Operations directory not found")

        product_entries = [e for e in ops_dir.iterdir() if "product" in e.name]
        self.assertEqual(len(product_entries), 1,
                         f"Expected product inside operations: {list(ops_dir.iterdir())}")
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


if __name__ == "__main__":
    unittest.main()
