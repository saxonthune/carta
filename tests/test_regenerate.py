"""Tests for regenerate and migrate-frontmatter toolchain.

Run with:
    python3 -m pytest tests/test_regenerate.py -v
"""

import contextlib
import io
import re
import shutil
import sys
import tempfile
import types
import unittest
from pathlib import Path

# Ensure carta_cli is importable without prior pip install
_CLI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_CLI_DIR))

from carta_cli.commands._parser import main as cli_main
from carta_cli.workspace import find_workspace
from carta_cli.ref_convert import ref_to_path
from carta_cli.frontmatter import read_frontmatter, write_frontmatter

_REAL_CARTA_ROOT = find_workspace()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _copy_carta(dest: Path) -> Path:
    """Copy the real .carta/ into dest/. Returns dest/.carta/."""
    carta_copy = dest / ".carta"
    shutil.copytree(str(_REAL_CARTA_ROOT), str(carta_copy), dirs_exist_ok=False)
    return carta_copy


def _run_carta(carta_copy: Path, *args: str) -> types.SimpleNamespace:
    """Run the carta CLI against a workspace copy (in-process)."""
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            code = cli_main(["--workspace", str(carta_copy)] + list(args))
    except SystemExit as e:
        code = int(e.code) if e.code is not None else 0
    return types.SimpleNamespace(
        returncode=code,
        stdout=stdout_buf.getvalue(),
        stderr=stderr_buf.getvalue(),
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
        p.write_text("---\ntitle: Foo\n---\n\n# Body\n", encoding="utf-8")

        fm, body = read_frontmatter(p)
        self.assertEqual(fm["title"], "Foo")
        self.assertIn("# Body", body)

        write_frontmatter(p, fm, body)
        fm2, body2 = read_frontmatter(p)
        self.assertEqual(fm2["title"], "Foo")
        self.assertEqual(body2, body)

    def test_roundtrip_lists(self):
        """List fields survive a read/write cycle as inline lists."""
        p = self.tmp / "doc.md"
        p.write_text(
            "---\ntitle: Bar\ntags: [a, b, c]\ndeps: [doc01.01, doc02.02]\n---\n\nbody\n",
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
        p.write_text("---\ntitle: X\ntags: []\ndeps: []\n---\n", encoding="utf-8")
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
        fm = {"deps": ["doc01.01"], "title": "X", "summary": "s", "tags": ["t"]}
        write_frontmatter(p, fm, "")
        text = p.read_text(encoding="utf-8")
        lines = text.splitlines()
        field_lines = [l for l in lines if ":" in l and not l.startswith("---")]
        fields = [l.split(":")[0] for l in field_lines]
        self.assertEqual(fields, ["title", "summary", "tags", "deps"])


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


# ---------------------------------------------------------------------------
# Test 7: Attachments column + orphan detection
# ---------------------------------------------------------------------------

class TestAttachmentsColumn(unittest.TestCase):
    """Tests for MANIFEST Attachments column and orphan detection."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _make_workspace(self, files: dict) -> Path:
        """Create a minimal workspace. files = {rel_path: content}."""
        workspace = self.tmp / "ws"
        workspace.mkdir()
        for rel, content in files.items():
            p = workspace / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(content, bytes):
                p.write_bytes(content)
            else:
                p.write_text(content, encoding="utf-8")
        return workspace

    def _run(self, workspace: Path, *args: str) -> types.SimpleNamespace:
        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                code = cli_main(["--workspace", str(workspace)] + list(args))
        except SystemExit as e:
            code = int(e.code) if e.code is not None else 0
        return types.SimpleNamespace(
            returncode=code,
            stdout=stdout_buf.getvalue(),
            stderr=stderr_buf.getvalue(),
        )

    def test_header_has_attachments_column(self):
        """MANIFEST header row includes Attachments column."""
        ws = self._make_workspace({
            "01-docs/00-index.md": "---\ntitle: Docs\n---\n",
            "01-docs/01-intro.md": "---\ntitle: Intro\n---\n",
        })
        result = self._run(ws, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("| Attachments |", result.stdout)

    def test_no_attachments_renders_emdash(self):
        """A doc with no non-md siblings renders — in Attachments column."""
        ws = self._make_workspace({
            "01-docs/00-index.md": "---\ntitle: Docs\n---\n",
            "01-docs/01-intro.md": "---\ntitle: Intro\n---\n",
        })
        result = self._run(ws, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = [l for l in result.stdout.splitlines() if l.startswith("| doc")]
        self.assertTrue(rows, "No doc rows found")
        for row in rows:
            cols = [c.strip() for c in row.split("|")[1:-1]]
            self.assertEqual(len(cols), 7, f"Expected 7 columns in row: {row}")
            self.assertEqual(cols[6], "—", f"Expected — in Attachments: {row}")

    def test_one_attachment_renders_slug_ext(self):
        """A doc with one attachment renders slug+ext without the NN-docslug. prefix."""
        ws = self._make_workspace({
            "01-docs/00-index.md": "---\ntitle: Docs\n---\n",
            "01-docs/01-game.md": "---\ntitle: Game\n---\n",
            "01-docs/01-game.xstate.json": "{}",
        })
        result = self._run(ws, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = [l for l in result.stdout.splitlines() if "doc01.01" in l]
        self.assertEqual(len(rows), 1, f"Expected 1 row for doc01.01, got: {rows}")
        cols = [c.strip() for c in rows[0].split("|")[1:-1]]
        self.assertEqual(cols[6], "xstate.json")

    def test_multiple_attachments_sorted(self):
        """A doc with multiple attachments renders a sorted comma-separated list."""
        ws = self._make_workspace({
            "01-docs/00-index.md": "---\ntitle: Docs\n---\n",
            "01-docs/01-spec.md": "---\ntitle: Spec\n---\n",
            "01-docs/01-spec.schema.json": "{}",
            "01-docs/01-spec.mockup.png": b"\x89PNG",
            "01-docs/01-spec.rules.yaml": "key: value",
        })
        result = self._run(ws, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = [l for l in result.stdout.splitlines() if "doc01.01" in l]
        self.assertEqual(len(rows), 1)
        cols = [c.strip() for c in rows[0].split("|")[1:-1]]
        self.assertEqual(cols[6], "mockup.png, rules.yaml, schema.json")

    def test_index_with_00_attachment(self):
        """00-index.md with a 00-foo.png sibling renders foo.png in Attachments."""
        ws = self._make_workspace({
            "01-docs/00-index.md": "---\ntitle: Docs\n---\n",
            "01-docs/00-overview.png": b"\x89PNG",
        })
        result = self._run(ws, "regenerate", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = [l for l in result.stdout.splitlines() if "doc01.00" in l]
        self.assertEqual(len(rows), 1, f"Expected row for doc01.00:\n{result.stdout}")
        cols = [c.strip() for c in rows[0].split("|")[1:-1]]
        self.assertEqual(cols[6], "overview.png")

    def test_orphan_warning_to_stderr(self):
        """Orphan file (no root .md) prints warning to stderr; MANIFEST is still written."""
        ws = self._make_workspace({
            "01-docs/00-index.md": "---\ntitle: Docs\n---\n",
            "01-docs/01-legit.md": "---\ntitle: Legit\n---\n",
            "01-docs/03-orphan.json": "{}",  # no 03-*.md → orphan
        })
        result = self._run(ws, "regenerate")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Warning", result.stderr)
        self.assertIn("orphan", result.stderr.lower())
        self.assertIn("03-orphan.json", result.stderr)
        manifest = ws / "MANIFEST.md"
        self.assertTrue(manifest.exists(), "MANIFEST.md not written despite warning")
        content = manifest.read_text(encoding="utf-8")
        self.assertNotIn("03-orphan", content)

    def test_orphan_subdir_conflict(self):
        """File sharing a prefix with a subdir is an orphan; subdir docs still appear."""
        ws = self._make_workspace({
            "01-docs/00-index.md": "---\ntitle: Docs\n---\n",
            "01-docs/03-concepts/00-index.md": "---\ntitle: Concepts\n---\n",
            "01-docs/03-concepts/01-first.md": "---\ntitle: First\n---\n",
            "01-docs/03-stale.yaml": "key: value",  # prefix 03 = subdir → orphan
        })
        result = self._run(ws, "regenerate")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Warning", result.stderr)
        self.assertIn("03-stale.yaml", result.stderr)
        manifest = ws / "MANIFEST.md"
        content = manifest.read_text(encoding="utf-8")
        self.assertIn("doc01.03.01", content)
        self.assertNotIn("03-stale", content)


if __name__ == "__main__":
    unittest.main()
