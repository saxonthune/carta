---
title: Spec-Code Reconciliation
status: draft
summary: Comparing specifications against source code to detect drift and suggest alignment — mechanism-agnostic
tags: [reconciliation, specs, spec-driven, alignment]
deps: [doc01.02.01, doc01.01.02]
---

# Spec-Code Reconciliation

Reconciliation is the process of comparing what a `.carta/` workspace says the product should be against what the source code actually does, detecting drift, and suggesting alignment in either direction.

## The Problem

Two sources of truth exist in any software project: the **specifications** (what the business intends) and the **source code** (what runs in production). These diverge over time. Reconciliation detects the drift and surfaces it for human or AI-assisted resolution.

## What Carta Provides

Carta is agnostic about the specific mechanism for reconciliation. The workspace format (doc01.02.01) provides the spec side — structured, machine-readable documents with typed frontmatter, cross-references, and a tag index. How those specs are compared against code is an open design space.

Possible approaches include:
- **LLM-assisted comparison** — an AI agent reads both specs and code, identifies gaps
- **Static analysis extraction** — scripts parse source code into an intermediate format comparable to spec shapes
- **Manual review** — humans read specs alongside code and update either side
- **Hybrid** — deterministic extraction where feasible, LLM bridging where not

The research session doc01.03.06 explores one concrete architecture (shape extraction, diffing, slicing). That research informs this feature but does not prescribe its implementation.

## Relationship to Workspace Scripts

The `carta` CLI (doc01.02.02) is a **workspace structure tool** — it manipulates files, directories, numbering, and cross-references. It does not parse source code.

Reconciliation operates at a higher level: it reasons about the *content* of specs and their relationship to code artifacts. It may invoke workspace scripts (e.g., `carta create` to scaffold a new spec from extracted code), but the concerns are distinct.

## Status

This feature is in early research. See doc01.03.06 for the foundational research session on two-source-of-truth models, data formats, and reconciliation architecture.
