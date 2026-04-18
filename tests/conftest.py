"""Shared test helpers and fixtures for the carta_cli test suite."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

_CLI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_CLI_DIR))

from carta_cli.workspace import MARKER

_ENV_WITH_CLI = {**os.environ, "PYTHONPATH": str(_CLI_DIR)}


def _fm(
    title: str,
    status: str = "active",
    summary: str = "",
    tags: list[str] | None = None,
    deps: list[str] | None = None,
) -> str:
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
    path.parent.mkdir(parents=True, exist_ok=True)
    content = fm + ("\n" + body if body else "")
    path.write_text(content, encoding="utf-8")


def _build_fixture(dest: Path) -> Path:
    """Build a synthetic .carta/ workspace for testing. Returns dest/.carta/."""
    carta = dest / ".carta"
    carta.mkdir(parents=True, exist_ok=True)

    (dest / MARKER).write_text(
        json.dumps({"root": ".carta/", "title": "TestFixture"}), encoding="utf-8"
    )

    # 00-codex/
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

    # 01-product-strategy/
    _write(carta / "01-product-strategy/00-index.md",
           _fm("Product Strategy", summary="Product strategy index.", tags=["index", "strategy"]))
    _write(carta / "01-product-strategy/01-mission.md",
           _fm("Mission", summary="Core goal.", tags=["mission", "principles"], deps=["doc01.02"]))
    _write(carta / "01-product-strategy/02-principles.md",
           _fm("Principles", summary="Design principles.", tags=["principles", "design"]))
    _write(carta / "01-product-strategy/03-glossary.md",
           _fm("Glossary", summary="Canonical vocabulary.", tags=["glossary", "terms"], deps=["doc01.02"]))

    # 01-product-strategy/04-primary-sources/
    _write(carta / "01-product-strategy/04-primary-sources/00-index.md",
           _fm("Primary Sources", summary="Author's original writings.", tags=["inspiration", "vision"]))
    _write(carta / "01-product-strategy/04-primary-sources/01-experiment.md",
           _fm("The Carta Experiment", summary="Artifact-driven development.", tags=["AI", "coding"]))
    _write(carta / "01-product-strategy/04-primary-sources/02-foundations.md",
           _fm("Theoretical Foundations", summary="Why spec-driven development works.", tags=["spec-driven", "AI"]))
    _write(carta / "01-product-strategy/04-primary-sources/03-unfolding.md",
           _fm("Unfolding as Development", summary="Embryonic development applied to software.", tags=["unfolding", "methodology"]))

    # 02-product-design/
    _write(carta / "02-product-design/00-index.md",
           _fm("Product Design", summary="Product design index.", tags=["index", "design"]))
    _write(carta / "02-product-design/01-workspace-scripts.md",
           _fm("Workspace Scripts", summary="Design details for the Carta Docs API.", tags=["docs-api", "workspace", "tools"]))
    _write(carta / "02-product-design/02-cli-flow.md",
           _fm("CLI User Flow", summary="How users install the carta CLI.", tags=["cli", "workflow"]))
    _write(carta / "02-product-design/03-extension.md",
           _fm("VSCode Extension", summary="Canvas viewer and workspace browser.", tags=["vscode", "extension"]))

    # 02-product-design/04-web-platform/
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

    # 02-product-design/08-decisions/
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

    # 03-architecture/
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

    result = _run_carta(carta, "regenerate")
    if result.returncode != 0:
        raise RuntimeError(f"fixture regenerate failed:\n{result.stderr}")

    return carta


def _run_carta(carta_copy: Path, *args: str) -> subprocess.CompletedProcess:
    """Run the carta CLI against a workspace root."""
    return subprocess.run(
        [sys.executable, "-m", "carta_cli.main", "--workspace", str(carta_copy)] + list(args),
        capture_output=True, text=True, env=_ENV_WITH_CLI,
    )


@pytest.fixture
def carta_fixture(tmp_path):
    """Build a synthetic .carta/ workspace and return its root."""
    return _build_fixture(tmp_path)
