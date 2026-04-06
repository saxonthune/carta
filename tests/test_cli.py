"""Integration tests for the carta CLI toolchain.

Run with:
    python3 -m pytest packages/cli/tests/test_cli.py -v
"""

import json
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
from carta_cli.workspace import find_workspace, MARKER

_ENV_WITH_CLI = {**os.environ, "PYTHONPATH": str(_CLI_DIR)}


def _fm(title: str, status: str = "active", summary: str = "", tags: list[str] | None = None, deps: list[str] | None = None) -> str:
    """Build a minimal frontmatter block."""
    lines = ["---", f"title: {title}", f"status: {status}"]
    if summary:
        lines.append(f"summary: {summary}")
    if tags:
        lines.append(f"tags: [{', '.join(tags)}]")
    if deps:
        lines.append(f"deps: [{', '.join(deps)}]")
    lines.append("---")
    return "\n".join(lines) + "\n"


def _write(path: Path, fm: str, body: str = "") -> None:
    """Write frontmatter + body to path, creating parent dirs."""
    path.parent.mkdir(parents=True, exist_ok=True)
    content = fm + ("\n" + body if body else "")
    path.write_text(content, encoding="utf-8")


def _build_fixture(dest: Path) -> Path:
    """Build a synthetic .carta/ workspace for testing. Returns dest/.carta/."""
    carta = dest / ".carta"
    carta.mkdir(parents=True, exist_ok=True)

    # Write .carta.json marker
    (dest / MARKER).write_text(
        json.dumps({"root": ".carta/", "title": "TestFixture"}), encoding="utf-8"
    )

    # 00-codex/ — entries 00-06 (max prefix 06, so create appends at 07)
    _write(carta / "00-codex/00-index.md",
           _fm("Codex", summary="Codex section index.", tags=["index", "meta"]))
    _write(carta / "00-codex/01-about.md",
           _fm("About", summary="Why this workspace exists.", tags=["docs", "meta"]),
           "# About\n\nThis workspace contains documentation.\n")
    _write(carta / "00-codex/02-maintenance.md",
           _fm("Maintenance", summary="Doc lifecycle and versioning.", tags=["docs", "maintenance"]))
    _write(carta / "00-codex/03-conventions.md",
           _fm("Conventions", summary="DocXX.YY syntax and naming.", tags=["docs", "conventions"]))
    _write(carta / "00-codex/04-ai-retrieval.md",
           _fm("AI Retrieval", summary="AI retrieval patterns.", tags=["docs", "ai", "retrieval"]))
    _write(carta / "00-codex/05-taxonomy.md",
           _fm("Taxonomy", summary="Title system rationale.", tags=["docs", "structure"]))
    _write(carta / "00-codex/06-integration.md",
           _fm("Integration", summary="Integration overview.", tags=["docs", "ai"]))

    # 01-product-strategy/ — doc01
    _write(carta / "01-product-strategy/00-index.md",
           _fm("Product Strategy", summary="Product strategy index.", tags=["index", "strategy"]))
    _write(carta / "01-product-strategy/01-mission.md",
           _fm("Mission", summary="Core goal.", tags=["mission", "principles"], deps=["doc01.02"]))
    _write(carta / "01-product-strategy/02-principles.md",
           _fm("Principles", summary="Design principles.", tags=["principles", "design"]))
    _write(carta / "01-product-strategy/03-glossary.md",
           _fm("Glossary", summary="Canonical vocabulary.", tags=["glossary", "terms"], deps=["doc01.02"]))

    # 01-product-strategy/04-primary-sources/ — doc01.04
    _write(carta / "01-product-strategy/04-primary-sources/00-index.md",
           _fm("Primary Sources", summary="Author's original writings.", tags=["inspiration", "vision"]))
    _write(carta / "01-product-strategy/04-primary-sources/01-experiment.md",
           _fm("The Carta Experiment", summary="Artifact-driven development.", tags=["AI", "coding"]))
    _write(carta / "01-product-strategy/04-primary-sources/02-foundations.md",
           _fm("Theoretical Foundations", summary="Why spec-driven development works.", tags=["spec-driven", "AI"]))
    _write(carta / "01-product-strategy/04-primary-sources/03-unfolding.md",
           _fm("Unfolding as Development", summary="Embryonic development applied to software.", tags=["unfolding", "methodology"]))

    # 02-product-design/ — doc02
    _write(carta / "02-product-design/00-index.md",
           _fm("Product Design", summary="Product design index.", tags=["index", "design"]))
    _write(carta / "02-product-design/01-workspace-scripts.md",
           _fm("Workspace Scripts", summary="Design details for the Carta Docs API.", tags=["docs-api", "workspace", "tools"]))
    _write(carta / "02-product-design/02-cli-flow.md",
           _fm("CLI User Flow", summary="How users install the carta CLI.", tags=["cli", "workflow"]))
    _write(carta / "02-product-design/03-extension.md",
           _fm("VSCode Extension", summary="Canvas viewer and workspace browser.", tags=["vscode", "extension"]))

    # 02-product-design/04-web-platform/ — doc02.04
    _write(carta / "02-product-design/04-web-platform/00-index.md",
           _fm("Web Platform", summary="Web client for nontechnical spec editing.", tags=["web", "server"]),
           "# Web Platform\n\nThis section covers the web platform.\n")
    _write(carta / "02-product-design/04-web-platform/01-conversational.md",
           _fm("Conversational Flow", summary="AI-heavy interaction flavor.", tags=["web", "ai"]))
    _write(carta / "02-product-design/04-web-platform/02-direct-editing.md",
           _fm("Direct Editing Flow", summary="Editor-heavy interaction flavor.", tags=["web", "editor"]))

    _write(carta / "02-product-design/05-metamodel.md",
           _fm("Metamodel", summary="M2/M1/M0 metamodel.", tags=["metamodel", "schemas"], deps=["doc01.02"]))
    _write(carta / "02-product-design/06-presentation.md",
           _fm("Presentation Model", summary="Presentation model and organizers.", tags=["presentation", "layout"]))
    _write(carta / "02-product-design/07-glossary.md",
           _fm("Canvas Glossary", summary="Canvas-specific vocabulary.", tags=["glossary", "canvas"]))

    # 02-product-design/08-decisions/ — doc02.08 (index must have >10 body content lines)
    decisions_body = (
        "# Decisions\n\n"
        "Architecture Decision Records for the product design system.\n\n"
        "## Overview\n\n"
        "Each ADR captures a key architectural decision, its context, and consequences.\n\n"
        "## List\n\n"
        "- ADR 01: YJS State\n"
        "- ADR 02: Port Polarity\n"
        "- ADR 03: Output Formatter Registry\n"
        "- ADR 04: Unified Deployment\n"
        "- ADR 05: Presentation Model Organizers\n"
        "- ADR 06: YJS Authoritative Layout\n"
    )
    _write(carta / "02-product-design/08-decisions/00-index.md",
           _fm("Decisions", summary="Architecture Decision Records.", tags=["index", "adr", "decisions"]),
           decisions_body)
    _write(carta / "02-product-design/08-decisions/01-yjs-state.md",
           _fm("YJS State", summary="ADR: Yjs as single state store.", tags=["adr", "yjs", "state"]))
    _write(carta / "02-product-design/08-decisions/02-port-polarity.md",
           _fm("Port Polarity", summary="ADR: five-value polarity model.", tags=["adr", "ports"]))
    _write(carta / "02-product-design/08-decisions/03-formatters.md",
           _fm("Formatters", summary="ADR: extensible formatter registry.", tags=["adr", "compiler"]))

    # 03-architecture/ — doc03
    _write(carta / "03-architecture/00-index.md",
           _fm("Architecture", summary="Architecture section index.", tags=["index", "architecture"]))
    _write(carta / "03-architecture/01-overview.md",
           _fm("Overview", summary="Layer architecture and data flow.", tags=["architecture", "packages"]))
    _write(carta / "03-architecture/02-script-pipeline.md",
           _fm("Script Pipeline", summary="Architecture for spec-code reconciliation.", tags=["reconciliation", "architecture"]))
    _write(carta / "03-architecture/03-vscode-extension.md",
           _fm("VSCode Extension", summary="Extension architecture.", tags=["vscode", "extension", "architecture"]))
    _write(carta / "03-architecture/04-canvas-state.md",
           _fm("Canvas State", summary="Yjs Y.Doc, state partitioning.", tags=["state", "yjs"]))
    _write(carta / "03-architecture/05-frontend.md",
           _fm("Frontend Architecture", summary="Four-layer component model.", tags=["components", "architecture"]))
    _write(carta / "03-architecture/06-data-pipelines.md",
           _fm("Data Pipelines", summary="Map.tsx memo cascades.", tags=["pipeline", "edges"]))

    # Generate MANIFEST
    result = _run_carta(carta, "regenerate")
    if result.returncode != 0:
        raise RuntimeError(f"fixture regenerate failed:\n{result.stderr}")

    return carta


def _run_carta(carta_copy: Path, *args: str) -> subprocess.CompletedProcess:
    """Run the carta CLI against a workspace copy."""
    return subprocess.run(
        [sys.executable, "-m", "carta_cli.main", "--workspace", str(carta_copy)] + list(args),
        capture_output=True, text=True, env=_ENV_WITH_CLI,
    )


class TestFindWorkspace(unittest.TestCase):
    """Tests for find_workspace() via .carta.json marker."""

    def test_discovers_workspace_via_marker(self):
        """find_workspace() discovers docs dir from .carta.json root field."""
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_dir = Path(tmpdir) / ".docs"
            docs_dir.mkdir()
            marker = Path(tmpdir) / MARKER
            marker.write_text(json.dumps({"root": ".docs/"}))
            old_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                result = find_workspace()
                self.assertEqual(result.name, ".docs")
                self.assertTrue(result.is_dir())
            finally:
                os.chdir(old_cwd)

    def test_default_root_is_carta(self):
        """find_workspace() defaults to .carta/ when root is omitted."""
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_dir = Path(tmpdir) / ".carta"
            docs_dir.mkdir()
            marker = Path(tmpdir) / MARKER
            marker.write_text(json.dumps({"title": "test"}))
            old_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                result = find_workspace()
                self.assertEqual(result.name, ".carta")
            finally:
                os.chdir(old_cwd)

    def test_errors_when_no_marker(self):
        """find_workspace() errors when no .carta.json exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            old_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                with self.assertRaises(FileNotFoundError) as ctx:
                    find_workspace()
                self.assertIn(MARKER, str(ctx.exception))
            finally:
                os.chdir(old_cwd)

    def test_errors_when_root_dir_missing(self):
        """find_workspace() errors when root dir from marker doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            marker = Path(tmpdir) / MARKER
            marker.write_text(json.dumps({"root": ".nonexistent/"}))
            old_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                with self.assertRaises(FileNotFoundError) as ctx:
                    find_workspace()
                self.assertIn(".nonexistent/", str(ctx.exception))
            finally:
                os.chdir(old_cwd)


class TestInitDir(unittest.TestCase):
    """Tests for carta init --dir."""

    def test_init_custom_dir(self):
        """carta init --dir .docs creates .carta.json at root with correct root field."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                [sys.executable, "-m", "carta_cli.main", "init", "--dir", ".docs", "--name", "TestProject"],
                capture_output=True, text=True, env=_ENV_WITH_CLI, cwd=tmpdir,
            )
            self.assertEqual(result.returncode, 0, f"init failed:\n{result.stderr}\n{result.stdout}")

            # .carta.json at project root
            marker_path = Path(tmpdir) / MARKER
            self.assertTrue(marker_path.exists(), f"{MARKER} should exist at project root")
            marker_data = json.loads(marker_path.read_text())
            self.assertEqual(marker_data["root"], ".docs/")
            self.assertEqual(marker_data["title"], "TestProject")

            # Docs directory created
            docs_dir = Path(tmpdir) / ".docs"
            self.assertTrue((docs_dir / "MANIFEST.md").exists())
            self.assertTrue((docs_dir / "00-codex" / "00-index.md").exists())

            manifest = (docs_dir / "MANIFEST.md").read_text(encoding="utf-8")
            self.assertTrue(manifest.startswith("# .docs/ Manifest"),
                            f"MANIFEST header should use .docs/: {manifest[:50]}")

    def test_init_default_dir(self):
        """carta init with no --dir creates .carta/ and .carta.json with root=.carta/."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                [sys.executable, "-m", "carta_cli.main", "init", "--name", "DefaultTest"],
                capture_output=True, text=True, env=_ENV_WITH_CLI, cwd=tmpdir,
            )
            self.assertEqual(result.returncode, 0, f"init failed:\n{result.stderr}\n{result.stdout}")

            marker_path = Path(tmpdir) / MARKER
            self.assertTrue(marker_path.exists())
            marker_data = json.loads(marker_path.read_text())
            self.assertEqual(marker_data["root"], ".carta/")

    def test_init_refuses_existing(self):
        """carta init refuses when .carta.json already exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create marker first
            (Path(tmpdir) / MARKER).write_text("{}")
            result = subprocess.run(
                [sys.executable, "-m", "carta_cli.main", "init"],
                capture_output=True, text=True, env=_ENV_WITH_CLI, cwd=tmpdir,
            )
            self.assertEqual(result.returncode, 0)
            self.assertIn("already exists", result.stdout)


class TestRefToPath(unittest.TestCase):
    """Tests for ref_to_path and path_to_ref."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

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
        known_refs = ["doc02.01", "doc00.01", "doc01.04.01", "doc02.04"]
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
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

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
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_actual_move_doc00_04_to_doc01(self):
        """Move doc00.04 (04-ai-retrieval.md) into doc01 (01-product-strategy/)."""
        # Collect pre-existing orphaned refs (to avoid false positives)
        pre_existing_orphans = set(
            ref for _, ref in self._collect_orphaned_refs(self.carta_copy)
        )

        # Before: source exists
        source = self.carta_copy / "00-codex" / "04-ai-retrieval.md"
        self.assertTrue(source.exists(), "Source must exist before move")

        result = _run_carta(self.carta_copy, "move", "doc00.04", "doc01")
        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}\n{result.stdout}")

        # Source no longer exists at old location
        self.assertFalse(source.exists(), "Source should not exist at old location")

        # File exists at new location (appended to 01-product/)
        dest_dir = self.carta_copy / "01-product-strategy"
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
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_move_later_entry_to_first(self):
        """Moving a later entry to position 1 should not leave gaps."""
        # 03-architecture -> position 1
        result = _run_carta(self.carta_copy, "move", "03-architecture", ".", "--order", "1")
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

        result = _run_carta(self.carta_copy, "move", "01-product-strategy", ".", "--order", str(max_prefix))
        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}\n{result.stdout}")

        entries = sorted(
            e.name for e in self.carta_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in entries]
        self.assertEqual(prefixes, list(range(prefixes[0], prefixes[0] + len(prefixes))),
                         f"Expected no gaps in numbering: {entries}")
        # Product is last
        self.assertTrue("product-strategy" in entries[-1],
                         f"Expected product-strategy at last position: {entries[-1]}")


class TestCrossSiblingMove(unittest.TestCase):
    """Test cross-sibling moves where dest gets gap-closed (Bug 1 fix)."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

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

    def test_move_product_into_sibling_design(self):
        """Move 01-product-strategy into 02-product-design (dest gets gap-closed)."""
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

        # Product-design dir (gap-closed from 02 to 01)
        design_dir = None
        for e in self.carta_copy.iterdir():
            if "product-design" in e.name:
                design_dir = e
                break
        self.assertIsNotNone(design_dir, "Product-design directory not found")

        product_entries = [e for e in design_dir.iterdir() if "product-strategy" in e.name]
        self.assertEqual(len(product_entries), 1,
                         f"Expected product-strategy inside product-design: {list(design_dir.iterdir())}")
        self.assertTrue(product_entries[0].name.startswith("01-"),
                         f"Product-strategy should be at position 01: {product_entries[0].name}")

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
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_rename_in_place(self):
        """--rename with same dir should only change the slug."""
        # Rename 01-product-strategy → 01-diagramming (same position)
        result = _run_carta(self.carta_copy, "move", "01-product-strategy", ".", "--rename", "diagramming")
        assert result.returncode == 0, result.stderr
        entries = [e.name for e in self.carta_copy.iterdir() if re.match(r'^\d{2}-', e.name)]
        assert any("diagramming" in e for e in entries), f"Expected diagramming in {entries}"
        assert not any("product-strategy" in e for e in entries), f"product-strategy should be renamed: {entries}"

    def test_rename_with_move(self):
        """--rename combined with a destination should move and rename."""
        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01", "--rename", "retrieval-patterns")
        assert result.returncode == 0, result.stderr
        dest_dir = self.carta_copy / "01-product-strategy"
        new_files = [e.name for e in dest_dir.iterdir() if "retrieval-patterns" in e.name]
        assert len(new_files) == 1, f"Expected retrieval-patterns in dest: {list(dest_dir.iterdir())}"

    def test_rename_dry_run(self):
        """--rename --dry-run should not modify files."""
        before = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                  if p.is_file() and p.suffix in (".md", ".json", "")}
        result = _run_carta(self.carta_copy, "move", "01-product-strategy", ".", "--rename", "diagramming", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                 if p.is_file() and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"


class TestPunch(unittest.TestCase):
    """Test punch command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

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

    def test_punch_as_child(self):
        """--as-child puts original content in 01-slug.md and generates skeleton index."""
        codex = self.carta_copy / "00-codex"
        leaf = codex / "01-about.md"
        assert leaf.exists(), f"Expected leaf file: {leaf}"
        original_content = leaf.read_text(encoding="utf-8")

        result = _run_carta(self.carta_copy, "punch", "doc00.01", "--as-child")
        assert result.returncode == 0, f"punch --as-child failed:\n{result.stderr}"

        # Original file should be gone
        assert not leaf.exists(), "Original file should not exist after punch --as-child"

        new_dir = codex / "01-about"
        assert new_dir.is_dir(), f"Expected directory: {new_dir}"

        # 01-about.md inside the dir should have the original content
        child = new_dir / "01-about.md"
        assert child.exists(), f"Expected child file: {child}"
        assert child.read_text(encoding="utf-8") == original_content

        # 00-index.md should be a skeleton, not the original content
        index = new_dir / "00-index.md"
        assert index.exists(), f"Expected 00-index.md in {new_dir}"
        index_text = index.read_text(encoding="utf-8")
        assert index_text != original_content, "Index should be a skeleton, not the original content"
        assert index_text.startswith("---"), "Index should have frontmatter"
        assert "title:" in index_text
        assert "status: draft" in index_text
        assert "# About" in index_text

    def test_punch_as_child_dry_run(self):
        """--as-child --dry-run should not modify any files."""
        codex = self.carta_copy / "00-codex"
        leaf = codex / "01-about.md"
        assert leaf.exists(), f"Expected leaf file: {leaf}"
        before_content = leaf.read_bytes()

        result = _run_carta(self.carta_copy, "punch", "doc00.01", "--as-child", "--dry-run")
        assert result.returncode == 0, result.stderr

        # File should still exist unchanged
        assert leaf.exists(), "Original file should still exist after dry-run"
        assert leaf.read_bytes() == before_content, "File content should be unchanged after dry-run"

        # No directory should have been created
        new_dir = codex / "01-about"
        assert not new_dir.exists(), "Directory should not exist after dry-run"


class TestFlatten(unittest.TestCase):
    """Test flatten command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_flatten_basic(self):
        """Flatten a directory with children into its parent."""
        # Use doc02.08 (08-decisions/) — it has multiple children
        decisions_dir = self.carta_copy / "02-product-design" / "08-decisions"
        assert decisions_dir.is_dir()
        children_before = list_numbered_entries(decisions_dir)
        # Exclude 00-index.md from count
        num_children = len([c for c in children_before if c.name != "00-index.md"])

        result = _run_carta(self.carta_copy, "flatten", "doc02.08", "--force")
        assert result.returncode == 0, f"flatten failed:\n{result.stderr}\n{result.stdout}"

        # Source dir should be gone
        assert not decisions_dir.exists(), "Source directory should be removed"

        # Children should be in parent (02-product-design/)
        system_dir = self.carta_copy / "02-product-design"
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
        result = _run_carta(self.carta_copy, "flatten", "doc02.08", "--force", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.carta_copy.rglob("*")
                 if p.is_file()
                 and p.suffix in (".md", ".json", "")}
        assert before == after

    def test_flatten_refuses_big_index(self):
        """Flatten should refuse if 00-index.md has >10 content lines without --force."""
        result = _run_carta(self.carta_copy, "flatten", "doc02.08")  # no --force, no --keep-index
        # If the index has >10 lines, this should fail
        if result.returncode != 0:
            assert "content lines" in result.stderr.lower() or "index" in result.stderr.lower()

    def test_flatten_keep_index(self):
        """--keep-index should preserve the index as a numbered file with parent slug."""
        # Use doc01.04 (04-primary-sources/) which has a 00-index.md and numbered children
        sources_dir = self.carta_copy / "01-product-strategy" / "04-primary-sources"
        assert sources_dir.is_dir(), f"Expected 04-primary-sources/ dir: {sources_dir}"
        assert (sources_dir / "00-index.md").exists(), "Expected 00-index.md in 04-primary-sources/"

        result = _run_carta(self.carta_copy, "flatten", "doc01.04", "--keep-index")
        assert result.returncode == 0, f"flatten failed:\n{result.stderr}\n{result.stdout}"

        # Look for a file with "primary-sources" slug in 01-product-strategy/
        product_dir = self.carta_copy / "01-product-strategy"
        sources_files = [e for e in product_dir.iterdir()
                         if "primary-sources" in e.name and e.is_file()]
        assert len(sources_files) == 1, (
            f"Expected demoted index with 'primary-sources' slug: {[e.name for e in product_dir.iterdir()]}"
        )
        # Content is preserved
        demoted_content = sources_files[0].read_text(encoding="utf-8")
        assert len(demoted_content) > 0, "Demoted index should not be empty"

    def test_flatten_no_orphaned_refs(self):
        """Flatten should not introduce orphaned refs."""
        pre_existing = set(
            ref for _, ref in self._collect_orphaned_refs(self.carta_copy)
        )

        result = _run_carta(self.carta_copy, "flatten", "doc02.08", "--force")
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
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

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
        # Delete doc02.08 (08-decisions/)
        design = self.carta_copy / "02-product-design"
        target = design / "08-decisions"
        assert target.is_dir()

        result = _run_carta(self.carta_copy, "delete", "doc02.08")
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
        # doc01.02 (principles) is referenced by many docs in deps
        result = _run_carta(self.carta_copy, "delete", "doc01.02", "--dry-run")
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
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

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

    def test_create_with_frontmatter_flags(self):
        """--summary, --tags, --deps populate frontmatter."""
        result = _run_carta(
            self.carta_copy, "create", "doc00", "full-meta",
            "--title", "Full Meta",
            "--summary", "A test summary",
            "--tags", "alpha,beta,gamma",
            "--deps", "doc00.01,doc00.02",
        )
        assert result.returncode == 0, f"create failed:\n{result.stderr}\n{result.stdout}"

        codex = self.carta_copy / "00-codex"
        created = [e for e in codex.iterdir() if "full-meta" in e.name]
        assert len(created) == 1

        from carta_cli.frontmatter import read_frontmatter
        fm, _ = read_frontmatter(created[0])
        assert fm["summary"] == "A test summary"
        assert fm["tags"] == ["alpha", "beta", "gamma"]
        assert fm["deps"] == ["doc00.01", "doc00.02"]

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
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_mkdir_creates_destination(self):
        """Move with --mkdir to nonexistent path creates dir with 00-index.md."""
        # Create a new dir path under an existing section
        new_dir = "03-architecture/99-new-section"
        result = _run_carta(self.carta_copy, "move", "doc03.01", new_dir, "--mkdir")
        assert result.returncode == 0, f"move --mkdir failed:\n{result.stderr}\n{result.stdout}"

        # The dir may have been renumbered by gap-closing, so look for "new-section" by slug
        system = self.carta_copy / "03-architecture"
        new_section_dirs = [e for e in system.iterdir() if "new-section" in e.name and e.is_dir()]
        assert len(new_section_dirs) == 1, f"Expected new-section dir: {[e.name for e in system.iterdir()]}"

        dest = new_section_dirs[0]
        assert (dest / "00-index.md").exists(), "00-index.md should be created"

        # Source should be moved into the new dir
        moved = [e for e in dest.iterdir() if "overview" in e.name]
        assert len(moved) == 1, f"Expected overview in new dir: {list(dest.iterdir())}"

    def test_mkdir_dry_run(self):
        """--mkdir --dry-run should not create dirs (but creates+cleans up internally)."""
        new_dir = "03-architecture/99-new-section"
        before_dirs = set(str(p) for p in self.carta_copy.rglob("*") if p.is_dir())

        result = _run_carta(self.carta_copy, "move", "doc03.06", new_dir, "--mkdir", "--dry-run")
        assert result.returncode == 0, f"move --mkdir --dry-run failed:\n{result.stderr}\n{result.stdout}"

        after_dirs = set(str(p) for p in self.carta_copy.rglob("*") if p.is_dir())
        assert before_dirs == after_dirs, "Directories were created during --dry-run"

    def test_mkdir_existing_dir_noop(self):
        """--mkdir when dest exists works normally (no error, no extra dir)."""
        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01", "--mkdir")
        assert result.returncode == 0, f"move --mkdir failed:\n{result.stderr}\n{result.stdout}"

    def test_move_without_mkdir_still_errors(self):
        """Without --mkdir, moving to nonexistent path should error."""
        result = _run_carta(self.carta_copy, "move", "doc03.06", "03-architecture/99-nonexistent")
        assert result.returncode != 0


class TestVersion(unittest.TestCase):
    """Test --version flag."""

    def test_version_flag(self):
        """carta --version prints the version string."""
        result = subprocess.run(
            [sys.executable, "-m", "carta_cli.main", "--version"],
            capture_output=True, text=True, env=_ENV_WITH_CLI,
        )
        assert result.returncode == 0, f"--version failed:\n{result.stderr}"
        from carta_cli.__version__ import __version__
        assert __version__ in result.stdout


class TestInitPortable(unittest.TestCase):
    """Test carta init --portable."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_init_portable_creates_scripts(self):
        """carta init --portable dumps scripts into .carta/."""
        result = subprocess.run(
            [sys.executable, "-m", "carta_cli.main", "init", "--portable", "--name", "PortableTest"],
            capture_output=True, text=True, env=_ENV_WITH_CLI,
            cwd=str(self.project_root),
        )
        assert result.returncode == 0, f"init --portable failed:\n{result.stderr}\n{result.stdout}"

        carta_dir = self.project_root / ".carta"
        assert (carta_dir / "carta.py").exists(), "carta.py should exist at .carta/ root"
        assert (carta_dir / "_scripts").is_dir(), "_scripts/ directory should exist"
        assert (carta_dir / "_scripts" / "frontmatter.py").exists()
        assert (carta_dir / "_scripts" / "__init__.py").exists()
        assert (carta_dir / "_scripts" / "manifest-preamble.md").exists()

    def test_portable_scripts_execute(self):
        """Portable carta.py can run regenerate."""
        subprocess.run(
            [sys.executable, "-m", "carta_cli.main", "init", "--portable", "--name", "PortableTest"],
            capture_output=True, text=True, env=_ENV_WITH_CLI,
            cwd=str(self.project_root),
        )

        carta_py = self.project_root / ".carta" / "carta.py"
        result = subprocess.run(
            [sys.executable, str(carta_py), "regenerate"],
            capture_output=True, text=True,
            cwd=str(self.project_root),
        )
        assert result.returncode == 0, f"portable regenerate failed:\n{result.stderr}"

    def test_portable_version(self):
        """Portable carta.py --version works."""
        subprocess.run(
            [sys.executable, "-m", "carta_cli.main", "init", "--portable", "--name", "PortableTest"],
            capture_output=True, text=True, env=_ENV_WITH_CLI,
            cwd=str(self.project_root),
        )
        carta_py = self.project_root / ".carta" / "carta.py"
        result = subprocess.run(
            [sys.executable, str(carta_py), "--version"],
            capture_output=True, text=True,
        )
        assert result.returncode == 0
        from carta_cli.__version__ import __version__
        assert __version__ in result.stdout

    def test_carta_json_has_portable_field(self):
        """After --portable, .carta.json has portable field."""
        subprocess.run(
            [sys.executable, "-m", "carta_cli.main", "init", "--portable", "--name", "PortableTest"],
            capture_output=True, text=True, env=_ENV_WITH_CLI,
            cwd=str(self.project_root),
        )
        config = json.loads((self.project_root / ".carta.json").read_text())
        assert "portable" in config
        assert config["portable"] == ".carta/carta.py"


class TestGroupCommand(unittest.TestCase):
    """Tests for `carta group` command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_group_creates_directory(self):
        """carta group creates directory with 00-index.md and correct title."""
        result = _run_carta(self.carta_copy, "group", "05-test-group", "--title", "Test Group")
        self.assertEqual(result.returncode, 0, f"carta group failed:\n{result.stderr}\n{result.stdout}")

        group_dir = self.carta_copy / "05-test-group"
        self.assertTrue(group_dir.is_dir(), "Group directory should exist")
        index_path = group_dir / "00-index.md"
        self.assertTrue(index_path.exists(), "00-index.md should exist")

        content = index_path.read_text(encoding="utf-8")
        self.assertIn("Test Group", content, "Title should be in index content")

    def test_group_errors_on_existing(self):
        """carta group fails if directory already exists and is non-empty."""
        # 01-product-strategy already exists and has contents
        result = _run_carta(self.carta_copy, "group", "01-product-strategy", "--title", "Duplicate")
        self.assertNotEqual(result.returncode, 0, "Should fail on existing non-empty directory")
        self.assertIn("not empty", result.stderr)

    def test_group_succeeds_on_empty_existing_directory(self):
        """carta group succeeds if target directory exists but is empty."""
        empty_dir = self.carta_copy / "05-test-group"
        empty_dir.mkdir()
        result = _run_carta(self.carta_copy, "group", "05-test-group", "--title", "Test Group")
        self.assertEqual(result.returncode, 0, f"carta group should succeed on empty dir:\n{result.stderr}\n{result.stdout}")
        index_path = empty_dir / "00-index.md"
        self.assertTrue(index_path.exists(), "00-index.md should exist")
        content = index_path.read_text(encoding="utf-8")
        self.assertIn("Test Group", content, "Title should be in index content")

    def test_group_errors_on_non_empty_existing_directory(self):
        """carta group fails if target directory exists and is non-empty."""
        non_empty_dir = self.carta_copy / "05-test-group"
        non_empty_dir.mkdir()
        (non_empty_dir / "some-file.md").write_text("content")
        result = _run_carta(self.carta_copy, "group", "05-test-group", "--title", "Test Group")
        self.assertNotEqual(result.returncode, 0, "Should fail on non-empty directory")
        self.assertIn("not empty", result.stderr)

    def test_group_errors_without_prefix(self):
        """carta group fails if directory name has no NN- prefix."""
        result = _run_carta(self.carta_copy, "group", "no-prefix")
        self.assertNotEqual(result.returncode, 0, "Should fail without numeric prefix")
        self.assertIn("NN- prefix", result.stderr)


class TestRenameCommand(unittest.TestCase):
    """Tests for `carta rename` command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_rename_directory(self):
        """carta rename renames a directory slug, keeping its prefix."""
        old_dir = self.carta_copy / "01-product-strategy"
        self.assertTrue(old_dir.exists(), "Source directory must exist before rename")

        result = _run_carta(self.carta_copy, "rename", "01-product-strategy", "product")
        self.assertEqual(result.returncode, 0, f"carta rename failed:\n{result.stderr}\n{result.stdout}")

        new_dir = self.carta_copy / "01-product"
        self.assertFalse(old_dir.exists(), "Old directory should be gone")
        self.assertTrue(new_dir.is_dir(), "New directory should exist")

    def test_rename_file(self):
        """carta rename renames a file slug, keeping its prefix and extension."""
        source_file = self.carta_copy / "00-codex" / "01-about.md"
        self.assertTrue(source_file.exists(), "Source file must exist")

        result = _run_carta(self.carta_copy, "rename", "doc00.01", "about-carta")
        self.assertEqual(result.returncode, 0, f"carta rename failed:\n{result.stderr}\n{result.stdout}")

        new_file = self.carta_copy / "00-codex" / "01-about-carta.md"
        self.assertFalse(source_file.exists(), "Old file should be gone")
        self.assertTrue(new_file.exists(), "New file should exist")

    def test_rename_errors_on_missing(self):
        """carta rename fails if target does not exist."""
        result = _run_carta(self.carta_copy, "rename", "99-nonexistent", "something")
        self.assertNotEqual(result.returncode, 0, "Should fail on missing target")


class TestCatCommand(unittest.TestCase):
    """Tests for `carta cat` command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_cat_file_ref(self):
        """carta cat prints file contents for a doc file ref."""
        result = _run_carta(self.carta_copy, "cat", "doc02.01")
        self.assertEqual(result.returncode, 0, f"carta cat failed:\n{result.stderr}\n{result.stdout}")
        expected = (self.carta_copy / "02-product-design" / "01-workspace-scripts.md").read_text(encoding="utf-8")
        self.assertEqual(result.stdout, expected)

    def test_cat_directory_ref(self):
        """carta cat prints 00-index.md for a directory doc ref."""
        result = _run_carta(self.carta_copy, "cat", "doc02.04")
        self.assertEqual(result.returncode, 0, f"carta cat failed:\n{result.stderr}\n{result.stdout}")
        expected = (self.carta_copy / "02-product-design" / "04-web-platform" / "00-index.md").read_text(encoding="utf-8")
        self.assertEqual(result.stdout, expected)

    def test_cat_nonexistent_ref(self):
        """carta cat fails with non-zero exit and error message for nonexistent ref."""
        result = _run_carta(self.carta_copy, "cat", "doc99.99")
        self.assertNotEqual(result.returncode, 0, "Should fail for nonexistent ref")
        self.assertIn("Error", result.stderr)


class TestMoveNoRegen(unittest.TestCase):
    """Tests for `carta move --no-regen`."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_move_no_regen_skips_manifest_update(self):
        """--no-regen leaves MANIFEST unchanged after move."""
        manifest_path = self.carta_copy / "MANIFEST.md"
        manifest_before = manifest_path.read_text(encoding="utf-8")

        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01", "--no-regen")
        self.assertEqual(result.returncode, 0, f"carta move --no-regen failed:\n{result.stderr}")

        manifest_after = manifest_path.read_text(encoding="utf-8")
        self.assertEqual(manifest_before, manifest_after, "MANIFEST should be unchanged with --no-regen")

    def test_regenerate_works_after_no_regen_move(self):
        """After --no-regen move, carta regenerate succeeds."""
        _run_carta(self.carta_copy, "move", "doc00.05", "doc01", "--no-regen")
        result = _run_carta(self.carta_copy, "regenerate")
        self.assertEqual(result.returncode, 0, f"regenerate after --no-regen failed:\n{result.stderr}")


class TestHelpAi(unittest.TestCase):
    """Tests for `carta --help-ai` (deprecated) and `carta ai-skill`."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_help_ai_prints_deprecation_notice(self):
        """--help-ai prints a deprecation notice pointing to ai-skill."""
        result = _run_carta(self.carta_copy, "--help-ai")
        self.assertEqual(result.returncode, 0, f"--help-ai failed:\n{result.stderr}")
        self.assertIn("carta ai-skill", result.stdout)
        self.assertIn("Deprecated", result.stdout)

    def test_ai_skill_lists_all_commands(self):
        """ai-skill lists all commands with usage and side effects."""
        result = _run_carta(self.carta_copy, "ai-skill")
        self.assertEqual(result.returncode, 0, f"carta ai-skill failed:\n{result.stderr}")

        expected_commands = [
            "create", "delete", "move", "group", "rename",
            "punch", "flatten", "copy", "rewrite", "regenerate",
            "init", "portable", "ai-skill",
        ]
        for cmd in expected_commands:
            self.assertIn(f"### {cmd}", result.stdout, f"Command '{cmd}' missing from ai-skill output")

    def test_ai_skill_includes_behavioral_rules(self):
        """ai-skill output includes behavioral rules section."""
        result = _run_carta(self.carta_copy, "ai-skill")
        self.assertEqual(result.returncode, 0)
        self.assertIn("## 2. Behavioral Rules", result.stdout)
        self.assertIn("Gap-closing", result.stdout)

    def test_ai_skill_includes_workspace_state(self):
        """ai-skill output includes workspace state section."""
        result = _run_carta(self.carta_copy, "ai-skill")
        self.assertEqual(result.returncode, 0)
        self.assertIn("## 4. Workspace State", result.stdout)


class TestExistingCommandsUnified(unittest.TestCase):
    """Smoke tests to verify existing commands still work after unification."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_create_works(self):
        """carta create still works after unification."""
        result = _run_carta(self.carta_copy, "create", "00-codex", "my-unified-doc",
                            "--title", "Unified Doc")
        self.assertEqual(result.returncode, 0, f"carta create failed:\n{result.stderr}\n{result.stdout}")
        self.assertTrue((self.carta_copy / "00-codex" / "07-my-unified-doc.md").exists()
                        or any((self.carta_copy / "00-codex").glob("*my-unified-doc*")),
                        "Created doc should exist")

    def test_delete_works(self):
        """carta delete still works after unification."""
        result = _run_carta(self.carta_copy, "delete", "doc00.05")
        self.assertEqual(result.returncode, 0, f"carta delete failed:\n{result.stderr}\n{result.stdout}")
        self.assertFalse((self.carta_copy / "00-codex" / "05-ai-retrieval.md").exists(),
                         "Deleted file should not exist")

    def test_move_works(self):
        """carta move still works after unification."""
        result = _run_carta(self.carta_copy, "move", "doc00.05", "doc01")
        self.assertEqual(result.returncode, 0, f"carta move failed:\n{result.stderr}\n{result.stdout}")
        self.assertFalse((self.carta_copy / "00-codex" / "05-ai-retrieval.md").exists(),
                         "Source should have moved")


class TestNoGapClose(unittest.TestCase):
    """Test --no-gap-close flag: source siblings keep their original numbers."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.carta_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_no_gap_close_preserves_source_siblings(self):
        """Moving with --no-gap-close should NOT renumber source siblings."""
        # Move 01-about.md from 00-codex/ to 01-product-strategy/
        # Without --no-gap-close: 02-maintenance -> 01-maintenance, etc.
        # With --no-gap-close: siblings keep their original numbers
        result = _run_carta(
            self.carta_copy,
            "move", "00-codex/01-about.md", "01-product-strategy",
            "--no-gap-close", "--no-regen",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

        codex = self.carta_copy / "00-codex"
        names = sorted(p.name for p in codex.iterdir())
        # 01-about.md is gone
        self.assertFalse((codex / "01-about.md").exists(), "Source should have moved")
        # 02-maintenance.md should NOT be renamed to 01-maintenance.md
        self.assertTrue(any(n.startswith("02-") for n in names),
                        f"Expected 02- prefix preserved, got: {names}")

    def test_no_gap_close_enables_sequential_moves(self):
        """Second move should succeed because first move left original paths intact."""
        # Move 01-about.md first
        result1 = _run_carta(
            self.carta_copy,
            "move", "00-codex/01-about.md", "01-product-strategy",
            "--no-gap-close", "--no-regen",
        )
        self.assertEqual(result1.returncode, 0, result1.stderr)

        # Now move 02-maintenance.md (still at its original path)
        result2 = _run_carta(
            self.carta_copy,
            "move", "00-codex/02-maintenance.md", "01-product-strategy",
            "--no-gap-close", "--no-regen",
        )
        self.assertEqual(result2.returncode, 0, result2.stderr)

        # Both files should be gone from codex
        codex = self.carta_copy / "00-codex"
        self.assertFalse((codex / "01-about.md").exists(), "01-about.md should have moved")
        self.assertFalse((codex / "02-maintenance.md").exists(), "02-maintenance.md should have moved")

    def test_default_still_gap_closes(self):
        """Without --no-gap-close, source siblings are still renumbered (default behavior)."""
        result = _run_carta(
            self.carta_copy,
            "move", "00-codex/01-about.md", "01-product-strategy",
            "--no-regen",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

        codex = self.carta_copy / "00-codex"
        # Gap should be closed: 02-maintenance should now be 01-maintenance
        self.assertFalse((codex / "02-maintenance.md").exists(),
                         "02-maintenance.md should have been renumbered to 01-")
        self.assertTrue((codex / "01-maintenance.md").exists(),
                        "01-maintenance.md should exist after gap-close")


if __name__ == "__main__":
    unittest.main()
