"""Tests for regenerate and migrate-frontmatter toolchain.

Run with:
    python3 -m pytest tests/test_regenerate.py -v
"""

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

from carta_cli.workspace import find_workspace
from carta_cli.ref_convert import ref_to_path
from carta_cli.frontmatter import read_frontmatter, write_frontmatter

_REAL_CARTA_ROOT = find_workspace()
_ENV_WITH_CLI = {**__import__("os").environ, "PYTHONPATH": str(_CLI_DIR)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
# Test 2: regenerate includes all docs
# ---------------------------------------------------------------------------

class TestRegenerateIncludesAllDocs(unittest.TestCase):
    """regenerate --dry-run output includes every numbered .md file."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _copy_carta(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_all_docs_appear(self):
        """Every numbered .md file (excluding MANIFEST.md) has a row."""
        result = _run_carta(self.carta_copy, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0, f"regenerate failed:\n{result.stderr}")

        output = result.stdout

        # Find all numbered .md files under carta_copy
        numeric_re = re.compile(r'^\d{2}-')
        md_files = []
        for md in self.carta_copy.rglob("*.md"):
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
                    ref = ref_to_path.__module__ and __import__(
                        "carta_cli.ref_convert", fromlist=["path_to_ref"]
                    ).path_to_ref(md, self.carta_copy)
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

    def test_tag_index_contains_all_tags(self):
        """Every tag declared in a doc's frontmatter appears in the tag index."""
        result = _run_carta(self.carta_copy, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0, f"regenerate failed:\n{result.stderr}")
        output = result.stdout

        # Collect all tags from all doc frontmatter
        numeric_re = re.compile(r'^\d{2}-')
        all_tags = set()

        for md in self.carta_copy.rglob("*.md"):
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
        result = _run_carta(self.carta_copy, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0)

        rows = [l for l in result.stdout.splitlines() if l.startswith("| doc")]
        # Deps is column 5 (index 4), Refs is column 6 (index 5).
        # Both should use — for empty, never be blank.
        has_emdash_deps = False
        for r in rows:
            cols = [c.strip() for c in r.split("|")[1:-1]]  # strip outer pipes
            if len(cols) >= 5 and cols[4] == "—":
                has_emdash_deps = True
            # Deps and Refs columns must not be empty (should be — if no values)
            if len(cols) >= 5:
                self.assertTrue(cols[4], f"Empty deps column in row: {r}")
            if len(cols) >= 6:
                self.assertTrue(cols[5], f"Empty refs column in row: {r}")
        self.assertTrue(has_emdash_deps, "At least some docs should have — in deps column")

    def test_refs_column_present(self):
        """Regenerated MANIFEST has a Refs column with reverse deps."""
        result = _run_carta(self.carta_copy, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0)
        output = result.stdout

        # Header should include Refs column
        self.assertIn("| Refs |", output)

        # At least some rows should have non-emdash refs (docs that are depended on)
        rows = [l for l in output.splitlines() if l.startswith("| doc")]
        has_reverse_dep = False
        for r in rows:
            cols = [c.strip() for c in r.split("|")[1:-1]]
            if len(cols) >= 6 and cols[5] != "—":
                has_reverse_dep = True
                break
        self.assertTrue(has_reverse_dep, "At least some docs should have reverse deps in Refs column")


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

    def test_all_refs_resolve(self):
        """ref_to_path resolves each doc ref emitted in the generated MANIFEST."""
        result = _run_carta(self.carta_copy, "regenerate", "--dry-run")
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
