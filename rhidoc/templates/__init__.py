"""The template files shipped with rhidoc, and the registry that names them.

`init` writes these into a workspace; `rhidoc handbook` prints the handbook docs to
stdout for agents in repos that have no workspace, or whose hydrated copies are out of
date. Both go through this module, so the shipped copy is the only copy.
"""
from dataclasses import dataclass
from enum import Enum
from functools import cache
from pathlib import Path

from ..frontmatter import read_frontmatter

_DIR = Path(__file__).resolve().parent

HANDBOOK_DIR = "00-handbook"


class Kind(Enum):
    """Where a template lands when `init` hydrates it."""
    HANDBOOK = "handbook"
    AGENTS = "agents"
    SKILL = "skill"


@dataclass(frozen=True)
class Template:
    name: str
    filename: str
    kind: Kind
    rehydrate: bool = True
    listed: bool = True

    @property
    def path(self) -> Path:
        return _DIR / self.filename

    def read(self) -> str:
        return self.path.read_text(encoding="utf-8")

    @property
    def summary(self) -> str:
        return _summary(self.filename)


@cache
def _summary(filename: str) -> str:
    """The template's own summary line: `summary` for handbook docs, `description` for skills."""
    fm, _ = read_frontmatter(_DIR / filename)
    return str(fm.get("summary") or fm.get("description") or "")


TEMPLATES: dict[str, Template] = {
    t.name: t
    for t in (
        # 00-index's body is a generated artifact — regenerate rewrites it, so rehydrate
        # must not clobber it with the template.
        Template("index", "00-index.md", Kind.HANDBOOK, rehydrate=False, listed=False),
        Template("about", "01-about.md", Kind.HANDBOOK),
        Template("maintenance", "02-maintenance.md", Kind.HANDBOOK),
        Template("conventions", "03-conventions.md", Kind.HANDBOOK),
        Template("plain-language", "04-plain-language.md", Kind.HANDBOOK),
        Template("controlled-vocabulary", "05-controlled-vocabulary.md", Kind.HANDBOOK),
        Template("drift", "06-drift.md", Kind.HANDBOOK),
        Template("agents", "AGENTS.md", Kind.AGENTS),
        Template("rhidoc-cli", "skill.md", Kind.SKILL),
        Template("docs-development", "docs-development-skill.md", Kind.SKILL),
        Template("rhidoc-setup", "rhidoc-setup-skill.md", Kind.SKILL),
    )
}


def by_kind(kind: Kind) -> list[Template]:
    return [t for t in TEMPLATES.values() if t.kind is kind]


def listed() -> list[Template]:
    """The handbook docs a reader can ask for by name — the `rhidoc handbook` surface.

    Skills are served by `rhidoc ai-skill` and the agent wiring is not reading material,
    so neither is offered here.
    """
    return [t for t in by_kind(Kind.HANDBOOK) if t.listed]


def data_files() -> list[str]:
    """Template paths relative to the package dir, for `portable` to copy."""
    return [f"templates/{t.filename}" for t in TEMPLATES.values()]


def render(name: str, *, dir_name: str = ".rhidoc", title: str = "") -> str:
    return TEMPLATES[name].read().replace("{{dir_name}}", dir_name).replace("{{title}}", title)
