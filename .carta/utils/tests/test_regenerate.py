"""Tests for regenerate and migrate-frontmatter toolchain.

Run with:
    cd .carta/utils && python3 -m pytest tests/test_regenerate.py -v
"""

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

from lib.workspace import find_carta_root
from lib.refs import ref_to_path
from lib.frontmatter import read_frontmatter, write_frontmatter

_REAL_CARTA_ROOT = find_carta_root()
_CARTA_SCRIPT = _UTILS_DIR / "carta"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _copy_carta(dest: Path) -> Path:
    """Copy the real .carta/ into dest/. Returns dest/.carta/."""
    carta_copy = dest / ".carta"
    shutil.copytree(str(_REAL_CARTA_ROOT), str(carta_copy), dirs_exist_ok=False)
    utils_copy = carta_copy / "utils"
    if utils_copy.exists():
        shutil.rmtree(str(utils_copy))
    # Copy utils/ back so scripts are runnable
    shutil.copytree(str(_UTILS_DIR), str(utils_copy), dirs_exist_ok=False)
    return carta_copy


# ---------------------------------------------------------------------------
# Test 1: frontmatter read/write roundtrip
# ---------------------------------------------------------------------------

class TestFrontmatterRoundtrip(unittest.TestCase):
    """Verify read_frontmatter + write_frontmatter is lossless."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_roundtrip_simple(self):
        """Scalar fields survive a read/write cycle."""
        p = self.tmp / "doc.md"
        p.write_text("---\ntitle: Foo\nstatus: active\n---\n\n# Body\n", encoding="utf-8")

        fm, body = read_frontmatter(p)
        self.assertEqual(fm["title"], "Foo")
        self.assertEqual(fm["status"], "active")
        self.assertIn("# Body", body)

        write_frontmatter(p, fm, body)
        fm2, body2 = read_frontmatter(p)
        self.assertEqual(fm2["title"], "Foo")
        self.assertEqual(body2, body)

    def test_roundtrip_lists(self):
        """List fields survive a read/write cycle as inline lists."""
        p = self.tmp / "doc.md"
        p.write_text(
            "---\ntitle: Bar\nstatus: draft\ntags: [a, b, c]\ndeps: [doc01.01, doc02.02]\n---\n\nbody\n",
            encoding="utf-8",
        )
        fm, body = read_frontmatter(p)
        self.assertEqual(fm["tags"], ["a", "b", "c"])
        self.assertEqual(fm["deps"], ["doc01.01", "doc02.02"])

        write_frontmatter(p, fm, body)
        fm2, _ = read_frontmatter(p)
        self.assertEqual(fm2["tags"], ["a", "b", "c"])
        self.assertEqual(fm2["deps"], ["doc01.01", "doc02.02"])

    def test_roundtrip_empty_lists(self):
        """Empty list fields written as [] and read back as []."""
        p = self.tmp / "doc.md"
        p.write_text("---\ntitle: X\nstatus: active\ntags: []\ndeps: []\n---\n", encoding="utf-8")
        fm, body = read_frontmatter(p)
        self.assertEqual(fm["tags"], [])
        self.assertEqual(fm["deps"], [])

        write_frontmatter(p, fm, body)
        fm2, _ = read_frontmatter(p)
        self.assertEqual(fm2["tags"], [])
        self.assertEqual(fm2["deps"], [])

    def test_no_frontmatter(self):
        """Files without frontmatter return empty dict and full text as body."""
        p = self.tmp / "plain.md"
        content = "# Plain\n\nNo frontmatter here.\n"
        p.write_text(content, encoding="utf-8")

        fm, body = read_frontmatter(p)
        self.assertEqual(fm, {})
        self.assertEqual(body, content)

    def test_canonical_field_order(self):
        """write_frontmatter emits fields in canonical order."""
        p = self.tmp / "order.md"
        fm = {"deps": ["doc01.01"], "title": "X", "summary": "s", "status": "active", "tags": ["t"]}
        write_frontmatter(p, fm, "")
        text = p.read_text(encoding="utf-8")
        lines = text.splitlines()
        field_lines = [l for l in lines if ":" in l and not l.startswith("---")]
        fields = [l.split(":")[0] for l in field_lines]
        self.assertEqual(fields, ["title", "status", "summary", "tags", "deps"])


# ---------------------------------------------------------------------------
# Test 2: migrate adds missing fields
# ---------------------------------------------------------------------------

class TestMigrateAddsMissingFields(unittest.TestCase):
    """migrate-frontmatter injects summary/tags/deps from MANIFEST rows."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_migrate(self, *args: str) -> subprocess.CompletedProcess:
        carta = self.carta_copy / "utils" / "carta"
        return subprocess.run(
            [sys.executable, str(carta), "migrate-frontmatter"] + list(args),
            capture_output=True, text=True,
        )

    def test_migrate_adds_fields(self):
        """A doc with only title/status gets summary/tags/deps after migration."""
        # Use a doc we know starts with just title/status (strip its frontmatter)
        target = self.carta_copy / "00-codex" / "01-about.md"
        fm, body = read_frontmatter(target)
        # Write back with only title and status
        stripped = {"title": fm.get("title", "About"), "status": fm.get("status", "active")}
        write_frontmatter(target, stripped, body)

        result = self._run_migrate()
        self.assertEqual(result.returncode, 0, f"migrate failed:\n{result.stderr}")

        fm2, _ = read_frontmatter(target)
        self.assertIn("summary", fm2, "summary should be added")
        self.assertIn("tags", fm2, "tags should be added")
        self.assertIn("deps", fm2, "deps should be added")
        self.assertTrue(fm2["summary"], "summary should not be empty")

    def test_migrate_dry_run_no_write(self):
        """--dry-run does not modify files."""
        target = self.carta_copy / "00-codex" / "02-taxonomy.md"
        before = target.read_bytes()

        result = self._run_migrate("--dry-run")
        self.assertEqual(result.returncode, 0, f"migrate --dry-run failed:\n{result.stderr}")

        after = target.read_bytes()
        self.assertEqual(before, after, "--dry-run should not modify files")
        self.assertIn("dry-run", result.stdout.lower())


# ---------------------------------------------------------------------------
# Test 3: migrate preserves existing fields
# ---------------------------------------------------------------------------

class TestMigratePreservesExistingFields(unittest.TestCase):
    """migrate-frontmatter does not overwrite existing non-empty values."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_migrate(self, *args: str) -> subprocess.CompletedProcess:
        carta = self.carta_copy / "utils" / "carta"
        return subprocess.run(
            [sys.executable, str(carta), "migrate-frontmatter"] + list(args),
            capture_output=True, text=True,
        )

    def test_existing_summary_not_overwritten(self):
        """An existing non-empty summary is preserved after migration."""
        target = self.carta_copy / "00-codex" / "03-conventions.md"
        fm, body = read_frontmatter(target)
        original_summary = "My custom summary"
        fm["summary"] = original_summary
        write_frontmatter(target, fm, body)

        result = self._run_migrate()
        self.assertEqual(result.returncode, 0)

        fm2, _ = read_frontmatter(target)
        self.assertEqual(fm2.get("summary"), original_summary,
                         "Existing summary should not be overwritten")


# ---------------------------------------------------------------------------
# Test 4: regenerate includes all docs
# ---------------------------------------------------------------------------

class TestRegenerateIncludesAllDocs(unittest.TestCase):
    """regenerate --dry-run output includes every numbered .md file."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_regenerate(self, *args: str) -> subprocess.CompletedProcess:
        carta = self.carta_copy / "utils" / "carta"
        return subprocess.run(
            [sys.executable, str(carta), "regenerate"] + list(args),
            capture_output=True, text=True,
        )

    def test_all_docs_appear(self):
        """Every numbered .md file (excluding MANIFEST.md and utils/) has a row."""
        result = self._run_regenerate("--dry-run")
        self.assertEqual(result.returncode, 0, f"regenerate failed:\n{result.stderr}")

        output = result.stdout

        # Find all numbered .md files under carta_copy
        excluded = {self.carta_copy / "utils"}
        numeric_re = re.compile(r'^\d{2}-')
        md_files = []
        for md in self.carta_copy.rglob("*.md"):
            if any(excl in md.parents for excl in excluded):
                continue
            if md.name == "MANIFEST.md":
                continue
            if numeric_re.match(md.name):
                md_files.append(md)

        # Each file should appear as a row (check the backtick filename in output)
        missing = []
        for md in md_files:
            filename = md.name
            if f"`{filename}`" not in output and f"`{filename.replace('.md', '')}`" not in output:
                # Try checking by ref
                try:
                    from lib.refs import path_to_ref
                    ref = path_to_ref(md, self.carta_copy)
                    if ref not in output:
                        missing.append(str(md.relative_to(self.carta_copy)))
                except ValueError:
                    pass

        self.assertEqual(missing, [], f"These docs are missing from regenerated MANIFEST:\n" +
                         "\n".join(f"  {m}" for m in missing))


# ---------------------------------------------------------------------------
# Test 5: tag index completeness
# ---------------------------------------------------------------------------

class TestTagIndexComplete(unittest.TestCase):
    """regenerate produces a tag index containing all declared tags."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_regenerate(self, *args: str) -> subprocess.CompletedProcess:
        carta = self.carta_copy / "utils" / "carta"
        return subprocess.run(
            [sys.executable, str(carta), "regenerate"] + list(args),
            capture_output=True, text=True,
        )

    def test_tag_index_contains_all_tags(self):
        """Every tag declared in a doc's frontmatter appears in the tag index."""
        result = self._run_regenerate("--dry-run")
        self.assertEqual(result.returncode, 0, f"regenerate failed:\n{result.stderr}")
        output = result.stdout

        # Collect all tags from all doc frontmatter
        excluded = {self.carta_copy / "utils"}
        numeric_re = re.compile(r'^\d{2}-')
        all_tags = set()

        for md in self.carta_copy.rglob("*.md"):
            if any(excl in md.parents for excl in excluded):
                continue
            if md.name == "MANIFEST.md":
                continue
            if not numeric_re.match(md.name):
                continue

            fm, _ = read_frontmatter(md)
            raw_tags = fm.get("tags", [])
            if isinstance(raw_tags, list):
                all_tags.update(raw_tags)
            elif isinstance(raw_tags, str) and raw_tags:
                for t in raw_tags.split(","):
                    all_tags.add(t.strip())

        # Check each tag appears in the tag index section
        tag_index_section = output.split("## Tag Index")[-1] if "## Tag Index" in output else ""
        missing_tags = []
        for tag in all_tags:
            if tag and f"`{tag}`" not in tag_index_section:
                missing_tags.append(tag)

        self.assertEqual(missing_tags, [],
                         f"Tags missing from tag index: {missing_tags}")

    def test_deps_column_uses_emdash_for_empty(self):
        """Rows with no deps show — not an empty string."""
        result = self._run_regenerate("--dry-run")
        self.assertEqual(result.returncode, 0)

        rows = [l for l in result.stdout.splitlines() if l.startswith("| doc")]
        empty_deps = [r for r in rows if r.endswith("| — |")]
        self.assertGreater(len(empty_deps), 0, "At least some docs should have — in deps column")

        # No row should have empty deps column (trailing | |)
        bad_rows = [r for r in rows if r.endswith("|  |")]
        self.assertEqual(bad_rows, [], f"Rows with empty deps cell: {bad_rows}")


# ---------------------------------------------------------------------------
# Test 6: refs in generated output resolve
# ---------------------------------------------------------------------------

class TestRefsResolve(unittest.TestCase):
    """Every doc ref in the generated MANIFEST resolves without error."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _run_regenerate(self, *args: str) -> subprocess.CompletedProcess:
        carta = self.carta_copy / "utils" / "carta"
        return subprocess.run(
            [sys.executable, str(carta), "regenerate"] + list(args),
            capture_output=True, text=True,
        )

    def test_all_refs_resolve(self):
        """ref_to_path resolves each doc ref emitted in the generated MANIFEST."""
        result = self._run_regenerate("--dry-run")
        self.assertEqual(result.returncode, 0, f"regenerate failed:\n{result.stderr}")

        # Extract all doc refs from table rows (first column)
        ref_re = re.compile(r'^\| (doc\S+) \|')
        refs = []
        for line in result.stdout.splitlines():
            m = ref_re.match(line.strip())
            if m:
                refs.append(m.group(1))

        unresolvable = []
        for ref in refs:
            try:
                ref_to_path(ref, self.carta_copy)
            except (FileNotFoundError, ValueError) as e:
                unresolvable.append((ref, str(e)))

        self.assertEqual(unresolvable, [],
                         f"Unresolvable refs in generated MANIFEST:\n" +
                         "\n".join(f"  {r}: {e}" for r, e in unresolvable))


if __name__ == "__main__":
    unittest.main()
