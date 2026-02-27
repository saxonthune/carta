---
title: Taxonomy
status: active
---

# Taxonomy

## Design Goal

Each title serves a distinct reader intent. Within each title, items split by what the reader needs to do — following the spirit of Diataxis, which observes that documentation fails when it mixes forms (tutorials that stop for theory, references that embed walkthroughs).

The titles partition by subject. Within titles, items partition by user intent: lookup (reference), understanding (explanation), or accomplishing a task (how-to).

## Titles

| # | Title | Reader Intent | Contents |
|---|-------|--------------|----------|
| 00 | codex | "How do I use these docs?" | Meta-documentation: taxonomy, conventions, maintenance |
| 01 | context | "Orient me" | Mission, principles, domain glossary |
| 02 | system | "How does it work?" | Architecture, state, interfaces, design decisions |
| 03 | product | "What does it do?" | Feature catalog, use cases, workflows |
| 04 | operations | "How do I work on it?" | Development, testing, deployment, contributing |

Titles 05+ are reserved for project-specific extensions. The base titles (00-04) apply to any software project.

## Why These Titles

Each title answers a question that every software project must address, regardless of type (web app, CLI, library, embedded system, SaaS platform). If you removed Carta and substituted any other software project, every title would still apply.

The ordering follows a narrowing funnel:

- **01 context**: Why does this exist? What vocabulary do I need?
- **02 system**: How is it structured? What decisions were made?
- **03 product**: What can it do? Who uses it? How?
- **04 operations**: How do I build, test, and ship it?

A stakeholder reads 01 and 03. A new developer reads 01 through 04. An architect focuses on 02 and 03.

## Why Not More Titles

An earlier design had 9 titles (charter, domain, architecture, features, use-cases, workflows, interfaces, operations, decisions). Several overlapped in reader intent:

- Charter + Domain both serve "orient me" -> merged into 01-context
- Architecture + Interfaces + Decisions all serve "how does it work" -> merged into 02-system
- Features + Use Cases + Workflows all serve "what does it do" -> merged into 03-product

Fewer titles with more nesting is easier to navigate than many flat titles with unclear boundaries.

## Prior Art Considered

**Diataxis** (Procida): Partitions by form (tutorial, how-to, reference, explanation) — orthogonal to our subject-based titles. We adopt its spirit within titles, not its structure as titles.

**Arc42** (Starke/Hruschka): Architecture documentation template with 12 sections. Thorough for architecture but silent on features, use cases, workflows. Our 02-system absorbs its best ideas.

**ADRs** (Nygard): Architecture Decision Records capture reasoning at decision time. Our 02-system/decisions/ directory uses this format directly.

**US Code**: Stable numbered titles with gaps, universal cross-reference syntax. Inspired our numbering and `doc` reference syntax. We avoid its accretion problem by allowing pruning (git preserves history).

**International Building Code**: Domain decomposition by building system (structural, fire, plumbing). Inspired our decomposition by concern. Its testability principle — describe behavior clearly enough to write a test — applies to our feature docs.

## Extending the Taxonomy

To add a project-specific title, use number 05 or higher. The base titles (00-04) should never be modified for a specific project — they are the universal skeleton.

Within any title, create subdirectories freely. The depth within a title is unbounded.
