---
title: AI Retrieval Patterns
status: active
summary: How AI agents navigate this workspace — hierarchical retrieval, MANIFEST usage, token budgets
tags: [docs, ai, retrieval]
deps: []
---

# AI Retrieval Patterns

How AI agents efficiently navigate a `.carta/` workspace. Inspired by legal AI retrieval-augmented generation (RAG) research — legal codes share the same challenge of finding all relevant authorities without reading everything.

## Two-Phase Search

1. **Cheap triage** — read `MANIFEST.md` to identify relevant docs by summary and tags. Run parallel `grep` calls with file-matching mode to locate specific terms.
2. **Targeted reads** — read only the docs surfaced by triage. Prefer docs closer to the codex (foundational context) before reading detailed specs.

Do not read entire directories speculatively. Do not read files not surfaced by grep or referenced by the task.

## Hierarchical Document Treatment

Not all docs deserve the same retrieval strategy:

- **Codex** (`00-codex/`) — read fully when orienting. Foundational, rarely changes.
- **High-level groups** (strategy, context) — read section headers, then targeted sections.
- **Detail groups** (architecture, code shapes) — index by tags, read on-demand.
- **Operations** (build, test, deploy) — read only when build/test/deploy changes.

## MANIFEST.md as Retrieval Index

MANIFEST.md is the primary entry point for AI agents. Each entry includes:

```markdown
| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|
| doc01.02 | 02-principles.md | Design principles and constraints | principles, design | doc01.01 | doc02.01 |
```

- **Summary**: One-line description for semantic matching
- **Tags**: Lowercase keywords for file-path-to-doc mapping
- **Deps**: Doc refs to check when this doc changes
- **Refs**: Reverse deps — docs that list this one in their Deps

## Summary Augmented Chunking

Standard RAG retrieves chunks that appear relevant but may be wrong documents. Including document summaries with each chunk reduces mismatch. This is why every doc has a `summary` field in frontmatter — it travels with the doc ref in MANIFEST.

## Dependency Graphs

Track document dependencies to ensure related docs are updated together. When editing a doc, the system knows to check its reverse dependencies (`Refs` column). This reduces hallucination by surfacing the full context an AI needs before making changes.

## Token Budget Guidelines

| Operation | Typical Tokens | When to Use |
|-----------|---------------|-------------|
| MANIFEST only | ~500-2,000 | Initial orientation |
| MANIFEST + 1 doc | ~2,000-4,000 | Single-subsystem change |
| MANIFEST + 3 docs | ~4,000-8,000 | Cross-cutting change |
| Full workspace read | ~15,000-50,000 | Major refactor, epoch bump |

Target: **90% of documentation operations should read less than 10% of docs**.

## Completeness Verification

After generating documentation updates, verify:

1. **Coverage**: Every changed code path maps to at least one doc
2. **Provenance**: Every edit cites a source section
3. **Dependency check**: Docs that depend on edited docs are reviewed
4. **Cross-reference integrity**: Existing `docXX.YY` references still resolve
