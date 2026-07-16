"""The template files shipped with rhidoc, and the registry that names them.

`init` writes these into a workspace; `rhidoc templates` prints them to stdout for
agents in repos that have no workspace, or whose hydrated copies are out of date.
Both go through this module, so the shipped copy is the only copy.
"""
from dataclasses import dataclass
from enum import Enum
from functools import cache
from pathlib import Path

from ..frontmatter import read_frontmatter

_DIR = Path(__file__).resolve().parent


class Kind(Enum):
    """Where a template lands when `init` hydrates it."""
    CODEX = "codex"
    AGENTS = "agents"
    SKILL = "skill"


@dataclass(frozen=True)
class Template:
    name: str
    filename: str
    kind: Kind
    rehydrate: bool = True
    listed: bool = True
    # Read from frontmatter when the file has any; these two do not.
    fallback_summary: str = ""

    @property
    def path(self) -> Path:
        return _DIR / self.filename

    def read(self) -> str:
        return self.path.read_text(encoding="utf-8")

    @property
    def summary(self) -> str:
        return _summary(self.filename) or self.fallback_summary


@cache
def _summary(filename: str) -> str:
    """The template's own summary line: `summary` for codex docs, `description` for skills."""
    fm, _ = read_frontmatter(_DIR / filename)
    return str(fm.get("summary") or fm.get("description") or "")


TEMPLATES: dict[str, Template] = {
    t.name: t
    for t in (
        # 00-index's body is a generated artifact — regenerate rewrites it, so rehydrate
        # must not clobber it with the template.
        Template("index", "00-index.md", Kind.CODEX, rehydrate=False, listed=False),
        Template("about", "01-about.md", Kind.CODEX),
        Template("maintenance", "02-maintenance.md", Kind.CODEX),
        Template("conventions", "03-conventions.md", Kind.CODEX),
        Template("plain-language", "04-plain-language.md", Kind.CODEX),
        Template("controlled-vocabulary", "05-controlled-vocabulary.md", Kind.CODEX),
        Template("drift", "06-drift.md", Kind.CODEX),
        Template(
            "agents", "AGENTS.md", Kind.AGENTS,
            fallback_summary="How to navigate and edit a Rhidoc workspace — the four rules for agents",
        ),
        # A header fragment, not a whole skill: ai_skill.generate_skill_content appends the
        # command reference to it. `rhidoc ai-skill` is how you read the finished article.
        Template("rhidoc-cli", "skill.md", Kind.SKILL, listed=False),
        Template("docs-development", "docs-development-skill.md", Kind.SKILL),
        Template("rhidoc-setup", "rhidoc-setup-skill.md", Kind.SKILL),
    )
}


def by_kind(kind: Kind) -> list[Template]:
    return [t for t in TEMPLATES.values() if t.kind is kind]


def listed() -> list[Template]:
    return [t for t in TEMPLATES.values() if t.listed]


def data_files() -> list[str]:
    """Template paths relative to the package dir, for `portable` to copy."""
    return [f"templates/{t.filename}" for t in TEMPLATES.values()]


def render(name: str, *, dir_name: str = ".rhidoc", title: str = "") -> str:
    return TEMPLATES[name].read().replace("{{dir_name}}", dir_name).replace("{{title}}", title)
