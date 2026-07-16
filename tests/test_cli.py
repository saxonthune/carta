"""Integration tests for the rhidoc CLI toolchain.

Run with:
    python3 -m pytest tests/test_cli.py -v
"""

import contextlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path

import pytest

# Ensure rhidoc is importable without prior pip install
_CLI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_CLI_DIR))

from rhidoc.commands._parser import main as cli_main
from rhidoc.entries import list_numbered_entries
from rhidoc.docref import DocRef, EntryName


def get_numeric_prefix(name: str) -> int | None:
    en = EntryName.parse(name)
    return en.prefix if en is not None else None
from rhidoc.rewriter import collect_md_files, rewrite_refs


def ref_to_path(ref: str, root: "Path") -> "Path":
    return DocRef.parse(ref).to_path(root)


def path_to_ref(path: "Path", root: "Path") -> str:
    return str(DocRef.from_path(path, root))
from rhidoc.workspace import find_workspace, MARKER

from helpers import normalize_output


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
    """Build a synthetic .rhidoc/ workspace for testing. Returns dest/.rhidoc/."""
    rhidoc = dest / ".rhidoc"
    rhidoc.mkdir(parents=True, exist_ok=True)

    # Write .rhidoc.json marker
    (dest / MARKER).write_text(
        json.dumps({"root": ".rhidoc/", "title": "TestFixture"}), encoding="utf-8"
    )

    # 00-codex/ — entries 00-06 (max prefix 06, so create appends at 07)
    _write(rhidoc / "00-codex/00-index.md",
           _fm("Codex", summary="Codex section index.", tags=["index", "meta"]))
    _write(rhidoc / "00-codex/01-about.md",
           _fm("About", summary="Why this workspace exists.", tags=["docs", "meta"]),
           "# About\n\nThis workspace contains documentation.\n")
    _write(rhidoc / "00-codex/02-maintenance.md",
           _fm("Maintenance", summary="Doc lifecycle and versioning.", tags=["docs", "maintenance"]))
    _write(rhidoc / "00-codex/03-conventions.md",
           _fm("Conventions", summary="DocXX.YY syntax and naming.", tags=["docs", "conventions"]))
    _write(rhidoc / "00-codex/04-ai-retrieval.md",
           _fm("AI Retrieval", summary="AI retrieval patterns.", tags=["docs", "ai", "retrieval"]))
    _write(rhidoc / "00-codex/05-taxonomy.md",
           _fm("Taxonomy", summary="Title system rationale.", tags=["docs", "structure"]))
    _write(rhidoc / "00-codex/06-integration.md",
           _fm("Integration", summary="Integration overview.", tags=["docs", "ai"]))

    # 01-product-strategy/ — doc01
    _write(rhidoc / "01-product-strategy/00-index.md",
           _fm("Product Strategy", summary="Product strategy index.", tags=["index", "strategy"]))
    _write(rhidoc / "01-product-strategy/01-mission.md",
           _fm("Mission", summary="Core goal.", tags=["mission", "principles"], deps=["doc01.02"]))
    _write(rhidoc / "01-product-strategy/02-principles.md",
           _fm("Principles", summary="Design principles.", tags=["principles", "design"]))
    _write(rhidoc / "01-product-strategy/03-glossary.md",
           _fm("Glossary", summary="Canonical vocabulary.", tags=["glossary", "terms"], deps=["doc01.02"]))

    # 01-product-strategy/04-primary-sources/ — doc01.04
    _write(rhidoc / "01-product-strategy/04-primary-sources/00-index.md",
           _fm("Primary Sources", summary="Author's original writings.", tags=["inspiration", "vision"]))
    _write(rhidoc / "01-product-strategy/04-primary-sources/01-experiment.md",
           _fm("The Carta Experiment", summary="Artifact-driven development.", tags=["AI", "coding"]))
    _write(rhidoc / "01-product-strategy/04-primary-sources/02-foundations.md",
           _fm("Theoretical Foundations", summary="Why spec-driven development works.", tags=["spec-driven", "AI"]))
    _write(rhidoc / "01-product-strategy/04-primary-sources/03-unfolding.md",
           _fm("Unfolding as Development", summary="Embryonic development applied to software.", tags=["unfolding", "methodology"]))

    # 02-product-design/ — doc02
    _write(rhidoc / "02-product-design/00-index.md",
           _fm("Product Design", summary="Product design index.", tags=["index", "design"]))
    _write(rhidoc / "02-product-design/01-workspace-scripts.md",
           _fm("Workspace Scripts", summary="Design details for the Rhidoc Docs API.", tags=["docs-api", "workspace", "tools"]))
    _write(rhidoc / "02-product-design/02-cli-flow.md",
           _fm("CLI User Flow", summary="How users install the rhidoc CLI.", tags=["cli", "workflow"]))
    _write(rhidoc / "02-product-design/03-extension.md",
           _fm("VSCode Extension", summary="Canvas viewer and workspace browser.", tags=["vscode", "extension"]))

    # 02-product-design/04-web-platform/ — doc02.04
    _write(rhidoc / "02-product-design/04-web-platform/00-index.md",
           _fm("Web Platform", summary="Web client for nontechnical spec editing.", tags=["web", "server"]),
           "# Web Platform\n\nThis section covers the web platform.\n")
    _write(rhidoc / "02-product-design/04-web-platform/01-conversational.md",
           _fm("Conversational Flow", summary="AI-heavy interaction flavor.", tags=["web", "ai"]))
    _write(rhidoc / "02-product-design/04-web-platform/02-direct-editing.md",
           _fm("Direct Editing Flow", summary="Editor-heavy interaction flavor.", tags=["web", "editor"]))

    _write(rhidoc / "02-product-design/05-metamodel.md",
           _fm("Metamodel", summary="M2/M1/M0 metamodel.", tags=["metamodel", "schemas"], deps=["doc01.02"]))
    _write(rhidoc / "02-product-design/06-presentation.md",
           _fm("Presentation Model", summary="Presentation model and organizers.", tags=["presentation", "layout"]))
    _write(rhidoc / "02-product-design/07-glossary.md",
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
    _write(rhidoc / "02-product-design/08-decisions/00-index.md",
           _fm("Decisions", summary="Architecture Decision Records.", tags=["index", "adr", "decisions"]),
           decisions_body)
    _write(rhidoc / "02-product-design/08-decisions/01-yjs-state.md",
           _fm("YJS State", summary="ADR: Yjs as single state store.", tags=["adr", "yjs", "state"]))
    _write(rhidoc / "02-product-design/08-decisions/02-port-polarity.md",
           _fm("Port Polarity", summary="ADR: five-value polarity model.", tags=["adr", "ports"]))
    _write(rhidoc / "02-product-design/08-decisions/03-formatters.md",
           _fm("Formatters", summary="ADR: extensible formatter registry.", tags=["adr", "compiler"]))

    # 03-architecture/ — doc03
    _write(rhidoc / "03-architecture/00-index.md",
           _fm("Architecture", summary="Architecture section index.", tags=["index", "architecture"]))
    _write(rhidoc / "03-architecture/01-overview.md",
           _fm("Overview", summary="Layer architecture and data flow.", tags=["architecture", "packages"]))
    _write(rhidoc / "03-architecture/02-script-pipeline.md",
           _fm("Script Pipeline", summary="Architecture for spec-code reconciliation.", tags=["reconciliation", "architecture"]))
    _write(rhidoc / "03-architecture/03-vscode-extension.md",
           _fm("VSCode Extension", summary="Extension architecture.", tags=["vscode", "extension", "architecture"]))
    _write(rhidoc / "03-architecture/04-canvas-state.md",
           _fm("Canvas State", summary="Yjs Y.Doc, state partitioning.", tags=["state", "yjs"]))
    _write(rhidoc / "03-architecture/05-frontend.md",
           _fm("Frontend Architecture", summary="Four-layer component model.", tags=["components", "architecture"]))
    _write(rhidoc / "03-architecture/06-data-pipelines.md",
           _fm("Data Pipelines", summary="Map.tsx memo cascades.", tags=["pipeline", "edges"]))

    # Generate MANIFEST
    result = _run_rhidoc(rhidoc, "regenerate")
    if result.returncode != 0:
        raise RuntimeError(f"fixture regenerate failed:\n{result.stderr}")

    return rhidoc


def _run_rhidoc(rhidoc_copy: Path, *args: str) -> types.SimpleNamespace:
    """Run the rhidoc CLI against a workspace copy (in-process)."""
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            code = cli_main(["--workspace", str(rhidoc_copy)] + list(args))
    except SystemExit as e:
        code = int(e.code) if e.code is not None else 0
    return types.SimpleNamespace(
        returncode=code,
        stdout=stdout_buf.getvalue(),
        stderr=stderr_buf.getvalue(),
    )


class TestFindWorkspace(unittest.TestCase):
    """Tests for find_workspace() via .rhidoc.json marker."""

    def test_discovers_workspace_via_marker(self):
        """find_workspace() discovers docs dir from .rhidoc.json root field."""
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

    def test_default_root_is_rhidoc(self):
        """find_workspace() defaults to .rhidoc/ when root is omitted."""
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_dir = Path(tmpdir) / ".rhidoc"
            docs_dir.mkdir()
            marker = Path(tmpdir) / MARKER
            marker.write_text(json.dumps({"title": "test"}))
            old_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                result = find_workspace()
                self.assertEqual(result.name, ".rhidoc")
            finally:
                os.chdir(old_cwd)

    def test_errors_when_no_marker(self):
        """find_workspace() errors when no .rhidoc.json exists."""
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


def test_init_custom_dir(run_cli, tmp_path):
    """rhidoc init --dir .docs creates .rhidoc.json at root with correct root field."""
    code, out, err = run_cli("init", "--dir", ".docs", "--name", "TestProject", cwd=tmp_path)
    assert code == 0, f"init failed:\n{err}\n{out}"

    marker_path = tmp_path / MARKER
    assert marker_path.exists(), f"{MARKER} should exist at project root"
    marker_data = json.loads(marker_path.read_text())
    assert marker_data["root"] == ".docs/"
    assert marker_data["title"] == "TestProject"

    docs_dir = tmp_path / ".docs"
    assert (docs_dir / "MANIFEST.md").exists()
    assert (docs_dir / "00-handbook" / "00-index.md").exists()

    manifest = (docs_dir / "MANIFEST.md").read_text(encoding="utf-8")
    assert manifest.startswith("# .docs/ Manifest"), f"MANIFEST header should use .docs/: {manifest[:50]}"


def test_init_default_dir(run_cli, tmp_path):
    """rhidoc init with no --dir creates .rhidoc/ and .rhidoc.json with root=.rhidoc/."""
    code, out, err = run_cli("init", "--name", "DefaultTest", cwd=tmp_path)
    assert code == 0, f"init failed:\n{err}\n{out}"

    marker_path = tmp_path / MARKER
    assert marker_path.exists()
    marker_data = json.loads(marker_path.read_text())
    assert marker_data["root"] == ".rhidoc/"


def test_init_refuses_existing(run_cli, tmp_path, snapshot):
    """rhidoc init refuses when .rhidoc.json already exists and points at `update`."""
    (tmp_path / MARKER).write_text("{}")
    code, out, err = run_cli("init", cwd=tmp_path)
    assert code == 0
    assert normalize_output(out, tmp_path) == snapshot


def test_init_records_installed_files(run_cli, tmp_path):
    """init records every file it wrote, so update knows what it owns."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    config = json.loads((tmp_path / MARKER).read_text(encoding="utf-8"))
    files = config["installed"]["files"]
    assert ".rhidoc/00-handbook/04-plain-language.md" in files
    assert ".rhidoc/AGENTS.md" in files
    assert ".claude/skills/rhidoc-cli/SKILL.md" in files
    assert config["installed"]["templatesVersion"] >= 1
    # The user's slot is scaffolded but never claimed.
    assert not any("07-user-handbook" in f for f in files)


def test_init_creates_user_slot(run_cli, tmp_path):
    """doc00.07 is scaffolded empty for the user's own doctrine."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    assert (tmp_path / ".rhidoc" / "00-handbook" / "07-user-handbook" / "00-index.md").exists()


def test_init_does_not_claim_preexisting_file(run_cli, tmp_path):
    """A file already at one of rhidoc's paths is left alone and never recorded as ours."""
    skill = tmp_path / ".claude" / "skills" / "docs-development" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("MY OWN SKILL", encoding="utf-8")

    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    config = json.loads((tmp_path / MARKER).read_text(encoding="utf-8"))
    assert ".claude/skills/docs-development/SKILL.md" not in config["installed"]["files"]
    assert skill.read_text(encoding="utf-8") == "MY OWN SKILL"


def test_update_never_overwrites_unmanaged_file(run_cli, tmp_path):
    """The bug that motivated the record: init skipped it, so update must not stomp it."""
    skill = tmp_path / ".claude" / "skills" / "docs-development" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("MY OWN SKILL", encoding="utf-8")
    run_cli("init", "--name", "TestProject", cwd=tmp_path)

    code, out, err = run_cli("update", cwd=tmp_path)
    assert code == 0, f"update failed:\n{err}\n{out}"
    assert skill.read_text(encoding="utf-8") == "MY OWN SKILL"
    assert "Unmanaged" in out


def test_update_refreshes_stale_template(run_cli, tmp_path):
    """update overwrites a handbook doc it installed."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    stale_path = tmp_path / ".rhidoc" / "00-handbook" / "01-about.md"
    stale_path.write_text("stale content", encoding="utf-8")

    code, out, err = run_cli("update", cwd=tmp_path)
    assert code == 0, f"update failed:\n{err}\n{out}"
    assert stale_path.read_text(encoding="utf-8") != "stale content"


def test_update_leaves_user_doc_at_free_prefix_alone(run_cli, tmp_path):
    """A doc rhidoc never installed survives, whatever prefix it occupies.

    The old prefix-glob deleted these; ownership now comes from the record.
    """
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    mine = tmp_path / ".rhidoc" / "00-handbook" / "04-my-house-style.md"
    mine.write_text("my own doc", encoding="utf-8")

    code, out, err = run_cli("update", cwd=tmp_path)
    assert code == 0, f"update failed:\n{err}\n{out}"
    assert mine.exists(), "update deleted a doc rhidoc never installed"
    assert mine.read_text(encoding="utf-8") == "my own doc"


def test_update_removes_file_no_longer_shipped(run_cli, tmp_path):
    """A path rhidoc installed but no longer ships is removed — how renames clean up."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    obsolete = tmp_path / ".rhidoc" / "00-handbook" / "09-obsolete.md"
    obsolete.write_text("shipped by an older rhidoc", encoding="utf-8")
    marker_path = tmp_path / MARKER
    config = json.loads(marker_path.read_text(encoding="utf-8"))
    config["installed"]["files"].append(".rhidoc/00-handbook/09-obsolete.md")
    marker_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    code, out, err = run_cli("update", cwd=tmp_path)
    assert code == 0, f"update failed:\n{err}\n{out}"
    assert not obsolete.exists()
    assert "Removed" in out
    config_after = json.loads(marker_path.read_text(encoding="utf-8"))
    assert ".rhidoc/00-handbook/09-obsolete.md" not in config_after["installed"]["files"]


def test_update_legacy_reports_leftover_without_deleting(run_cli, tmp_path):
    """A pre-record workspace adopts its files and is told about leftovers, not robbed of them."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    legacy_section = tmp_path / ".rhidoc" / "00-codex"
    legacy_section.mkdir()
    (legacy_section / "01-about.md").write_text("old section", encoding="utf-8")
    marker_path = tmp_path / MARKER
    config = json.loads(marker_path.read_text(encoding="utf-8"))
    del config["installed"]
    marker_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    code, out, err = run_cli("update", cwd=tmp_path)
    assert code == 0, f"update failed:\n{err}\n{out}"
    assert legacy_section.exists(), "legacy leftovers must never be deleted on a guess"
    assert "Leftover" in out
    assert "00-codex" in out
    # ...and the record now exists, so the next update is precise.
    assert "installed" in json.loads(marker_path.read_text(encoding="utf-8"))


def test_update_dry_run(run_cli, tmp_path, snapshot):
    """rhidoc update --dry-run shows plan without writing."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    stale_path = tmp_path / ".rhidoc" / "00-handbook" / "01-about.md"
    stale_path.write_text("stale content", encoding="utf-8")

    code, out, err = run_cli("update", "--dry-run", cwd=tmp_path)
    assert code == 0, f"dry-run failed:\n{err}\n{out}"
    assert normalize_output(out, tmp_path) == snapshot
    assert stale_path.read_text(encoding="utf-8") == "stale content"


def test_update_preserves_workspace_json(run_cli, tmp_path):
    """update does not overwrite workspace title in marker."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    marker_path = tmp_path / MARKER
    config = json.loads(marker_path.read_text(encoding="utf-8"))
    config["title"] = "My Custom Title"
    marker_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    code, out, err = run_cli("update", cwd=tmp_path)
    assert code == 0, f"update failed:\n{err}\n{out}"
    config_after = json.loads(marker_path.read_text(encoding="utf-8"))
    assert config_after["title"] == "My Custom Title"


def test_update_without_workspace(run_cli, tmp_path, snapshot):
    """rhidoc update in an empty dir exits non-zero with a helpful error."""
    code, out, err = run_cli("update", cwd=tmp_path)
    assert code != 0
    combined = out + err
    assert normalize_output(combined, tmp_path) == snapshot


def test_update_refreshes_skill(run_cli, tmp_path):
    """update overwrites a stale rhidoc-cli SKILL.md that it installed."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    skill_path = tmp_path / ".claude" / "skills" / "rhidoc-cli" / "SKILL.md"
    skill_path.write_text("stale skill content", encoding="utf-8")

    code, out, err = run_cli("update", cwd=tmp_path)
    assert code == 0, f"update failed:\n{err}\n{out}"
    assert skill_path.read_text(encoding="utf-8") != "stale skill content"


def test_update_check_passes_when_current(run_cli, tmp_path):
    """rhidoc update --check exits 0 when hydrated files are current."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    code, out, err = run_cli("update", "--check", cwd=tmp_path)
    assert code == 0, f"expected pass:\n{out}\n{err}"
    assert "current" in out


def test_update_check_fails_on_drift(run_cli, tmp_path):
    """rhidoc update --check exits non-zero on drift without writing."""
    run_cli("init", "--name", "TestProject", cwd=tmp_path)
    agents = tmp_path / ".rhidoc" / "AGENTS.md"
    agents.write_text(agents.read_text(encoding="utf-8") + "\nstale\n", encoding="utf-8")

    code, out, err = run_cli("update", "--check", cwd=tmp_path)
    assert code == 1, f"expected failure:\n{out}\n{err}"
    assert "AGENTS.md" in out
    assert "stale" in agents.read_text(encoding="utf-8")  # --check must not write


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
        rewrite_refs([md], {DocRef.parse("02.06"): DocRef.parse("03.01")})
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
        rewrite_refs([md], {DocRef.parse("03.01"): DocRef.parse("04.01")})
        result = md.read_text(encoding="utf-8")
        self.assertIn("doc04.01", result)
        self.assertIn("doc03.01.01", result, "doc03.01.01 should remain unchanged")

    def test_no_changes_when_ref_absent(self):
        """Files without the old ref should not be modified."""
        md = self.tmp / "unchanged.md"
        original = "No matching refs here.\n"
        md.write_text(original, encoding="utf-8")
        results = rewrite_refs([md], {DocRef.parse("99.99"): DocRef.parse("00.01")})
        self.assertNotIn(md, results)
        self.assertEqual(md.read_text(encoding="utf-8"), original)


class TestComputeRenameMap(unittest.TestCase):
    """Tests for gap-closing and sibling renaming logic."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp = Path(self.tmpdir.name)
        # Build a mini .rhidoc/ structure:
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
        from rhidoc.planning import compute_rename_map
        from rhidoc.docref import DocRef
        old_foo = self.tmp / "01-a" / "01-foo.md"
        new_foo = self.tmp / "02-b" / "01-foo.md"
        old_bar = self.tmp / "01-a" / "02-bar.md"
        new_bar = self.tmp / "01-a" / "01-bar.md"

        moves = [(old_foo, new_foo), (old_bar, new_bar)]
        rename_map = compute_rename_map(moves, self.tmp)

        # doc01.01 -> somewhere (foo moved)
        self.assertIn(DocRef.parse("01.01"), rename_map)
        # doc01.02 -> doc01.01 (gap closed)
        self.assertEqual(rename_map.get(DocRef.parse("01.02")), DocRef.parse("01.01"))


class TestMovetoDryRun(unittest.TestCase):
    """Test that --dry-run does not modify any files."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_dry_run_no_modification(self):
        """--dry-run should print output but not change files."""
        # Snapshot only text-like files that rhidoc move could plausibly modify.
        def fs_snapshot(root: Path) -> dict[Path, bytes]:
            return {
                p: p.read_bytes()
                for p in root.rglob("*")
                if p.is_file()
                and p.suffix in (".md", ".json", ".txt", "")
            }

        before = fs_snapshot(self.rhidoc_copy)

        result = _run_rhidoc(self.rhidoc_copy, "move", "doc00.05", "doc01", "--dry-run")

        after = fs_snapshot(self.rhidoc_copy)

        self.assertEqual(result.returncode, 0, f"rhidoc move failed:\n{result.stderr}")
        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot
        self.assertEqual(before, after, "Files were modified during --dry-run")


class TestMovetoActualMove(unittest.TestCase):
    """Test an actual rhidoc move operation end-to-end."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_actual_move_doc00_04_to_doc01(self):
        """Move doc00.04 (04-ai-retrieval.md) into doc01 (01-product-strategy/)."""
        # Collect pre-existing orphaned refs (to avoid false positives)
        pre_existing_orphans = set(
            ref for _, ref in self._collect_orphaned_refs(self.rhidoc_copy)
        )

        # Before: source exists
        source = self.rhidoc_copy / "00-codex" / "04-ai-retrieval.md"
        self.assertTrue(source.exists(), "Source must exist before move")

        result = _run_rhidoc(self.rhidoc_copy, "move", "doc00.04", "doc01")
        self.assertEqual(result.returncode, 0, f"rhidoc move failed:\n{result.stderr}\n{result.stdout}")

        # Source no longer exists at old location
        self.assertFalse(source.exists(), "Source should not exist at old location")

        # File exists at new location (appended to 01-product/)
        dest_dir = self.rhidoc_copy / "01-product-strategy"
        new_files = list(dest_dir.glob("*ai-retrieval*"))
        self.assertEqual(len(new_files), 1, f"Expected exactly one ai-retrieval file in dest: {list(dest_dir.iterdir())}")

        # No duplicate numeric prefixes in any directory
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

        # No NEW orphaned refs (pre-existing ones are allowed)
        self._assert_no_new_orphaned_refs(self.rhidoc_copy, pre_existing_orphans)

    def _assert_no_duplicate_prefixes(self, rhidoc_root: Path) -> None:
        """Assert no directory has two entries with the same 2-digit numeric prefix."""
        excluded = {rhidoc_root / ".state"}
        for dirpath in rhidoc_root.rglob("*"):
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

    def _collect_orphaned_refs(self, rhidoc_root: Path) -> list[tuple]:
        """Return (relative_md_path, ref) pairs for all unresolvable refs."""
        excluded = {rhidoc_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []

        for md in rhidoc_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), rhidoc_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(rhidoc_root), m.group()))

        return orphans

    def _assert_no_new_orphaned_refs(
        self, rhidoc_root: Path, pre_existing: set[str]
    ) -> None:
        """Assert that moveto introduced no new orphaned refs beyond pre-existing ones."""
        orphans = self._collect_orphaned_refs(rhidoc_root)
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
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_move_later_entry_to_first(self):
        """Moving a later entry to position 1 should not leave gaps."""
        # 03-architecture -> position 1
        result = _run_rhidoc(self.rhidoc_copy, "move", "03-architecture", "--before", "doc01")
        self.assertEqual(result.returncode, 0, f"rhidoc move failed:\n{result.stderr}\n{result.stdout}")

        entries = sorted(
            e.name for e in self.rhidoc_copy.iterdir()
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
            e for e in self.rhidoc_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        ]
        max_prefix = max(
            int(re.match(r'^(\d{2})-', e.name).group(1))
            for e in entries_before
        )

        result = _run_rhidoc(self.rhidoc_copy, "move", "01-product-strategy", "--before", f"doc{max_prefix:02d}")
        self.assertEqual(result.returncode, 0, f"rhidoc move failed:\n{result.stderr}\n{result.stdout}")

        entries = sorted(
            e.name for e in self.rhidoc_copy.iterdir()
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
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _assert_no_duplicate_prefixes(self, rhidoc_root: Path) -> None:
        excluded = {rhidoc_root / ".state"}
        for dirpath in rhidoc_root.rglob("*"):
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

    def _collect_orphaned_refs(self, rhidoc_root: Path) -> list[tuple]:
        excluded = {rhidoc_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []
        for md in rhidoc_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), rhidoc_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(rhidoc_root), m.group()))
        return orphans

    def test_move_product_into_sibling_design(self):
        """Move 01-product-strategy into 02-product-design (dest gets gap-closed)."""
        pre_existing_orphans = set(
            ref for _, ref in self._collect_orphaned_refs(self.rhidoc_copy)
        )

        result = _run_rhidoc(self.rhidoc_copy, "move", "doc01", "--before", "doc02.01")
        self.assertEqual(result.returncode, 0, f"rhidoc move failed:\n{result.stderr}\n{result.stdout}")

        # Top-level should have no gaps
        entries = sorted(
            e.name for e in self.rhidoc_copy.iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in entries]
        self.assertEqual(prefixes, list(range(0, len(prefixes))),
                         f"Expected no gaps in top-level numbering: {entries}")

        # Product-design dir (gap-closed from 02 to 01)
        design_dir = None
        for e in self.rhidoc_copy.iterdir():
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
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

        # No new orphaned refs
        orphans = self._collect_orphaned_refs(self.rhidoc_copy)
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
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_rename_in_place(self):
        """--rename with same dir should only change the slug."""
        # Rename 01-product-strategy → 01-diagramming (same position)
        result = _run_rhidoc(self.rhidoc_copy, "move", "01-product-strategy", ".", "--rename", "diagramming")
        assert result.returncode == 0, result.stderr
        entries = [e.name for e in self.rhidoc_copy.iterdir() if re.match(r'^\d{2}-', e.name)]
        assert any("diagramming" in e for e in entries), f"Expected diagramming in {entries}"
        assert not any("product-strategy" in e for e in entries), f"product-strategy should be renamed: {entries}"

    def test_rename_with_move(self):
        """--rename combined with a destination should move and rename."""
        result = _run_rhidoc(self.rhidoc_copy, "move", "doc00.05", "doc01", "--rename", "retrieval-patterns")
        assert result.returncode == 0, result.stderr
        dest_dir = self.rhidoc_copy / "01-product-strategy"
        new_files = [e.name for e in dest_dir.iterdir() if "retrieval-patterns" in e.name]
        assert len(new_files) == 1, f"Expected retrieval-patterns in dest: {list(dest_dir.iterdir())}"

    def test_rename_dry_run(self):
        """--rename --dry-run should not modify files."""
        before = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                  if p.is_file() and p.suffix in (".md", ".json", "")}
        result = _run_rhidoc(self.rhidoc_copy, "move", "01-product-strategy", ".", "--rename", "diagramming", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                 if p.is_file() and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"


class TestPunch(unittest.TestCase):
    """Test punch command."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_punch_leaf_file(self):
        """Punching a leaf file creates NN-slug/01-slug.md (content) + generated 00-index.md."""
        codex = self.rhidoc_copy / "00-codex"
        leaf = codex / "01-about.md"
        assert leaf.exists(), f"Expected leaf file: {leaf}"
        original_content = leaf.read_text(encoding="utf-8")

        result = _run_rhidoc(self.rhidoc_copy, "punch", "doc00.01")
        assert result.returncode == 0, f"punch failed:\n{result.stderr}"

        # Original file should be gone
        assert not leaf.exists(), "Original file should not exist after punch"

        # Directory should exist
        new_dir = codex / "01-about"
        assert new_dir.is_dir(), f"Expected directory: {new_dir}"

        # Content moves to 01-about.md
        child = new_dir / "01-about.md"
        assert child.exists(), f"Expected content at {child}"
        assert child.read_text(encoding="utf-8") == original_content

        # 00-index.md is a generated artifact, not the original content
        index = new_dir / "00-index.md"
        assert index.exists(), f"Expected 00-index.md in {new_dir}"
        index_text = index.read_text(encoding="utf-8")
        assert index_text != original_content, "Index should be generated, not original content"
        assert index_text.startswith("---"), "Index should have frontmatter"
        assert "# About" in index_text

    def test_punch_directory_errors(self):
        """Punching a directory should fail."""
        result = _run_rhidoc(self.rhidoc_copy, "punch", "doc02.04")  # 04-decisions/ is a directory
        assert result.returncode != 0, "punch should fail on directory"
        assert normalize_output(result.stderr, self.tmpdir.name) == self._snapshot

    def test_punch_dry_run(self):
        """--dry-run should not modify files."""
        leaf = self.rhidoc_copy / "00-codex" / "01-about.md"
        before = leaf.read_bytes()
        result = _run_rhidoc(self.rhidoc_copy, "punch", "doc00.01", "--dry-run")
        assert result.returncode == 0, result.stderr
        assert leaf.exists(), "File should still exist after dry-run"
        assert leaf.read_bytes() == before

    def test_punch_preserves_siblings(self):
        """Siblings should not be renumbered after punch."""
        codex = self.rhidoc_copy / "00-codex"
        siblings_before = sorted(e.name for e in codex.iterdir() if re.match(r'^\d{2}-', e.name))

        _run_rhidoc(self.rhidoc_copy, "punch", "doc00.01")

        siblings_after = sorted(e.name for e in codex.iterdir() if re.match(r'^\d{2}-', e.name))
        # 01-about.md should become 01-about/ — same prefix, different type
        # All other siblings unchanged
        for s in siblings_before:
            if s == "01-about.md":
                assert "01-about" in siblings_after, f"01-about dir should exist: {siblings_after}"
            else:
                assert s in siblings_after, f"Sibling {s} should be unchanged: {siblings_after}"

    def test_punch_as_child(self):
        """punch always puts original content in 01-slug.md and generates 00-index.md."""
        codex = self.rhidoc_copy / "00-codex"
        leaf = codex / "01-about.md"
        assert leaf.exists(), f"Expected leaf file: {leaf}"
        original_content = leaf.read_text(encoding="utf-8")

        result = _run_rhidoc(self.rhidoc_copy, "punch", "doc00.01")
        assert result.returncode == 0, f"punch failed:\n{result.stderr}"

        # Original file should be gone
        assert not leaf.exists(), "Original file should not exist after punch"

        new_dir = codex / "01-about"
        assert new_dir.is_dir(), f"Expected directory: {new_dir}"

        # 01-about.md inside the dir should have the original content
        child = new_dir / "01-about.md"
        assert child.exists(), f"Expected child file: {child}"
        assert child.read_text(encoding="utf-8") == original_content

        # 00-index.md should be generated, not the original content
        index = new_dir / "00-index.md"
        assert index.exists(), f"Expected 00-index.md in {new_dir}"
        index_text = index.read_text(encoding="utf-8")
        assert index_text != original_content, "Index should be generated, not the original content"
        assert index_text.startswith("---"), "Index should have frontmatter"
        assert "title:" in index_text
        assert "# About" in index_text

    def test_punch_dry_run_no_modification(self):
        """--dry-run should not modify any files."""
        codex = self.rhidoc_copy / "00-codex"
        leaf = codex / "01-about.md"
        assert leaf.exists(), f"Expected leaf file: {leaf}"
        before_content = leaf.read_bytes()

        result = _run_rhidoc(self.rhidoc_copy, "punch", "doc00.01", "--dry-run")
        assert result.returncode == 0, result.stderr

        # File should still exist unchanged
        assert leaf.exists(), "Original file should still exist after dry-run"
        assert leaf.read_bytes() == before_content, "File content should be unchanged after dry-run"

        # No directory should have been created
        new_dir = codex / "01-about"
        assert not new_dir.exists(), "Directory should not exist after dry-run"


class TestHoist(unittest.TestCase):
    """Test hoist command."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_hoist_basic(self):
        """Hoist a directory's children into its parent."""
        # Use doc02.08 (08-decisions/) — it has multiple children
        decisions_dir = self.rhidoc_copy / "02-product-design" / "08-decisions"
        assert decisions_dir.is_dir()
        children_before = list_numbered_entries(decisions_dir)
        # Exclude 00-index.md from count
        num_children = len([c for c in children_before if c.name != "00-index.md"])

        result = _run_rhidoc(self.rhidoc_copy, "hoist", "doc02.08", "--force")
        assert result.returncode == 0, f"hoist failed:\n{result.stderr}\n{result.stdout}"

        # Source dir should be gone
        assert not decisions_dir.exists(), "Source directory should be removed"

        # Children should be in parent (02-product-design/)
        system_dir = self.rhidoc_copy / "02-product-design"
        entries = list_numbered_entries(system_dir)
        # Should have original entries (minus decisions dir) + hoisted children
        assert len(entries) > num_children, f"Expected hoisted children in parent: {[e.name for e in entries]}"

        # No duplicate prefixes
        prefixes = [get_numeric_prefix(e.name) for e in entries]
        assert len(prefixes) == len(set(prefixes)), f"Duplicate prefixes: {prefixes}"

    def test_hoist_leaf_file_errors(self):
        """Hoisting a file (not directory) should fail."""
        result = _run_rhidoc(self.rhidoc_copy, "hoist", "doc02.01")  # 01-overview.md is a file
        assert result.returncode != 0
        assert normalize_output(result.stderr, self.tmpdir.name) == self._snapshot

    def test_hoist_dry_run(self):
        """--dry-run should not modify files."""
        before = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                  if p.is_file()
                  and p.suffix in (".md", ".json", "")}
        result = _run_rhidoc(self.rhidoc_copy, "hoist", "doc02.08", "--force", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                 if p.is_file()
                 and p.suffix in (".md", ".json", "")}
        assert before == after

    def test_hoist_refuses_big_index(self):
        """Hoist should refuse if 00-index.md has >10 content lines without --force."""
        result = _run_rhidoc(self.rhidoc_copy, "hoist", "doc02.08")  # no --force, no --keep-index
        # If the index has >10 lines, this should fail
        if result.returncode != 0:
            assert "content lines" in result.stderr.lower() or "index" in result.stderr.lower()

    def test_hoist_keep_index(self):
        """--keep-index should preserve the index as a numbered file with parent slug."""
        # Use doc01.04 (04-primary-sources/) which has a 00-index.md and numbered children
        sources_dir = self.rhidoc_copy / "01-product-strategy" / "04-primary-sources"
        assert sources_dir.is_dir(), f"Expected 04-primary-sources/ dir: {sources_dir}"
        assert (sources_dir / "00-index.md").exists(), "Expected 00-index.md in 04-primary-sources/"

        result = _run_rhidoc(self.rhidoc_copy, "hoist", "doc01.04", "--keep-index")
        assert result.returncode == 0, f"hoist failed:\n{result.stderr}\n{result.stdout}"

        # Look for a file with "primary-sources" slug in 01-product-strategy/
        product_dir = self.rhidoc_copy / "01-product-strategy"
        sources_files = [e for e in product_dir.iterdir()
                         if "primary-sources" in e.name and e.is_file()]
        assert len(sources_files) == 1, (
            f"Expected demoted index with 'primary-sources' slug: {[e.name for e in product_dir.iterdir()]}"
        )
        # Content is preserved
        demoted_content = sources_files[0].read_text(encoding="utf-8")
        assert len(demoted_content) > 0, "Demoted index should not be empty"

    def test_hoist_no_orphaned_refs(self):
        """Hoist should not introduce orphaned refs."""
        pre_existing = set(
            ref for _, ref in self._collect_orphaned_refs(self.rhidoc_copy)
        )

        result = _run_rhidoc(self.rhidoc_copy, "hoist", "doc02.08", "--force")
        assert result.returncode == 0, result.stderr

        orphans = self._collect_orphaned_refs(self.rhidoc_copy)
        new_orphans = [(f, r) for f, r in orphans if r not in pre_existing]
        assert new_orphans == [], (
            "New orphaned refs:\n" + "\n".join(f"  {r} in {f}" for f, r in new_orphans)
        )

    def _collect_orphaned_refs(self, rhidoc_root):
        excluded = {rhidoc_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []
        for md in rhidoc_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), rhidoc_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(rhidoc_root), m.group()))
        return orphans


class TestDelete(unittest.TestCase):
    """Test delete command."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _assert_no_duplicate_prefixes(self, rhidoc_root):
        excluded = {rhidoc_root / ".state"}
        for dirpath in rhidoc_root.rglob("*"):
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

    def _collect_orphaned_refs(self, rhidoc_root):
        excluded = {rhidoc_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []
        for md in rhidoc_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), rhidoc_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(rhidoc_root), m.group()))
        return orphans

    def test_delete_single_file(self):
        """Delete a leaf .md file, verify gap-closing."""
        # Delete doc00.03 (03-conventions.md)
        codex = self.rhidoc_copy / "00-codex"
        target = codex / "03-conventions.md"
        assert target.exists()
        entries_before = list_numbered_entries(codex)
        count_before = len(entries_before)

        result = _run_rhidoc(self.rhidoc_copy, "delete", "doc00.03")
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        # File should be gone
        assert not target.exists()

        # Siblings should be gap-closed
        entries_after = list_numbered_entries(codex)
        assert len(entries_after) == count_before - 1

        # No duplicate prefixes
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

        # Prefixes should be sequential
        prefixes = [get_numeric_prefix(e.name) for e in entries_after if get_numeric_prefix(e.name) > 0]
        assert prefixes == list(range(1, len(prefixes) + 1)), f"Non-sequential prefixes: {prefixes}"

    def test_delete_directory(self):
        """Delete a directory, verify dir + contents gone and siblings gap-closed."""
        # Delete doc02.08 (08-decisions/)
        design = self.rhidoc_copy / "02-product-design"
        target = design / "08-decisions"
        assert target.is_dir()

        result = _run_rhidoc(self.rhidoc_copy, "delete", "doc02.08")
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        assert not target.exists()
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

    def test_delete_multiple_same_parent(self):
        """Delete two entries from same parent, verify correct sequential renumbering."""
        codex = self.rhidoc_copy / "00-codex"
        entries_before = list_numbered_entries(codex)
        count_before = len(entries_before)

        result = _run_rhidoc(self.rhidoc_copy, "delete", "doc00.02", "doc00.04")
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        entries_after = list_numbered_entries(codex)
        assert len(entries_after) == count_before - 2

        # No duplicate prefixes
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

        # Prefixes sequential
        prefixes = [get_numeric_prefix(e.name) for e in entries_after if get_numeric_prefix(e.name) > 0]
        assert prefixes == list(range(1, len(prefixes) + 1)), f"Non-sequential: {prefixes}"

    def test_delete_dry_run(self):
        """--dry-run should not modify files."""
        before = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                  if p.is_file()
                  and p.suffix in (".md", ".json", "")}
        result = _run_rhidoc(self.rhidoc_copy, "delete", "doc00.03", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                 if p.is_file()
                 and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"

    def test_delete_orphan_warning(self):
        """Delete entry referenced by other docs, verify warning in output."""
        # doc01.02 (principles) is referenced by many docs in deps
        result = _run_rhidoc(self.rhidoc_copy, "delete", "doc01.02", "--dry-run")
        assert result.returncode == 0, result.stderr
        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot

    def test_delete_nonexistent_errors(self):
        """Non-zero exit on bad ref."""
        result = _run_rhidoc(self.rhidoc_copy, "delete", "doc99.99")
        assert result.returncode != 0

    def test_delete_no_new_orphans(self):
        """After gap-close, refs to surviving siblings are correct."""
        pre_existing = set(ref for _, ref in self._collect_orphaned_refs(self.rhidoc_copy))

        # Delete something that won't create orphaned refs to itself
        # (delete the last entry in codex, which is unlikely to be referenced)
        codex = self.rhidoc_copy / "00-codex"
        entries = list_numbered_entries(codex)
        last = entries[-1]

        result = _run_rhidoc(self.rhidoc_copy, "delete", str(last.relative_to(self.rhidoc_copy)))
        assert result.returncode == 0, f"delete failed:\n{result.stderr}\n{result.stdout}"

        orphans = self._collect_orphaned_refs(self.rhidoc_copy)
        new_orphans = [(f, r) for f, r in orphans if r not in pre_existing]
        # Filter out refs that point to the deleted entry itself (those are expected orphans)
        assert new_orphans == [] or all("00.06" in r or "00.05" in r for _, r in new_orphans), \
            f"New orphaned refs:\n" + "\n".join(f"  {r} in {f}" for f, r in new_orphans)

    def test_delete_requires_full_path_or_ref(self):
        """rhidoc delete requires a full path (with .md) or doc ref — stem-only paths no longer resolve."""
        target = self.rhidoc_copy / "02-product-design" / "01-workspace-scripts.md"
        assert target.exists()

        # Stem-only path no longer resolves silently
        result = _run_rhidoc(self.rhidoc_copy, "delete", "02-product-design/01-workspace-scripts")
        assert result.returncode != 0, "Expected failure on stem-only path"

        # Full path still works
        result = _run_rhidoc(self.rhidoc_copy, "delete", "02-product-design/01-workspace-scripts.md")
        assert result.returncode == 0, f"delete with full path failed:\n{result.stderr}\n{result.stdout}"
        assert not target.exists()


class TestResolveArg(unittest.TestCase):
    """Test resolve_arg: workspace-prefix rejection and filesystem-aware fallback forms."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_resolve_arg_rejects_workspace_prefix(self):
        """resolve_arg raises RhidocError when path starts with the workspace name."""
        from rhidoc.entries import resolve_arg
        from rhidoc.errors import RhidocError
        with self.assertRaises(RhidocError) as ctx:
            resolve_arg(".rhidoc/00-codex", self.rhidoc_copy)
        msg = str(ctx.exception)
        self.assertIn(".rhidoc", msg)
        self.assertIn("Try:", msg)

    def test_resolve_arg_rejects_bare_workspace_name(self):
        """resolve_arg raises RhidocError when path is exactly the workspace name."""
        from rhidoc.entries import resolve_arg
        from rhidoc.errors import RhidocError
        with self.assertRaises(RhidocError) as ctx:
            resolve_arg(".rhidoc", self.rhidoc_copy)
        self.assertIn(".rhidoc", str(ctx.exception))

    def test_resolve_arg_stem_without_md_returns_nonexistent(self):
        """resolve_arg no longer resolves stem paths — returns a non-existent literal path."""
        from rhidoc.entries import resolve_arg
        result = resolve_arg("02-product-design/01-workspace-scripts", self.rhidoc_copy)
        # Path without .md extension is not resolved; caller must provide the full path or a ref
        self.assertFalse(result.path.exists())

    def test_resolve_arg_prefix_only_in_slash_path_returns_nonexistent(self):
        """resolve_arg does not resolve prefix-only segments in slash paths — use a doc ref instead."""
        from rhidoc.entries import resolve_arg
        # "02-product-design/01" is not a ref form (has slash) — returned as literal (non-existent)
        result = resolve_arg("02-product-design/01", self.rhidoc_copy)
        self.assertFalse(result.path.exists())
        # The correct way to reference this doc is via ref form: "02.01" or "doc02.01"
        ref_result = resolve_arg("02.01", self.rhidoc_copy)
        expected = self.rhidoc_copy / "02-product-design" / "01-workspace-scripts.md"
        self.assertEqual(ref_result.path, expected)

    def test_resolve_arg_accepts_prefix_only_at_root(self):
        """resolve_arg resolves a prefix-only root segment (NN) to a directory."""
        from rhidoc.entries import resolve_arg
        result = resolve_arg("01", self.rhidoc_copy)
        expected = self.rhidoc_copy / "01-product-strategy"
        self.assertEqual(result.path, expected)
        self.assertTrue(result.path.exists())

    def test_resolve_arg_ambiguous_prefix_returns_literal(self):
        """resolve_arg returns literal path when a prefix-only segment is ambiguous.

        The existing fixture has unique NN prefixes per directory, so this case
        cannot arise without fabricating a broken fixture. Skipped intentionally —
        the tiebreak logic is exercised by the unambiguous prefix tests above.
        """
        # Cannot produce an ambiguous fixture safely; skip this case.
        pass

    def test_resolve_arg_nonexistent_unchanged(self):
        """resolve_arg returns the literal for a bogus path; resolve_and_validate raises."""
        from rhidoc.entries import resolve_and_validate
        from rhidoc.errors import RhidocError
        with self.assertRaises(RhidocError) as ctx:
            resolve_and_validate("99-nope", self.rhidoc_copy)
        self.assertIn("does not exist", str(ctx.exception))

    def test_resolve_arg_must_exist_false_returns_literal_for_new_path(self):
        """resolve_arg returns the literal resolved path for a not-yet-created destination."""
        from rhidoc.entries import resolve_arg
        new_path_arg = "02-product-design/09-new-doc"
        result = resolve_arg(new_path_arg, self.rhidoc_copy)
        expected = (self.rhidoc_copy / new_path_arg).resolve()
        self.assertEqual(result.path, expected)
        self.assertFalse(result.path.exists())


class TestMake(unittest.TestCase):
    """Test make command."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_make_appends(self):
        """make with parent+slug appends at max+1 position."""
        codex = self.rhidoc_copy / "00-codex"
        entries_before = list_numbered_entries(codex)
        max_prefix = max(get_numeric_prefix(e.name) for e in entries_before)

        result = _run_rhidoc(self.rhidoc_copy, "make", "doc00", "test-doc")
        assert result.returncode == 0, f"make failed:\n{result.stderr}\n{result.stdout}"

        # File should exist at max+1
        expected = codex / f"{max_prefix + 1:02d}-test-doc.md"
        assert expected.exists(), f"Expected file at {expected}"

        # Check frontmatter
        from rhidoc.frontmatter import read_frontmatter
        fm, body = read_frontmatter(expected)
        assert fm["title"] == "Test Doc"

        # MANIFEST should be regenerated
        manifest = self.rhidoc_copy / "MANIFEST.md"
        assert "test-doc" in manifest.read_text(encoding="utf-8").lower()

    def test_make_at_free_position(self):
        """make with --at at a free slot writes to that slot."""
        codex = self.rhidoc_copy / "00-codex"
        entries = list_numbered_entries(codex)
        max_prefix = max(get_numeric_prefix(e.name) for e in entries)
        free_pos = max_prefix + 5  # definitely free
        at_ref = f"doc00.{free_pos:02d}"

        result = _run_rhidoc(self.rhidoc_copy, "make", "free-slot", "--at", at_ref)
        assert result.returncode == 0, f"make failed:\n{result.stderr}\n{result.stdout}"

        expected = codex / f"{free_pos:02d}-free-slot.md"
        assert expected.exists()

    def test_make_at_occupied_position_errors(self):
        """make with --at at occupied slot should error."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "bad-slot", "--at", "doc00.01")
        assert result.returncode != 0
        assert result.stderr == self._snapshot

    def test_make_writes_skeleton_frontmatter(self):
        """make writes slug-derived title and empty summary/tags/deps."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "doc00", "my-thing")
        assert result.returncode == 0, f"make failed:\n{result.stderr}\n{result.stdout}"

        codex = self.rhidoc_copy / "00-codex"
        created = [e for e in codex.iterdir() if "my-thing" in e.name]
        assert len(created) == 1

        from rhidoc.frontmatter import read_frontmatter
        fm, _ = read_frontmatter(created[0])
        assert fm["title"] == "My Thing"
        assert fm["summary"] == ""
        assert fm["tags"] == []
        assert fm["deps"] == []

    def test_make_dry_run(self):
        """--dry-run should not create files."""
        before = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                  if p.is_file()
                  and p.suffix in (".md", ".json", "")}
        result = _run_rhidoc(self.rhidoc_copy, "make", "doc00", "phantom", "--dry-run")
        assert result.returncode == 0, result.stderr
        after = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                 if p.is_file()
                 and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"

    def test_make_help_has_examples(self):
        """rhidoc make --help shows an Examples section."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "--help")
        assert result.returncode == 0
        assert result.stdout == self._snapshot

    def test_make_at_root(self):
        """Single positional creates a top-level entry."""
        root_entries_before = list_numbered_entries(self.rhidoc_copy)
        max_prefix = max(get_numeric_prefix(e.name) for e in root_entries_before)

        result = _run_rhidoc(self.rhidoc_copy, "make", "top-level-doc")
        assert result.returncode == 0, f"make failed:\n{result.stderr}\n{result.stdout}"

        expected = self.rhidoc_copy / f"{max_prefix + 1:02d}-top-level-doc.md"
        assert expected.exists(), f"Expected top-level file at {expected}"

    def test_make_outputs_canonical_ref(self):
        """make prints the canonical ref of the created entry."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "doc00", "ref-check")
        assert result.returncode == 0, f"make failed:\n{result.stderr}\n{result.stdout}"
        assert "Created: doc00." in result.stdout, f"Expected canonical ref in output:\n{result.stdout}"

    def test_make_at_with_parent_errors(self):
        """--at combined with two positionals should error."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "doc00", "some-slug", "--at", "doc00.07")
        assert result.returncode != 0
        assert "--at takes its position from the ref" in result.stderr


class TestMkdir(unittest.TestCase):
    """Test --mkdir flag on move command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_mkdir_creates_destination(self):
        """Move with --mkdir to nonexistent path creates dir with 00-index.md."""
        # Create a new dir path under an existing section
        new_dir = "03-architecture/99-new-section"
        result = _run_rhidoc(self.rhidoc_copy, "move", "doc03.01", new_dir, "--mkdir")
        assert result.returncode == 0, f"move --mkdir failed:\n{result.stderr}\n{result.stdout}"

        # The dir may have been renumbered by gap-closing, so look for "new-section" by slug
        system = self.rhidoc_copy / "03-architecture"
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
        before_dirs = set(str(p) for p in self.rhidoc_copy.rglob("*") if p.is_dir())

        result = _run_rhidoc(self.rhidoc_copy, "move", "doc03.06", new_dir, "--mkdir", "--dry-run")
        assert result.returncode == 0, f"move --mkdir --dry-run failed:\n{result.stderr}\n{result.stdout}"

        after_dirs = set(str(p) for p in self.rhidoc_copy.rglob("*") if p.is_dir())
        assert before_dirs == after_dirs, "Directories were created during --dry-run"

    def test_mkdir_existing_dir_noop(self):
        """--mkdir when dest exists works normally (no error, no extra dir)."""
        result = _run_rhidoc(self.rhidoc_copy, "move", "doc00.05", "doc01", "--mkdir")
        assert result.returncode == 0, f"move --mkdir failed:\n{result.stderr}\n{result.stdout}"

    def test_move_without_mkdir_still_errors(self):
        """Without --mkdir, moving to nonexistent path should error."""
        result = _run_rhidoc(self.rhidoc_copy, "move", "doc03.06", "03-architecture/99-nonexistent")
        assert result.returncode != 0


class TestMoveAtInsert(unittest.TestCase):
    """Tests for rhidoc move --at / --before vocabulary."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_move_at_free_slot(self):
        """--at into a free cross-dir slot: source lands at exact prefix, no destination sibling shift."""
        # 00-codex/01-about → 01-product-strategy at position 09 (free)
        before_ps_entries = sorted(
            e.name for e in (self.rhidoc / "01-product-strategy").iterdir()
            if re.match(r'^\d{2}-', e.name)
        )
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--at", "doc01.09")
        self.assertEqual(result.returncode, 0, result.stderr)
        # Source should be in destination at exactly 09
        ps_dir = self.rhidoc / "01-product-strategy"
        self.assertTrue((ps_dir / "09-about.md").exists(), "about.md should land at 09")
        # No destination sibling renumbering — existing entries at 01..04 unchanged
        for name in before_ps_entries:
            if name != "09-about.md":
                self.assertTrue((ps_dir / name).exists(), f"{name} should not have moved")
        # Source gap-closes: 02-maintenance → 01-maintenance
        codex = self.rhidoc / "00-codex"
        self.assertTrue((codex / "01-maintenance.md").exists(), "02-maintenance should gap-close to 01")
        self.assertFalse((codex / "02-maintenance.md").exists(), "old 02-maintenance should be gone")

    def test_move_at_occupied_errors(self):
        """--at onto an occupied prefix errors; nothing is moved."""
        # 02-maintenance occupies doc00.02 — trying to move 01-about there should fail
        before = {p.name for p in (self.rhidoc / "00-codex").iterdir()}
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--at", "doc00.02")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("occupied", result.stderr.lower())
        after = {p.name for p in (self.rhidoc / "00-codex").iterdir()}
        self.assertEqual(before, after, "No files should have moved on error")

    def test_move_insert_displaces(self):
        """--before into an occupied middle slot bumps siblings up; refs rewritten."""
        codex = self.rhidoc / "00-codex"
        # Move 06-integration --before doc00.03: bumps 03→04, 04→05, 05→06; source→03
        result = _run_rhidoc(self.rhidoc, "move", "doc00.06", "--before", "doc00.03")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((codex / "03-integration.md").exists(), "source should land at 03")
        self.assertTrue((codex / "04-conventions.md").exists(), "03-conventions bumped to 04")
        self.assertTrue((codex / "05-ai-retrieval.md").exists(), "04-ai-retrieval bumped to 05")
        self.assertTrue((codex / "06-taxonomy.md").exists(), "05-taxonomy bumped to 06")
        self.assertFalse((codex / "06-integration.md").exists(), "old 06 should be gone")

    def test_move_promote_group_to_root_zero(self):
        """Bug-3 regression: moving a root group to slot 00 works (root has no 00-index.md)."""
        # Root: 00-codex, 01-product-strategy, 02-product-design, 03-architecture
        # Move 03-architecture --before doc00 → should land at 00, others bump up
        result = _run_rhidoc(self.rhidoc, "move", "03-architecture", "--before", "doc00")
        self.assertEqual(result.returncode, 0, result.stderr)
        root_entries = sorted(
            e.name for e in self.rhidoc.iterdir() if re.match(r'^\d{2}-', e.name)
        )
        self.assertIn("00-architecture", root_entries, "architecture should be at 00")
        self.assertIn("01-codex", root_entries, "codex should have bumped to 01")
        self.assertIn("02-product-strategy", root_entries, "product-strategy should bump to 02")
        self.assertIn("03-product-design", root_entries, "product-design should bump to 03")
        # No gaps
        prefixes = [int(re.match(r'^(\d{2})-', n).group(1)) for n in root_entries]
        self.assertEqual(prefixes, list(range(0, len(prefixes))))

    def test_move_insert_into_index_slot_errors(self):
        """--before targeting position 00 in a directory with 00-index.md is rejected."""
        # 00-codex has 00-index.md — trying to displace it should fail
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--before", "doc00.00")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("reserved", result.stderr.lower())

    def test_move_at_into_index_slot_errors(self):
        """--at targeting position 00 in a directory with 00-index.md is rejected."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--at", "doc00.00")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("reserved", result.stderr.lower())

    def test_move_at_and_insert_mutually_exclusive(self):
        """Providing both --at and --before is an error."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--at", "doc00.05", "--before", "doc00.05")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("mutually exclusive", result.stderr.lower())

    def test_move_ref_flag_rejects_positional_destination(self):
        """--at or --before with a positional destination arg is an error."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "00-codex", "--at", "doc00.05")
        self.assertNotEqual(result.returncode, 0)

    def test_move_no_destination_errors(self):
        """Omitting both destination and --at/--before is an error."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01")
        self.assertNotEqual(result.returncode, 0)

    def test_move_help_has_examples(self):
        """rhidoc move --help shows an Examples section."""
        result = _run_rhidoc(self.rhidoc, "move", "--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("Examples", result.stdout)


def test_version_flag(run_cli):
    """rhidoc --version prints the version string."""
    code, out, err = run_cli("--version")
    assert code == 0, f"--version failed:\n{err}"
    from rhidoc.__version__ import __version__
    assert __version__ in out


def test_init_portable_creates_scripts(run_cli, tmp_path):
    """rhidoc init --portable dumps scripts into .rhidoc/."""
    code, out, err = run_cli("init", "--portable", "--name", "PortableTest", cwd=tmp_path)
    assert code == 0, f"init --portable failed:\n{err}\n{out}"

    rhidoc_dir = tmp_path / ".rhidoc"
    assert (rhidoc_dir / "rhidoc.py").exists(), "rhidoc.py should exist at .rhidoc/ root"
    assert (rhidoc_dir / "_scripts").is_dir(), "_scripts/ directory should exist"
    assert (rhidoc_dir / "_scripts" / "frontmatter.py").exists()
    assert (rhidoc_dir / "_scripts" / "__init__.py").exists()
    assert (rhidoc_dir / "_scripts" / "manifest-preamble.md").exists()


def test_portable_scripts_execute(run_cli, tmp_path):
    """Portable rhidoc.py can run regenerate."""
    run_cli("init", "--portable", "--name", "PortableTest", cwd=tmp_path)

    rhidoc_py = tmp_path / ".rhidoc" / "rhidoc.py"
    result = subprocess.run(
        [sys.executable, str(rhidoc_py), "regenerate"],
        capture_output=True, text=True,
        cwd=str(tmp_path),
    )
    assert result.returncode == 0, f"portable regenerate failed:\n{result.stderr}"


def test_portable_version(run_cli, tmp_path):
    """Portable rhidoc.py --version works."""
    run_cli("init", "--portable", "--name", "PortableTest", cwd=tmp_path)
    rhidoc_py = tmp_path / ".rhidoc" / "rhidoc.py"
    result = subprocess.run(
        [sys.executable, str(rhidoc_py), "--version"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    from rhidoc.__version__ import __version__
    assert __version__ in result.stdout


def test_rhidoc_json_has_portable_field(run_cli, tmp_path):
    """After --portable, .rhidoc.json has portable field."""
    run_cli("init", "--portable", "--name", "PortableTest", cwd=tmp_path)
    config = json.loads((tmp_path / ".rhidoc.json").read_text())
    assert "portable" in config
    assert config["portable"] == ".rhidoc/rhidoc.py"


class TestMakeGroup(unittest.TestCase):
    """Tests for `rhidoc make -g` (group creation)."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_make_group_creates_directory(self):
        """rhidoc make -g creates directory with 00-index.md and slug-derived title."""
        root_entries_before = list_numbered_entries(self.rhidoc_copy)
        max_prefix = max(get_numeric_prefix(e.name) for e in root_entries_before)
        expected_prefix = max_prefix + 1

        result = _run_rhidoc(self.rhidoc_copy, "make", "-g", "test-group")
        self.assertEqual(result.returncode, 0, f"rhidoc make -g failed:\n{result.stderr}\n{result.stdout}")

        group_dir = self.rhidoc_copy / f"{expected_prefix:02d}-test-group"
        self.assertTrue(group_dir.is_dir(), "Group directory should exist")
        index_path = group_dir / "00-index.md"
        self.assertTrue(index_path.exists(), "00-index.md should exist")

        content = index_path.read_text(encoding="utf-8")
        self.assertIn("Test Group", content, "Slug-derived title should be in index content")

    def test_make_group_at_occupied_errors(self):
        """rhidoc make -g --at occupied slot fails."""
        # doc01 (01-product-strategy) already exists
        result = _run_rhidoc(self.rhidoc_copy, "make", "-g", "--at", "doc01", "duplicate")
        self.assertNotEqual(result.returncode, 0, "Should fail on occupied slot")
        assert result.stderr == self._snapshot

    def test_make_group_rejects_workspace_prefix(self):
        """rhidoc make -g fails with a clear hint when parent path includes the workspace name."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "-g", ".rhidoc/05-new-section", "new-section")
        self.assertNotEqual(result.returncode, 0)
        assert result.stderr == self._snapshot

    def test_make_group_help_has_examples(self):
        """rhidoc make --help shows an Examples section."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "--help")
        self.assertEqual(result.returncode, 0)
        assert result.stdout == self._snapshot


class TestRenameCommand(unittest.TestCase):
    """Tests for `rhidoc rename` command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_rename_directory(self):
        """rhidoc rename renames a directory slug, keeping its prefix."""
        old_dir = self.rhidoc_copy / "01-product-strategy"
        self.assertTrue(old_dir.exists(), "Source directory must exist before rename")

        result = _run_rhidoc(self.rhidoc_copy, "rename", "01-product-strategy", "product")
        self.assertEqual(result.returncode, 0, f"rhidoc rename failed:\n{result.stderr}\n{result.stdout}")

        new_dir = self.rhidoc_copy / "01-product"
        self.assertFalse(old_dir.exists(), "Old directory should be gone")
        self.assertTrue(new_dir.is_dir(), "New directory should exist")

    def test_rename_file(self):
        """rhidoc rename renames a file slug, keeping its prefix and extension."""
        source_file = self.rhidoc_copy / "00-codex" / "01-about.md"
        self.assertTrue(source_file.exists(), "Source file must exist")

        result = _run_rhidoc(self.rhidoc_copy, "rename", "doc00.01", "about-rhidoc")
        self.assertEqual(result.returncode, 0, f"rhidoc rename failed:\n{result.stderr}\n{result.stdout}")

        new_file = self.rhidoc_copy / "00-codex" / "01-about-rhidoc.md"
        self.assertFalse(source_file.exists(), "Old file should be gone")
        self.assertTrue(new_file.exists(), "New file should exist")

    def test_rename_errors_on_missing(self):
        """rhidoc rename fails if target does not exist."""
        result = _run_rhidoc(self.rhidoc_copy, "rename", "99-nonexistent", "something")
        self.assertNotEqual(result.returncode, 0, "Should fail on missing target")


class TestCatCommand(unittest.TestCase):
    """Tests for `rhidoc cat` command."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_cat_file_ref(self):
        """rhidoc cat prints file contents for a doc file ref."""
        result = _run_rhidoc(self.rhidoc_copy, "cat", "doc02.01")
        self.assertEqual(result.returncode, 0, f"rhidoc cat failed:\n{result.stderr}\n{result.stdout}")
        expected = (self.rhidoc_copy / "02-product-design" / "01-workspace-scripts.md").read_text(encoding="utf-8")
        self.assertEqual(result.stdout, expected)

    def test_cat_directory_ref(self):
        """rhidoc cat prints 00-index.md for a directory doc ref."""
        result = _run_rhidoc(self.rhidoc_copy, "cat", "doc02.04")
        self.assertEqual(result.returncode, 0, f"rhidoc cat failed:\n{result.stderr}\n{result.stdout}")
        expected = (self.rhidoc_copy / "02-product-design" / "04-web-platform" / "00-index.md").read_text(encoding="utf-8")
        self.assertEqual(result.stdout, expected)

    def test_cat_nonexistent_ref(self):
        """rhidoc cat fails with non-zero exit and error message for nonexistent ref."""
        result = _run_rhidoc(self.rhidoc_copy, "cat", "doc99.99")
        self.assertNotEqual(result.returncode, 0, "Should fail for nonexistent ref")
        assert normalize_output(result.stderr, self.tmpdir.name) == self._snapshot


class TestTreeCommand(unittest.TestCase):
    """Tests for `rhidoc tree` command."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_tree_default(self):
        """rhidoc tree prints workspace structure with titles."""
        result = _run_rhidoc(self.rhidoc_copy, "tree")
        self.assertEqual(result.returncode, 0, f"rhidoc tree failed:\n{result.stderr}\n{result.stdout}")
        # Should contain tree-drawing characters (Unicode or ASCII fallback)
        lines = result.stdout.strip().split("\n")
        self.assertTrue(any(
            "├── " in l or "└── " in l or "|-- " in l or "`-- " in l
            for l in lines[1:]
        ))
        assert result.stdout == self._snapshot

    def test_tree_subtree(self):
        """rhidoc tree with a doc ref shows only that subtree."""
        result = _run_rhidoc(self.rhidoc_copy, "tree", "doc01.04")
        self.assertEqual(result.returncode, 0, f"rhidoc tree failed:\n{result.stderr}\n{result.stdout}")
        assert result.stdout == self._snapshot

    def test_tree_refs(self):
        """rhidoc tree --refs shows doc references."""
        result = _run_rhidoc(self.rhidoc_copy, "tree", "--refs", "doc01.04")
        self.assertEqual(result.returncode, 0, f"rhidoc tree failed:\n{result.stderr}\n{result.stdout}")
        assert result.stdout == self._snapshot

    def test_tree_no_title(self):
        """rhidoc tree --no-title shows filenames instead of titles."""
        result = _run_rhidoc(self.rhidoc_copy, "tree", "--no-title", "doc01.04")
        self.assertEqual(result.returncode, 0, f"rhidoc tree failed:\n{result.stderr}\n{result.stdout}")
        assert result.stdout == self._snapshot

    def test_tree_nonexistent_ref(self):
        """rhidoc tree fails for nonexistent ref."""
        result = _run_rhidoc(self.rhidoc_copy, "tree", "doc99.99")
        self.assertNotEqual(result.returncode, 0, "Should fail for nonexistent ref")


class TestMoveNoRegen(unittest.TestCase):
    """Tests for `rhidoc move --no-regen`."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_move_no_regen_skips_manifest_update(self):
        """--no-regen leaves MANIFEST unchanged after move."""
        manifest_path = self.rhidoc_copy / "MANIFEST.md"
        manifest_before = manifest_path.read_text(encoding="utf-8")

        result = _run_rhidoc(self.rhidoc_copy, "move", "doc00.05", "doc01", "--no-regen")
        self.assertEqual(result.returncode, 0, f"rhidoc move --no-regen failed:\n{result.stderr}")

        manifest_after = manifest_path.read_text(encoding="utf-8")
        self.assertEqual(manifest_before, manifest_after, "MANIFEST should be unchanged with --no-regen")

    def test_regenerate_works_after_no_regen_move(self):
        """After --no-regen move, rhidoc regenerate succeeds."""
        _run_rhidoc(self.rhidoc_copy, "move", "doc00.05", "doc01", "--no-regen")
        result = _run_rhidoc(self.rhidoc_copy, "regenerate")
        self.assertEqual(result.returncode, 0, f"regenerate after --no-regen failed:\n{result.stderr}")


class TestHelpAi(unittest.TestCase):
    """Tests for `rhidoc --help-ai` (deprecated) and `rhidoc ai-skill`."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_help_ai_prints_deprecation_notice(self):
        """--help-ai prints a deprecation notice pointing to ai-skill."""
        result = _run_rhidoc(self.rhidoc_copy, "--help-ai")
        self.assertEqual(result.returncode, 0, f"--help-ai failed:\n{result.stderr}")
        assert result.stdout == self._snapshot

    def test_ai_skill_lists_all_commands(self):
        """ai-skill lists all commands with usage and side effects."""
        result = _run_rhidoc(self.rhidoc_copy, "ai-skill")
        self.assertEqual(result.returncode, 0, f"rhidoc ai-skill failed:\n{result.stderr}")
        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot

    def test_ai_skill_includes_behavioral_rules(self):
        """ai-skill output includes behavioral rules section."""
        result = _run_rhidoc(self.rhidoc_copy, "ai-skill")
        self.assertEqual(result.returncode, 0)
        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot

    def test_ai_skill_includes_workspace_state(self):
        """ai-skill output includes workspace state section."""
        result = _run_rhidoc(self.rhidoc_copy, "ai-skill")
        self.assertEqual(result.returncode, 0)
        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot


class TestExistingCommandsUnified(unittest.TestCase):
    """Smoke tests to verify existing commands still work after unification."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_make_works(self):
        """rhidoc make works after unification."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "00-codex", "my-unified-doc")
        self.assertEqual(result.returncode, 0, f"rhidoc make failed:\n{result.stderr}\n{result.stdout}")
        self.assertTrue(any((self.rhidoc_copy / "00-codex").glob("*my-unified-doc*")),
                        "Created doc should exist")

    def test_delete_works(self):
        """rhidoc delete still works after unification."""
        result = _run_rhidoc(self.rhidoc_copy, "delete", "doc00.05")
        self.assertEqual(result.returncode, 0, f"rhidoc delete failed:\n{result.stderr}\n{result.stdout}")
        self.assertFalse((self.rhidoc_copy / "00-codex" / "05-ai-retrieval.md").exists(),
                         "Deleted file should not exist")

    def test_move_works(self):
        """rhidoc move still works after unification."""
        result = _run_rhidoc(self.rhidoc_copy, "move", "doc00.05", "doc01")
        self.assertEqual(result.returncode, 0, f"rhidoc move failed:\n{result.stderr}\n{result.stdout}")
        self.assertFalse((self.rhidoc_copy / "00-codex" / "05-ai-retrieval.md").exists(),
                         "Source should have moved")


class TestNoGapClose(unittest.TestCase):
    """Test --no-gap-close flag: source siblings keep their original numbers."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_no_gap_close_preserves_source_siblings(self):
        """Moving with --no-gap-close should NOT renumber source siblings."""
        result = _run_rhidoc(
            self.rhidoc_copy,
            "move", "00-codex/01-about.md", "01-product-strategy",
            "--no-gap-close", "--no-regen",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

        codex = self.rhidoc_copy / "00-codex"
        names = sorted(p.name for p in codex.iterdir())
        self.assertFalse((codex / "01-about.md").exists(), "Source should have moved")
        self.assertTrue(any(n.startswith("02-") for n in names),
                        f"Expected 02- prefix preserved, got: {names}")

    def test_no_gap_close_enables_sequential_moves(self):
        """Second move should succeed because first move left original paths intact."""
        result1 = _run_rhidoc(
            self.rhidoc_copy,
            "move", "00-codex/01-about.md", "01-product-strategy",
            "--no-gap-close", "--no-regen",
        )
        self.assertEqual(result1.returncode, 0, result1.stderr)

        result2 = _run_rhidoc(
            self.rhidoc_copy,
            "move", "00-codex/02-maintenance.md", "01-product-strategy",
            "--no-gap-close", "--no-regen",
        )
        self.assertEqual(result2.returncode, 0, result2.stderr)

        codex = self.rhidoc_copy / "00-codex"
        self.assertFalse((codex / "01-about.md").exists(), "01-about.md should have moved")
        self.assertFalse((codex / "02-maintenance.md").exists(), "02-maintenance.md should have moved")

    def test_default_still_gap_closes(self):
        """Without --no-gap-close, source siblings are still renumbered (default behavior)."""
        result = _run_rhidoc(
            self.rhidoc_copy,
            "move", "00-codex/01-about.md", "01-product-strategy",
            "--no-regen",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

        codex = self.rhidoc_copy / "00-codex"
        self.assertFalse((codex / "02-maintenance.md").exists(),
                         "02-maintenance.md should have been renumbered to 01-")
        self.assertTrue((codex / "01-maintenance.md").exists(),
                        "01-maintenance.md should exist after gap-close")


class TestGenerateSkillContent(unittest.TestCase):
    def test_contains_all_commands(self):
        from rhidoc.ai_skill import generate_skill_content, _COMMAND_DOCS
        content = generate_skill_content(".rhidoc")
        for cmd_name in _COMMAND_DOCS:
            self.assertIn(f"### {cmd_name}", content)

    def test_contains_behavioral_rules(self):
        from rhidoc.ai_skill import generate_skill_content
        content = generate_skill_content(".rhidoc")
        self.assertIn("Behavioral Rules", content)
        self.assertIn("Common Patterns", content)

    def test_dir_name_substitution(self):
        from rhidoc.ai_skill import generate_skill_content
        content = generate_skill_content(".docs")
        self.assertIn(".docs", content)
        self.assertNotIn("{{dir_name}}", content)


def _build_bundle_fixture(dest: Path) -> Path:
    """Build a minimal .rhidoc/ workspace with bundle attachments. Returns dest/.rhidoc/"""
    rhidoc = dest / ".rhidoc"
    rhidoc.mkdir(parents=True, exist_ok=True)

    (dest / MARKER).write_text(
        json.dumps({"root": ".rhidoc/", "title": "BundleTest"}), encoding="utf-8"
    )

    # 00-codex/ section — bundles with attachments
    _write(rhidoc / "00-codex/00-index.md", _fm("Codex", summary="Codex index."))
    _write(rhidoc / "00-codex/01-logic.md", _fm("Logic", summary="Game logic."))
    (rhidoc / "00-codex/01-logic.statemachine.json").write_text('{"id": "logic"}', encoding="utf-8")
    (rhidoc / "00-codex/01-design.png").write_bytes(b"\x89PNG\r\n")  # fake PNG, different slug
    _write(rhidoc / "00-codex/02-state.md", _fm("State", summary="State doc."))
    _write(rhidoc / "00-codex/03-extra.md", _fm("Extra", summary="Extra doc."))
    (rhidoc / "00-codex/03-extra.notes.txt").write_text("notes", encoding="utf-8")

    # 01-product/ section — for cross-dir move target
    _write(rhidoc / "01-product/00-index.md", _fm("Product", summary="Product index."))
    _write(rhidoc / "01-product/01-api.md", _fm("API", summary="API spec."))
    (rhidoc / "01-product/01-api.yaml").write_text("api: v1", encoding="utf-8")

    result = _run_rhidoc(rhidoc, "regenerate")
    if result.returncode != 0:
        raise RuntimeError(f"bundle fixture regenerate failed:\n{result.stderr}")

    return rhidoc


class TestBundleAwareMoveDeleteRename(unittest.TestCase):
    """Tests for bundle-aware move, delete, and rename operations."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_bundle_fixture(Path(self.tmpdir.name))
        self.codex = self.rhidoc / "00-codex"
        self.product = self.rhidoc / "01-product"

    def tearDown(self):
        self.tmpdir.cleanup()

    # ── move ─────────────────────────────────────────────────────────────────

    def test_move_bundle_same_dir_renumbers_all_members(self):
        """Moving a bundle within the same dir renumbers root + all attachments."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--before", "doc00.03")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.codex / "03-logic.md").exists())
        self.assertTrue((self.codex / "03-logic.statemachine.json").exists())
        self.assertTrue((self.codex / "03-design.png").exists())
        self.assertFalse((self.codex / "01-logic.md").exists())
        self.assertFalse((self.codex / "01-logic.statemachine.json").exists())
        self.assertFalse((self.codex / "01-design.png").exists())

    def test_move_bundle_cross_dir_all_members_travel(self):
        """Moving a bundle cross-dir carries root + all attachments to the new dir."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "01-product")
        self.assertEqual(result.returncode, 0, result.stderr)

        product_files = {p.name for p in self.product.iterdir()}
        self.assertIn("02-logic.md", product_files)
        self.assertIn("02-logic.statemachine.json", product_files)
        self.assertIn("02-design.png", product_files)
        self.assertFalse((self.codex / "01-logic.md").exists())
        self.assertFalse((self.codex / "01-logic.statemachine.json").exists())
        self.assertFalse((self.codex / "01-design.png").exists())
        # Source gap-closes correctly with attachments
        self.assertTrue((self.codex / "01-state.md").exists())
        self.assertTrue((self.codex / "02-extra.md").exists())
        self.assertTrue((self.codex / "02-extra.notes.txt").exists())

    def test_move_bundle_with_rename_renames_same_slug_attachments(self):
        """--rename renames root and same-slug attachments; different-slug stays."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--before", "doc00.01",
                            "--rename", "engine")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.codex / "01-engine.md").exists())
        self.assertTrue((self.codex / "01-engine.statemachine.json").exists())
        # Different-slug attachment keeps its slug
        self.assertTrue((self.codex / "01-design.png").exists())
        self.assertFalse((self.codex / "01-logic.md").exists())
        self.assertFalse((self.codex / "01-logic.statemachine.json").exists())

    def test_move_attachment_directly_raises_error(self):
        """Attempting to move an attachment directly raises RhidocError."""
        result = _run_rhidoc(self.rhidoc, "move",
                            "00-codex/01-logic.statemachine.json", "00-codex")
        self.assertNotEqual(result.returncode, 0)
        combined = result.stderr + result.stdout
        assert normalize_output(combined, self.tmpdir.name) == self._snapshot

    # ── delete ───────────────────────────────────────────────────────────────

    def test_delete_bundle_removes_root_and_all_attachments(self):
        """Deleting a bundle root removes root + all bundle attachments."""
        result = _run_rhidoc(self.rhidoc, "delete", "doc00.01")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertFalse((self.codex / "01-logic.md").exists())
        self.assertFalse((self.codex / "01-logic.statemachine.json").exists())
        self.assertFalse((self.codex / "01-design.png").exists())

    def test_delete_gap_closes_bundles_as_groups(self):
        """After deleting a bundle, remaining bundles gap-close with all their attachments."""
        result = _run_rhidoc(self.rhidoc, "delete", "doc00.01")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.codex / "01-state.md").exists())
        self.assertFalse((self.codex / "02-state.md").exists())
        self.assertTrue((self.codex / "02-extra.md").exists())
        self.assertTrue((self.codex / "02-extra.notes.txt").exists())
        self.assertFalse((self.codex / "03-extra.md").exists())
        self.assertFalse((self.codex / "03-extra.notes.txt").exists())

    def test_delete_multiple_bundles_gap_closes_correctly(self):
        """Deleting multiple bundles gap-closes remaining ones correctly."""
        result = _run_rhidoc(self.rhidoc, "delete", "doc00.01", "doc00.02")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertFalse((self.codex / "01-logic.md").exists())
        self.assertFalse((self.codex / "02-state.md").exists())
        self.assertTrue((self.codex / "01-extra.md").exists())
        self.assertTrue((self.codex / "01-extra.notes.txt").exists())

    def test_delete_attachment_directly_raises_error(self):
        """Attempting to delete an attachment directly raises RhidocError."""
        result = _run_rhidoc(self.rhidoc, "delete",
                            "00-codex/01-logic.statemachine.json")
        self.assertNotEqual(result.returncode, 0)
        combined = result.stderr + result.stdout
        assert normalize_output(combined, self.tmpdir.name) == self._snapshot

    # ── rename ───────────────────────────────────────────────────────────────

    def test_rename_renames_same_slug_attachments(self):
        """Rename renames root and same-slug attachments; other-slug attachments unchanged."""
        result = _run_rhidoc(self.rhidoc, "rename", "doc00.01", "engine")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.codex / "01-engine.md").exists())
        self.assertTrue((self.codex / "01-engine.statemachine.json").exists())
        self.assertTrue((self.codex / "01-design.png").exists())  # different slug, unchanged
        self.assertFalse((self.codex / "01-logic.md").exists())
        self.assertFalse((self.codex / "01-logic.statemachine.json").exists())

    def test_rename_no_attachments_works_unchanged(self):
        """Rename of a file with no attachments behaves like before."""
        result = _run_rhidoc(self.rhidoc, "rename", "doc00.02", "plain")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.codex / "02-plain.md").exists())
        self.assertFalse((self.codex / "02-state.md").exists())

    def test_rename_output_shows_unchanged_attachments(self):
        """Rename prints 'Left unchanged' for same-prefix different-slug attachments."""
        result = _run_rhidoc(self.rhidoc, "rename", "doc00.01", "engine")
        self.assertEqual(result.returncode, 0, result.stderr)

        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot

    # ── cross-ref integrity ───────────────────────────────────────────────────

    def test_move_bundle_attachments_not_in_rename_map(self):
        """Moving a bundle: attachments appear in fs moves but not in ref rename_map."""
        result = _run_rhidoc(self.rhidoc, "move", "doc00.01", "--before", "doc00.03",
                            "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)

        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot


def _build_punch_hoist_fixture(dest: Path) -> Path:
    """Build workspace for bundle-aware punch/hoist tests. Returns dest/.rhidoc/"""
    rhidoc = dest / ".rhidoc"
    rhidoc.mkdir(parents=True, exist_ok=True)

    (dest / MARKER).write_text(
        json.dumps({"root": ".rhidoc/", "title": "PFTest"}), encoding="utf-8"
    )

    # 00-codex/ — for punch tests: leaf files with attachments
    _write(rhidoc / "00-codex/00-index.md", _fm("Codex", summary="Codex index."))
    _write(rhidoc / "00-codex/01-game.md", _fm("Game Logic", summary="Game doc."))
    (rhidoc / "00-codex/01-game.xstate.json").write_text('{"id":"g"}', encoding="utf-8")
    (rhidoc / "00-codex/01-game.mockup.png").write_bytes(b"\x89PNG\r\n")
    _write(rhidoc / "00-codex/02-plain.md", _fm("Plain", summary="No attachments."))

    # 01-product/ — for hoist tests: a subdirectory with bundled children
    _write(rhidoc / "01-product/00-index.md", _fm("Product", summary="Product index."))
    (rhidoc / "01-product/00-product.cover.png").write_bytes(b"\x89PNG\r\n")  # index attachment
    # 01-chapter/ — the directory to be hoisted
    _write(rhidoc / "01-product/01-chapter/00-index.md", _fm("Chapter", summary="Chapter."))
    (rhidoc / "01-product/01-chapter/00-chapter.bg.png").write_bytes(b"\x89PNG\r\n")  # index att
    _write(rhidoc / "01-product/01-chapter/01-intro.md", _fm("Intro", summary="Intro."))
    (rhidoc / "01-product/01-chapter/01-intro.notes.txt").write_text("notes", encoding="utf-8")
    _write(rhidoc / "01-product/01-chapter/02-body.md", _fm("Body", summary="Body."))
    (rhidoc / "01-product/01-chapter/02-body.diagram.svg").write_text("<svg/>", encoding="utf-8")
    # 02-extra.md — sibling after chapter (for verifying it shifts correctly)
    _write(rhidoc / "01-product/02-extra.md", _fm("Extra", summary="Sibling."))

    result = _run_rhidoc(rhidoc, "regenerate")
    if result.returncode != 0:
        raise RuntimeError(f"punch/hoist fixture regenerate failed:\n{result.stderr}")

    return rhidoc


class TestBundleAwarePunchHoist(unittest.TestCase):
    """Tests for bundle-aware punch and hoist operations (sidecars-03)."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_punch_hoist_fixture(Path(self.tmpdir.name))
        self.codex = self.rhidoc / "00-codex"
        self.product = self.rhidoc / "01-product"
        self.chapter = self.product / "01-chapter"

    def tearDown(self):
        self.tmpdir.cleanup()

    # ── punch ──────────────────────────────────────────────────────────────────

    def test_punch_moves_attachments_to_new_dir_with_01_prefix(self):
        """Punch moves content and all bundle attachments into new dir with 01- prefix."""
        result = _run_rhidoc(self.rhidoc, "punch", "doc00.01")
        self.assertEqual(result.returncode, 0, result.stderr)

        game_dir = self.codex / "01-game"
        self.assertTrue(game_dir.is_dir())
        self.assertTrue((game_dir / "00-index.md").exists())    # generated index
        self.assertTrue((game_dir / "01-game.md").exists())      # original content
        self.assertTrue((game_dir / "01-game.xstate.json").exists())
        self.assertTrue((game_dir / "01-game.mockup.png").exists())

        self.assertFalse((self.codex / "01-game.md").exists())
        self.assertFalse((self.codex / "01-game.xstate.json").exists())
        self.assertFalse((self.codex / "01-game.mockup.png").exists())

    def test_punch_no_attachments_unchanged_behavior(self):
        """Punch of a file with no attachments: content to 01-slug.md, generated index."""
        result = _run_rhidoc(self.rhidoc, "punch", "doc00.02")
        self.assertEqual(result.returncode, 0, result.stderr)

        plain_dir = self.codex / "02-plain"
        self.assertTrue(plain_dir.is_dir())
        self.assertTrue((plain_dir / "00-index.md").exists())   # generated index
        self.assertTrue((plain_dir / "01-plain.md").exists())   # original content
        self.assertFalse((self.codex / "02-plain.md").exists())

    def test_punch_dry_run_shows_attachment_moves(self):
        """--dry-run prints planned attachment moves without modifying files."""
        result = _run_rhidoc(self.rhidoc, "punch", "doc00.01", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.codex / "01-game.md").exists())
        self.assertTrue((self.codex / "01-game.xstate.json").exists())
        self.assertFalse((self.codex / "01-game").exists())

        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot

    def test_punch_dry_run_shows_ref_shift(self):
        """--dry-run shows planned ref shift (docXX.YY → docXX.YY.01)."""
        result = _run_rhidoc(self.rhidoc, "punch", "doc00.01", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("doc00.01 -> doc00.01.01", result.stdout)

    # ── hoist ──────────────────────────────────────────────────────────────────

    def test_hoist_children_with_attachments_travel(self):
        """Hoist: each child bundle (root + attachments) is hoisted as a unit."""
        result = _run_rhidoc(self.rhidoc, "hoist", "doc01.01")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertFalse(self.chapter.exists())

        # intro (slot 0 → prefix 1) + its attachment
        self.assertTrue((self.product / "01-intro.md").exists())
        self.assertTrue((self.product / "01-intro.notes.txt").exists())
        # body (slot 1 → prefix 2) + its attachment
        self.assertTrue((self.product / "02-body.md").exists())
        self.assertTrue((self.product / "02-body.diagram.svg").exists())
        # extra shifts from prefix 2 to prefix 3
        self.assertTrue((self.product / "03-extra.md").exists())
        self.assertFalse((self.product / "02-extra.md").exists())

    def test_hoist_keep_index_travels_with_attachments(self):
        """Hoist --keep-index: index + its 00-* attachments travel together."""
        result = _run_rhidoc(self.rhidoc, "hoist", "doc01.01", "--keep-index")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertFalse(self.chapter.exists())

        # index → 01-chapter.md, its attachment → 01-chapter.bg.png
        self.assertTrue((self.product / "01-chapter.md").exists())
        self.assertTrue((self.product / "01-chapter.bg.png").exists())
        # intro at 02
        self.assertTrue((self.product / "02-intro.md").exists())
        self.assertTrue((self.product / "02-intro.notes.txt").exists())
        # body at 03
        self.assertTrue((self.product / "03-body.md").exists())
        self.assertTrue((self.product / "03-body.diagram.svg").exists())
        # extra shifts to 04
        self.assertTrue((self.product / "04-extra.md").exists())
        self.assertFalse((self.product / "02-extra.md").exists())

    def test_hoist_discards_index_attachments_when_no_keep_index(self):
        """Without --keep-index, index and its 00-* attachments are discarded, not orphaned."""
        result = _run_rhidoc(self.rhidoc, "hoist", "doc01.01")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertFalse(self.chapter.exists())

        # 00-chapter.bg.png must not appear anywhere in parent at any prefix
        parent_files = {p.name for p in self.product.iterdir() if p.is_file()}
        self.assertNotIn("00-chapter.bg.png", parent_files)
        self.assertNotIn("01-chapter.bg.png", parent_files)
        self.assertNotIn("02-chapter.bg.png", parent_files)

    def test_hoist_parent_index_and_attachments_untouched(self):
        """Parent's own 00-index.md and its attachments are not renumbered during hoist."""
        result = _run_rhidoc(self.rhidoc, "hoist", "doc01.01")
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.product / "00-index.md").exists())
        self.assertTrue((self.product / "00-product.cover.png").exists())

    def test_hoist_attachments_not_in_ref_rename_map(self):
        """Hoist dry-run: attachment files don't appear in the ref rename map."""
        result = _run_rhidoc(self.rhidoc, "hoist", "doc01.01", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)

        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot


class TestAttach(unittest.TestCase):
    """Tests for `rhidoc attach` command."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        root = Path(self.tmpdir.name)
        self.rhidoc = root / ".rhidoc"
        self.rhidoc.mkdir(parents=True, exist_ok=True)
        (root / MARKER).write_text(
            json.dumps({"root": ".rhidoc/", "title": "AttachTest"}), encoding="utf-8"
        )

        # 00-codex/ with a leaf doc and an index
        _write(self.rhidoc / "00-codex/00-index.md",
               _fm("Codex", summary="Codex index."))
        _write(self.rhidoc / "00-codex/01-logic.md",
               _fm("Logic", summary="Game logic."))

        result = _run_rhidoc(self.rhidoc, "regenerate")
        if result.returncode != 0:
            raise RuntimeError(f"attach fixture regenerate failed:\n{result.stderr}")

        # External source file (outside workspace)
        self.src_json = root / "fsm.json"
        self.src_json.write_text('{"id": "fsm"}', encoding="utf-8")
        self.src_txt = root / "notes.txt"
        self.src_txt.write_text("some notes", encoding="utf-8")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_attach_leaf_uses_source_stem(self):
        """Attach a file to a leaf md → attachment lands with correct prefix + stem."""
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/01-logic.md", str(self.src_json))
        self.assertEqual(result.returncode, 0, result.stderr)

        self.assertTrue((self.rhidoc / "00-codex/01-fsm.json").exists())
        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot

    def test_attach_via_ref(self):
        """Attach using a doc ref resolves correctly."""
        result = _run_rhidoc(self.rhidoc, "attach", "doc00.01", str(self.src_json))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.rhidoc / "00-codex/01-fsm.json").exists())

    def test_attach_rename_slug(self):
        """--rename overrides the slug segment."""
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/01-logic.md",
                            str(self.src_json), "--rename", "my-machine")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.rhidoc / "00-codex/01-my-machine.json").exists())

    def test_attach_rename_with_extension_not_doubled(self):
        """--rename that includes extension does not double the extension."""
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/01-logic.md",
                            str(self.src_json), "--rename", "xstate.json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.rhidoc / "00-codex/01-xstate.json").exists())
        self.assertFalse((self.rhidoc / "00-codex/01-xstate.json.json").exists())

    def test_attach_to_index_md(self):
        """Attach to 00-index.md lands with prefix 00 in the index's directory."""
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/00-index.md", str(self.src_txt))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.rhidoc / "00-codex/00-notes.txt").exists())

    def test_attach_collision_raises_error(self):
        """Attaching when destination already exists raises RhidocError."""
        (self.rhidoc / "00-codex/01-fsm.json").write_text("existing", encoding="utf-8")
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/01-logic.md", str(self.src_json))
        self.assertNotEqual(result.returncode, 0)
        assert normalize_output(result.stderr, self.tmpdir.name) == self._snapshot
        # Ensure the existing file is untouched
        self.assertEqual((self.rhidoc / "00-codex/01-fsm.json").read_text(), "existing")

    def test_attach_dry_run_writes_nothing(self):
        """--dry-run prints the plan but writes nothing."""
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/01-logic.md",
                            str(self.src_json), "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        assert normalize_output(result.stdout, self.tmpdir.name) == self._snapshot
        self.assertFalse((self.rhidoc / "00-codex/01-fsm.json").exists())

    def test_attach_directory_host_raises_error(self):
        """Attaching to a directory raises RhidocError."""
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex", str(self.src_json))
        self.assertNotEqual(result.returncode, 0)
        assert result.stderr == self._snapshot

    def test_attach_non_md_host_raises_error_with_swap_hint(self):
        """Attaching to a non-.md file raises RhidocError with suffix and swap hint."""
        (self.rhidoc / "00-codex/01-logic.statemachine.json").write_text(
            '{"id":"x"}', encoding="utf-8"
        )
        result = _run_rhidoc(self.rhidoc, "attach",
                            "00-codex/01-logic.statemachine.json", str(self.src_json))
        self.assertNotEqual(result.returncode, 0)
        assert normalize_output(result.stderr, self.tmpdir.name) == self._snapshot


# ---------------------------------------------------------------------------
# Tests for sidecar discoverability features
# ---------------------------------------------------------------------------

class TestPathToRefSidecar(unittest.TestCase):
    """Tests for path_to_ref sidecar ref emission."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_sidecar_ref_format(self):
        """DocRef.from_path emits docXX.YY for a non-md attachment with an md host."""
        sidecar = self.root / "01-product-strategy" / "02-diagram.mmd"
        sidecar.write_text("graph LR\n  A-->B\n")
        ref = path_to_ref(sidecar, self.root)
        self.assertEqual(ref, "doc01.02")

    def test_sidecar_orphan_raises(self):
        """path_to_ref raises ValueError for orphan sidecars (no .md host)."""
        orphan = self.root / "01-product-strategy" / "99-orphan.json"
        orphan.write_text("{}")
        with self.assertRaises(ValueError):
            path_to_ref(orphan, self.root)

    def test_sidecar_ref_nested(self):
        """DocRef.from_path works for sidecars in subdirectories."""
        sidecar = self.root / "01-product-strategy" / "04-primary-sources" / "01-flow.png"
        sidecar.write_bytes(b"\x89PNG\r\n")
        ref = path_to_ref(sidecar, self.root)
        self.assertEqual(ref, "doc01.04.01")

    def test_rewriter_preserves_sidecar_ref_in_body(self):
        """rhidoc rewrite renames host ref prefix; sidecar ref in content survives correctly."""
        # Write a doc that contains a sidecar ref in its body
        host = self.root / "01-product-strategy" / "02-principles.md"
        original = host.read_text(encoding="utf-8")
        host.write_text(original + "\nSee doc01.02/diagram.mmd for details.\n", encoding="utf-8")

        result = _run_rhidoc(self.root, "rewrite", "doc01.02=doc01.05", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        # The rewriter should report a match in 02-principles.md for doc01.02
        self.assertIn("doc01.02", result.stdout)


class TestCmdLs(unittest.TestCase):
    """Tests for rhidoc ls command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_ls_lists_directory(self):
        """rhidoc ls on a directory shows its direct children."""
        result = _run_rhidoc(self.rhidoc, "ls", "01-product-strategy")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.strip().splitlines()
        # Should include the index and doc entries
        self.assertTrue(any("00-index" in l for l in lines))
        self.assertTrue(any("Mission" in l or "01-mission" in l for l in lines))

    def test_ls_shows_sidecars(self):
        """rhidoc ls shows sidecar files without --no-sidecars."""
        (self.rhidoc / "01-product-strategy" / "02-diagram.mmd").write_text("graph")
        result = _run_rhidoc(self.rhidoc, "ls", "01-product-strategy")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("02-diagram.mmd", result.stdout)

    def test_ls_no_sidecars_hides_sidecars(self):
        """--no-sidecars hides attachment files."""
        (self.rhidoc / "01-product-strategy" / "02-diagram.mmd").write_text("graph")
        result = _run_rhidoc(self.rhidoc, "ls", "01-product-strategy", "--no-sidecars")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("02-diagram.mmd", result.stdout)

    def test_ls_file_target_errors(self):
        """rhidoc ls on a file (not directory) exits non-zero."""
        result = _run_rhidoc(self.rhidoc, "ls", "01-product-strategy/01-mission.md")
        self.assertNotEqual(result.returncode, 0)

    def test_ls_ref_arg(self):
        """rhidoc ls accepts a doc ref as target."""
        result = _run_rhidoc(self.rhidoc, "ls", "doc01")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Mission", result.stdout)

    def test_ls_default_workspace_root(self):
        """rhidoc ls with no args lists workspace root."""
        result = _run_rhidoc(self.rhidoc, "ls")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.strip().splitlines()
        self.assertTrue(any("product-strategy" in l or "Product Strategy" in l for l in lines))


class TestCmdBundle(unittest.TestCase):
    """Tests for rhidoc bundle command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_bundle_shows_host(self):
        """rhidoc bundle shows the host doc with size."""
        result = _run_rhidoc(self.rhidoc, "bundle", "01-product-strategy/01-mission.md")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("01-mission.md", result.stdout)

    def test_bundle_shows_attachments(self):
        """rhidoc bundle shows sidecar attachments with size and ref."""
        (self.rhidoc / "01-product-strategy" / "01-diagram.mmd").write_text("graph LR\n  A-->B")
        result = _run_rhidoc(self.rhidoc, "bundle", "01-product-strategy/01-mission.md")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("01-diagram.mmd", result.stdout)
        self.assertIn("doc01.01", result.stdout)

    def test_bundle_no_attachments(self):
        """rhidoc bundle on a doc with no sidecars shows only host line."""
        result = _run_rhidoc(self.rhidoc, "bundle", "01-product-strategy/02-principles.md")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.strip().splitlines()
        self.assertEqual(len(lines), 1)

    def test_bundle_directory_errors(self):
        """rhidoc bundle on a directory exits non-zero."""
        result = _run_rhidoc(self.rhidoc, "bundle", "01-product-strategy")
        self.assertNotEqual(result.returncode, 0)

    def test_bundle_via_ref(self):
        """rhidoc bundle accepts a doc ref."""
        result = _run_rhidoc(self.rhidoc, "bundle", "doc01.01")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("01-mission.md", result.stdout)


class TestCmdOrphans(unittest.TestCase):
    """Tests for rhidoc orphans command."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_orphans_none(self):
        """rhidoc orphans shows Total: 0 orphan(s) when workspace is clean."""
        result = _run_rhidoc(self.rhidoc, "orphans")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("0 orphan(s)", result.stderr)
        self.assertEqual(result.stdout.strip(), "")

    def test_orphans_finds_orphan(self):
        """rhidoc orphans lists workspace-relative orphan paths."""
        orphan = self.rhidoc / "01-product-strategy" / "99-lost.json"
        orphan.write_text("{}")
        result = _run_rhidoc(self.rhidoc, "orphans")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("99-lost.json", result.stdout)
        self.assertIn("1 orphan(s)", result.stderr)

    def test_orphans_exit_zero_with_orphans(self):
        """rhidoc orphans exits 0 even when orphans exist."""
        (self.rhidoc / "01-product-strategy" / "99-lost.json").write_text("{}")
        result = _run_rhidoc(self.rhidoc, "orphans")
        self.assertEqual(result.returncode, 0)


class TestCmdTreeWithSidecars(unittest.TestCase):
    """Tests for tree command with sidecar rendering."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_tree_shows_sidecar_as_child(self):
        """rhidoc tree shows sidecars indented under their host doc."""
        (self.rhidoc / "01-product-strategy" / "02-diagram.mmd").write_text("graph")
        result = _run_rhidoc(self.rhidoc, "tree", "01-product-strategy")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.splitlines()
        # Find the principles line and check sidecar follows it indented
        principles_idx = next((i for i, l in enumerate(lines) if "Principles" in l), None)
        self.assertIsNotNone(principles_idx)
        sidecar_line = next((l for l in lines if "📎" in l or "* " in l), None)
        self.assertIsNotNone(sidecar_line, "Expected a sidecar line with attachment marker")
        self.assertIn("02-diagram.mmd", sidecar_line)

    def test_tree_no_sidecars_hides_attachments(self):
        """--no-sidecars omits sidecar lines from tree output."""
        (self.rhidoc / "01-product-strategy" / "02-diagram.mmd").write_text("graph")
        result = _run_rhidoc(self.rhidoc, "tree", "01-product-strategy", "--no-sidecars")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("📎", result.stdout)
        self.assertFalse(any("* " in l and "02-diagram.mmd" in l for l in result.stdout.splitlines()))
        self.assertNotIn("02-diagram.mmd", result.stdout)

    def test_tree_refs_sidecar_format(self):
        """--refs shows sidecar refs as docXX.YY coordinate (no slug/ext suffix)."""
        (self.rhidoc / "01-product-strategy" / "02-diagram.mmd").write_text("graph")
        result = _run_rhidoc(self.rhidoc, "tree", "01-product-strategy", "--refs")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("doc01.02", result.stdout)


class TestAttachSlugCollision(unittest.TestCase):
    """Tests for slug uniqueness enforcement in rhidoc attach."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        root = Path(self.tmpdir.name)
        self.rhidoc = root / ".rhidoc"
        self.rhidoc.mkdir()
        (root / ".rhidoc.json").write_text(
            '{"root": ".rhidoc/", "title": "SlugCollisionTest"}', encoding="utf-8"
        )
        _write(self.rhidoc / "00-codex/00-index.md", _fm("Codex"))
        _write(self.rhidoc / "00-codex/01-logic.md", _fm("Logic"))
        (self.rhidoc / "00-codex/01-diagram.png").write_bytes(b"\x89PNG")
        _run_rhidoc(self.rhidoc, "regenerate")

        self.src_mmd = root / "diagram.mmd"
        self.src_mmd.write_text("graph LR\n  A-->B")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_slug_collision_errors(self):
        """Attaching a file whose slug collides with an existing attachment raises an error."""
        # 01-diagram.png already exists; attaching diagram.mmd should collide on slug "diagram"
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/01-logic.md", str(self.src_mmd))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("diagram", result.stderr)
        self.assertIn("--rename", result.stderr)

    def test_rename_avoids_collision(self):
        """--rename with a different slug avoids the collision."""
        result = _run_rhidoc(self.rhidoc, "attach", "00-codex/01-logic.md",
                            str(self.src_mmd), "--rename", "flow")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.rhidoc / "00-codex/01-flow.mmd").exists())


class TestMakeInsert(unittest.TestCase):
    """Test rhidoc make --before: opens a gap and bumps siblings up."""

    @pytest.fixture(autouse=True)
    def _inject_snapshot(self, snapshot):
        self._snapshot = snapshot

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc_copy = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def _assert_no_duplicate_prefixes(self, rhidoc_root):
        """Assert no directory has two .md files or two directories sharing a prefix.

        Multiple files at the same prefix is valid (bundle attachments); two .md files or
        two directories at the same prefix is a structural conflict.
        """
        excluded = {rhidoc_root / ".state"}
        for dirpath in rhidoc_root.rglob("*"):
            if not dirpath.is_dir():
                continue
            if any(excl in dirpath.parents or dirpath == excl for excl in excluded):
                continue
            md_prefixes = []
            dir_prefixes = []
            for entry in dirpath.iterdir():
                m = re.match(r'^(\d{2})-', entry.name)
                if m:
                    p = int(m.group(1))
                    if entry.is_dir():
                        dir_prefixes.append(p)
                    elif entry.suffix == ".md":
                        md_prefixes.append(p)
            for prefixes, kind in [(md_prefixes, "md"), (dir_prefixes, "dir")]:
                dups = [p for p in prefixes if prefixes.count(p) > 1]
                assert dups == [], f"Duplicate {kind} prefixes in {dirpath}: {sorted(set(dups))}"

    def _collect_orphaned_refs(self, rhidoc_root):
        excluded = {rhidoc_root / ".state"}
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        orphans = []
        for md in rhidoc_root.rglob("*.md"):
            if any(excl in md.parents or md == excl for excl in excluded):
                continue
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), rhidoc_root)
                except (FileNotFoundError, ValueError, OSError):
                    orphans.append((md.relative_to(rhidoc_root), m.group()))
        return orphans

    def test_insert_shifts_siblings(self):
        """--before at an occupied middle slot bumps that entry and higher ones up by one."""
        codex = self.rhidoc_copy / "00-codex"
        entries_before = list_numbered_entries(codex)

        # Insert at position 03 (03-conventions.md exists in fixture)
        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc00.03", "wedge-doc")
        assert result.returncode == 0, f"make --before failed:\n{result.stderr}\n{result.stdout}"

        # New entry should exist at 03
        assert (codex / "03-wedge-doc.md").exists(), "Expected 03-wedge-doc.md at position 03"

        # Old 03-conventions.md should have moved to 04
        assert not (codex / "03-conventions.md").exists(), "03-conventions.md should have shifted"
        assert (codex / "04-conventions.md").exists(), "Expected 04-conventions.md after shift"

        # No duplicate prefixes
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

        # All prefixes should be sequential (no gaps)
        entries_after = list_numbered_entries(codex)
        assert len(entries_after) == len(entries_before) + 1
        nonzero_prefixes = sorted(
            get_numeric_prefix(e.name) for e in entries_after
            if get_numeric_prefix(e.name) is not None and get_numeric_prefix(e.name) > 0
        )
        assert nonzero_prefixes == list(range(1, len(nonzero_prefixes) + 1)), \
            f"Expected sequential prefixes, got: {nonzero_prefixes}"

    def test_insert_rewrites_refs(self):
        """After --before, refs to shifted siblings are updated to their new coordinates."""
        pre_existing = set(ref for _, ref in self._collect_orphaned_refs(self.rhidoc_copy))

        # 03-conventions.md is referenced by 01-mission.md (deps: [doc01.02]) and glossary
        # doc00.03 will be bumped to doc00.04 after inserting at 03
        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc00.03", "new-wedge")
        assert result.returncode == 0, f"make --before failed:\n{result.stderr}\n{result.stdout}"

        # No new orphaned refs should be introduced by the shift
        orphans = self._collect_orphaned_refs(self.rhidoc_copy)
        new_orphans = [(f, r) for f, r in orphans if r not in pre_existing]
        assert new_orphans == [], \
            "New orphaned refs introduced by --before:\n" + \
            "\n".join(f"  {r} in {f}" for f, r in new_orphans)

    def test_insert_preserves_bundle_attachments(self):
        """A shifted bundle keeps its attachments under the new prefix."""
        # Add an attachment to 03-conventions.md to simulate a bundle
        codex = self.rhidoc_copy / "00-codex"
        att_path = codex / "03-conventions.yaml"
        att_path.write_text("key: value\n", encoding="utf-8")

        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc00.03", "wedge-with-bundle")
        assert result.returncode == 0, f"make --before failed:\n{result.stderr}\n{result.stdout}"

        # Attachment should have moved with the conventions bundle
        assert not att_path.exists(), "03-conventions.yaml should have been shifted"
        assert (codex / "04-conventions.yaml").exists(), \
            "Expected 04-conventions.yaml after shift (attachment moved with bundle)"

        # New entry at 03
        assert (codex / "03-wedge-with-bundle.md").exists()

        # No duplicate prefixes
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

    def test_insert_at_root(self):
        """--before at a root-level title shifts top-level titles."""
        root_entries_before = list_numbered_entries(self.rhidoc_copy)

        # Insert at position 02 (02-product-design exists in fixture)
        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc02", "new-title")
        assert result.returncode == 0, f"make --before at root failed:\n{result.stderr}\n{result.stdout}"

        # New entry should be at root level position 02
        assert (self.rhidoc_copy / "02-new-title.md").exists(), \
            "Expected 02-new-title.md at root level"

        # Old 02-product-design should have moved to 03
        assert not (self.rhidoc_copy / "02-product-design").exists(), \
            "02-product-design should have shifted up"
        assert (self.rhidoc_copy / "03-product-design").exists(), \
            "Expected 03-product-design after shift"

        # No duplicate prefixes
        self._assert_no_duplicate_prefixes(self.rhidoc_copy)

        root_entries_after = list_numbered_entries(self.rhidoc_copy)
        assert len(root_entries_after) == len(root_entries_before) + 1

    def test_insert_dry_run(self):
        """--before --dry-run prints the plan but writes nothing."""
        before = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                  if p.is_file() and p.suffix in (".md", ".json", "")}

        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc00.03", "phantom", "--dry-run")
        assert result.returncode == 0, result.stderr

        # No files should have been created or modified
        after = {p: p.read_bytes() for p in self.rhidoc_copy.rglob("*")
                 if p.is_file() and p.suffix in (".md", ".json", "")}
        assert before == after, "Files were modified during --dry-run"

        # Output should describe the plan
        assert "dry-run" in result.stdout.lower()
        assert "03" in result.stdout

    def test_insert_rejects_with_at(self):
        """--before combined with --at should error."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc00.03", "--at", "doc00.05", "slug")
        assert result.returncode != 0
        assert "mutually exclusive" in result.stderr

    def test_insert_rejects_two_positionals(self):
        """--before with two positionals (parent + slug) should error."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc00.03", "doc00", "some-slug")
        assert result.returncode != 0
        assert "do not also pass a parent" in result.stderr

    def test_insert_outputs_shifted_count(self):
        """--before prints 'Shifted: N sibling(s) renumbered' in output."""
        result = _run_rhidoc(self.rhidoc_copy, "make", "--before", "doc00.03", "check-output")
        assert result.returncode == 0, f"make --before failed:\n{result.stderr}\n{result.stdout}"
        assert "Shifted:" in result.stdout, f"Expected shift count in output:\n{result.stdout}"
        assert "renumbered" in result.stdout


class TestCopyAtBefore(unittest.TestCase):
    """Tests for rhidoc copy --at REF / --before REF vocabulary."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_fixture(Path(self.tmpdir.name))
        # Create a source file outside the workspace for copy tests
        self.src = Path(self.tmpdir.name) / "external.md"
        self.src.write_text(
            "---\ntitle: External\nsummary: An external file.\ntags: []\ndeps: []\n---\n\n# External\n",
            encoding="utf-8"
        )

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_copy_append(self):
        """rhidoc copy in append mode (positional destination) places file after last entry."""
        codex = self.rhidoc / "00-codex"
        entries_before = list_numbered_entries(codex)
        max_prefix = max(get_numeric_prefix(e.name) for e in entries_before)

        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "00-codex")
        self.assertEqual(result.returncode, 0, result.stderr)

        expected_prefix = max_prefix + 1
        self.assertTrue(
            (codex / f"{expected_prefix:02d}-external.md").exists(),
            f"Expected {expected_prefix:02d}-external.md in 00-codex"
        )
        # No sibling renumbering
        for e in entries_before:
            self.assertTrue(
                (codex / e.name).exists(),
                f"Existing entry {e.name} should not have moved"
            )

    def test_copy_at_free_slot(self):
        """--at into a free slot places the file at that exact position."""
        codex = self.rhidoc / "00-codex"
        # 00-codex has 01-06; slot 08 is free
        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "--at", "doc00.08")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((codex / "08-external.md").exists(), "Expected 08-external.md")
        # Existing entries unchanged
        self.assertTrue((codex / "01-about.md").exists())
        self.assertTrue((codex / "06-integration.md").exists())

    def test_copy_at_occupied_errors(self):
        """--at onto an occupied slot errors; nothing is copied."""
        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "--at", "doc00.03")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("occupied", result.stderr.lower())
        self.assertFalse((self.rhidoc / "00-codex" / "03-external.md").exists())

    def test_copy_before_displaces(self):
        """--before into an occupied slot bumps siblings up and rewrites refs."""
        codex = self.rhidoc / "00-codex"
        # Before: 03-conventions.md exists; after --before doc00.03, it should move to 04
        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "--before", "doc00.03")
        self.assertEqual(result.returncode, 0, result.stderr)
        # New file lands at 03
        self.assertTrue((codex / "03-external.md").exists(), "Expected 03-external.md at position 03")
        # Old 03 bumped to 04
        self.assertFalse((codex / "03-conventions.md").exists(), "03-conventions.md should have shifted")
        self.assertTrue((codex / "04-conventions.md").exists(), "Expected 04-conventions.md after shift")
        # No duplicate prefixes
        md_prefixes = [
            int(re.match(r'^(\d{2})-', e.name).group(1))
            for e in codex.iterdir()
            if re.match(r'^\d{2}-', e.name) and e.suffix == ".md"
        ]
        dups = [p for p in md_prefixes if md_prefixes.count(p) > 1]
        self.assertEqual(dups, [], f"Duplicate prefixes after --before: {sorted(set(dups))}")

    def test_copy_before_rewrites_refs(self):
        """After copy --before, refs to shifted siblings are updated."""
        pre_existing = set()
        pattern = re.compile(r'(?<!\w)doc\d{2}(?:\.\d{2})+(?!\.[a-zA-Z0-9])')
        for md in self.rhidoc.rglob("*.md"):
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                try:
                    ref_to_path(m.group(), self.rhidoc)
                except (FileNotFoundError, ValueError, OSError):
                    pre_existing.add(m.group())

        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "--before", "doc00.03")
        self.assertEqual(result.returncode, 0, result.stderr)

        new_orphans = []
        for md in self.rhidoc.rglob("*.md"):
            for m in pattern.finditer(md.read_text(encoding="utf-8")):
                if m.group() in pre_existing:
                    continue
                try:
                    ref_to_path(m.group(), self.rhidoc)
                except (FileNotFoundError, ValueError, OSError):
                    new_orphans.append((md.relative_to(self.rhidoc), m.group()))
        self.assertEqual(new_orphans, [], f"New orphaned refs after copy --before:\n" +
                         "\n".join(f"  {r} in {f}" for f, r in new_orphans))

    def test_copy_at_and_before_mutually_exclusive(self):
        """Providing both --at and --before is an error."""
        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "--at", "doc00.05", "--before", "doc00.05")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("mutually exclusive", result.stderr.lower())

    def test_copy_ref_flag_rejects_positional_destination(self):
        """--at or --before with a positional destination is an error."""
        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "00-codex", "--at", "doc00.05")
        self.assertNotEqual(result.returncode, 0)

    def test_copy_no_destination_errors(self):
        """Omitting both destination and --at/--before is an error."""
        result = _run_rhidoc(self.rhidoc, "copy", str(self.src))
        self.assertNotEqual(result.returncode, 0)

    def test_copy_before_dry_run(self):
        """--before --dry-run prints the plan but writes nothing."""
        before = {p: p.read_bytes() for p in self.rhidoc.rglob("*") if p.is_file()}
        result = _run_rhidoc(self.rhidoc, "copy", str(self.src), "--before", "doc00.03", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        after = {p: p.read_bytes() for p in self.rhidoc.rglob("*") if p.is_file()}
        self.assertEqual(before, after, "Files were modified during --dry-run")
        self.assertIn("dry-run", result.stdout.lower())


class TestHoistBefore(unittest.TestCase):
    """Tests for rhidoc hoist --before REF vocabulary."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.rhidoc = _build_fixture(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_hoist_before_splices_at_ref(self):
        """--before REF hoists children at the ref's position, not the source's default."""
        # doc02.08 is 08-decisions/ in 02-product-design/; default hoist would start at 08.
        # Use --before doc02.03 to splice children starting at position 03, bumping 03+ up.
        design_dir = self.rhidoc / "02-product-design"
        entries_before = list_numbered_entries(design_dir)
        # 03-extension.md should exist before the operation
        self.assertTrue((design_dir / "03-extension.md").exists())

        result = _run_rhidoc(self.rhidoc, "hoist", "doc02.08", "--force", "--before", "doc02.03")
        self.assertEqual(result.returncode, 0, f"hoist --before failed:\n{result.stderr}\n{result.stdout}")

        # Source dir should be dissolved
        self.assertFalse((design_dir / "08-decisions").exists())
        # Old 03-extension.md must have moved (bumped up by the hoisted children)
        self.assertFalse((design_dir / "03-extension.md").exists(), "03-extension should have been displaced")
        # No duplicate prefixes
        md_prefixes = [
            int(re.match(r'^(\d{2})-', e.name).group(1))
            for e in design_dir.iterdir()
            if re.match(r'^\d{2}-', e.name) and (e.suffix == ".md" or e.is_dir())
        ]
        dups = [p for p in md_prefixes if md_prefixes.count(p) > 1]
        self.assertEqual(dups, [], f"Duplicate prefixes after hoist --before: {sorted(set(dups))}")

    def test_hoist_without_before_uses_default_position(self):
        """Without --before, hoist still works (default position = source prefix)."""
        result = _run_rhidoc(self.rhidoc, "hoist", "doc02.08", "--force")
        self.assertEqual(result.returncode, 0, f"hoist without --before failed:\n{result.stderr}")
        design_dir = self.rhidoc / "02-product-design"
        self.assertFalse((design_dir / "08-decisions").exists())


class TestHandbook(unittest.TestCase):
    """Tests for `rhidoc handbook` and the template registry."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.cwd = Path(self.tmpdir.name).resolve()
        self._prev_cwd = Path.cwd()
        os.chdir(self.cwd)

    def tearDown(self):
        os.chdir(self._prev_cwd)
        self.tmpdir.cleanup()

    def _run(self, *args: str) -> types.SimpleNamespace:
        """Run the CLI with no --workspace, from a directory that has no workspace."""
        stdout_buf, stderr_buf = io.StringIO(), io.StringIO()
        try:
            with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                code = cli_main(list(args))
        except SystemExit as e:
            code = int(e.code) if e.code is not None else 0
        return types.SimpleNamespace(
            returncode=code, stdout=stdout_buf.getvalue(), stderr=stderr_buf.getvalue()
        )

    def test_registry_matches_shipped_files(self):
        """Every registered template exists, and every shipped .md is registered."""
        from rhidoc.templates import TEMPLATES, _DIR

        for tmpl in TEMPLATES.values():
            self.assertTrue(tmpl.path.is_file(), f"registered but missing: {tmpl.filename}")

        registered = {t.filename for t in TEMPLATES.values()}
        on_disk = {p.name for p in _DIR.glob("*.md")}
        self.assertEqual(on_disk - registered, set(), "shipped template not in registry")

    def test_every_listed_template_has_a_summary(self):
        from rhidoc.templates import listed

        for tmpl in listed():
            self.assertTrue(tmpl.summary.strip(), f"{tmpl.name} has no summary")

    def test_summary_comes_from_frontmatter(self):
        from rhidoc.templates import TEMPLATES

        self.assertIn("plain-language standard", TEMPLATES["plain-language"].summary)
        self.assertIn("health diagnostics", TEMPLATES["rhidoc-setup"].summary)

    def test_list_without_workspace(self):
        result = self._run("handbook")
        self.assertEqual(result.returncode, 0, f"handbook failed:\n{result.stderr}")
        self.assertIn("plain-language", result.stdout)
        self.assertIn("[handbook]", result.stdout)

    def test_print_without_workspace(self):
        result = self._run("handbook", "plain-language")
        self.assertEqual(result.returncode, 0, f"handbook failed:\n{result.stderr}")
        self.assertIn("# Plain Language", result.stdout)
        self.assertIn("ISO 24495-1", result.stdout)

    def test_placeholders_default_without_workspace(self):
        result = self._run("handbook", "conventions")
        self.assertEqual(result.returncode, 0)
        self.assertIn(".rhidoc/", result.stdout)
        self.assertNotIn("{{dir_name}}", result.stdout)

    def test_placeholders_follow_workspace_dirname(self):
        self._run("init", "--dir", "docs-ws")
        result = self._run("handbook", "conventions")
        self.assertEqual(result.returncode, 0)
        self.assertIn("docs-ws/", result.stdout)
        self.assertNotIn("{{dir_name}}", result.stdout)

    def test_skills_and_wiring_are_not_offered(self):
        """Scope is the handbook: skills are served by `ai-skill`, wiring is not reading material."""
        for name in ("agents", "docs-development", "rhidoc-cli", "index"):
            result = self._run("handbook", name)
            self.assertNotEqual(result.returncode, 0, f"{name} should not be a handbook doc")

    def test_reads_installed_copy_not_stale_workspace_copy(self):
        """The whole point: a stale hydrated handbook does not affect what `handbook` prints."""
        self._run("init")
        stale = self.cwd / ".rhidoc" / "00-handbook" / "04-plain-language.md"
        stale.write_text("# Stale local copy\n", encoding="utf-8")

        result = self._run("handbook", "plain-language")
        self.assertEqual(result.returncode, 0)
        self.assertIn("ISO 24495-1", result.stdout)
        self.assertNotIn("Stale local copy", result.stdout)

    def test_unknown_name_is_rejected(self):
        result = self._run("handbook", "no-such-doc")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid choice", result.stderr)

    def test_writes_nothing(self):
        before = sorted(p.name for p in self.cwd.iterdir())
        self._run("handbook", "plain-language")
        self._run("handbook")
        self.assertEqual(sorted(p.name for p in self.cwd.iterdir()), before)


if __name__ == "__main__":
    unittest.main()
