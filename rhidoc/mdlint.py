"""mdlint.py — Deterministic lint checks for mdapi write verbs.

Lint is folded into insert and set-body; it is NOT a standalone command.
All patterns are factored here as the single source of truth.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from .mdtree import MdNode

LintViolationKind = Literal["word-cap", "line-cap", "banned-pattern", "duplicate-body"]

# Per-node body_text caps.  Tune by changing these constants.
WORD_CAP: int = 200
LINE_CAP: int = 40

# doc00.06 banned-pattern catalog.
# Each entry is (name, compiled_pattern), case-insensitive, matched against body_text.
BANNED_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # Future modals — docs must describe current intent, not future plans
    (
        "future-modal",
        re.compile(r"\b(will|shall)\b", re.IGNORECASE),
    ),
    # Phase / version language — docs must not reference development phases
    (
        "phase-language",
        re.compile(r"\b(phase\s+\d+|version\s+\d|v\d+\.\d+)\b", re.IGNORECASE),
    ),
    # Deferral language — docs must not defer decisions to a later point
    (
        "deferral-language",
        re.compile(
            r"\b(TODO|TBD|to[ -]be[ -](determined|defined|implemented)|"
            r"future work|deferred|to[ -]do)\b",
            re.IGNORECASE,
        ),
    ),
    # Dated postscripts — docs must not embed dates that will become stale
    (
        "dated-postscript",
        re.compile(
            r"\b(as of \w+ \d{4}|updated \w+ \d{4}|last updated|"
            r"as of \d{4}-\d{2})\b",
            re.IGNORECASE,
        ),
    ),
    # Retrospective framing — docs must not record past decisions as narrative
    (
        "retrospective-framing",
        re.compile(
            r"\b(we (decided|chose|opted|determined|agreed|concluded))\b",
            re.IGNORECASE,
        ),
    ),
    # Volatile snapshots — docs must not describe transient current state
    (
        "volatile-snapshot",
        re.compile(
            r"\b(currently|at the time of writing|as of this writing|at present|"
            r"at this (time|point|moment))\b",
            re.IGNORECASE,
        ),
    ),
    # Open-questions sections — open questions go to the user or the task tracker
    (
        "open-question",
        re.compile(r"\bopen questions?\b", re.IGNORECASE),
    ),
    # Rename narration — the old name lives in git, not in the doc
    (
        "rename-narration",
        re.compile(
            r"\b(renamed from|formerly|previously (called|named|known as))\b",
            re.IGNORECASE,
        ),
    ),
]


@dataclass
class LintViolation:
    kind: LintViolationKind
    address: str   # node address
    detail: str    # human-readable description

    def format(self) -> str:
        return f"lint [{self.kind}] @{self.address}: {self.detail}"


def lint_node(node: "MdNode") -> list[LintViolation]:
    """Check one node's body_text for word/line caps and banned patterns."""
    violations: list[LintViolation] = []
    addr = node.address
    text = node.body_text

    word_count = len(text.split())
    if word_count > WORD_CAP:
        violations.append(LintViolation(
            kind="word-cap",
            address=addr,
            detail=f"body_text has {word_count} words (cap: {WORD_CAP})",
        ))

    line_count = len(text.splitlines())
    if line_count > LINE_CAP:
        violations.append(LintViolation(
            kind="line-cap",
            address=addr,
            detail=f"body_text has {line_count} lines (cap: {LINE_CAP})",
        ))

    for name, pattern in BANNED_PATTERNS:
        m = pattern.search(text)
        if m:
            violations.append(LintViolation(
                kind="banned-pattern",
                address=addr,
                detail=f"banned pattern '{name}' matched: {m.group()!r}",
            ))

    return violations


def check_duplicate_body(
    new_node: "MdNode",
    all_nodes: "list[MdNode]",
) -> list[LintViolation]:
    """Return a violation if new_node's body_text duplicates any other node in all_nodes."""
    body = new_node.body_text.strip()
    if not body:
        return []
    for other in all_nodes:
        if other is new_node:
            continue
        if other.body_text.strip() == body:
            return [LintViolation(
                kind="duplicate-body",
                address=new_node.address,
                detail=f"body_text duplicates node at {other.address!r}",
            )]
    return []
