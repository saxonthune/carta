---
title: Spec-Code Reconciliation Architecture
status: active
summary: Two-source-of-truth model, filesystem data formats, deterministic scripts, LLM-assisted reconciliation between product specs and codebases
tags: [spec-driven, reconciliation, formats, scripts, decomposition, information-theory, llm, static-analysis]
deps: [doc01.05.02, doc01.05.04.01, doc01.05.07, doc01.04.08.09]
---

# Spec-Code Reconciliation Architecture

Research session exploring how Carta's filesystem-first direction enables a formal reconciliation loop between product specifications and source code.

## The Question

Given two sources of truth — the idealized product (what the business wants) and the source code (what runs in production) — can we transform both into equivalent formats that are deterministically diffable, with LLMs bridging the gap?

## Two Sources of Truth

**Source code** is reality — it's what runs in production, what users interface with. **The aggregate desire of the business** is intent — domain experts, product managers, architects each hold a piece of what the product should be. The code is meant to match the idealized product. Software engineering transforms itself around this process of source transformation and reconciliation.

```
Domain experts --> Product spec --> Architecture --> Module shapes (desired)
                                                          | diff
Codebase -----> Static analysis -----> Module shapes (actual)
```

Both sides produce "module shapes" — the reconciliation point. Everything above is authoring (human + LLM). Everything below is extraction (scripts + static analysis). LLMs help write the individual documents that constitute the links between sources, and scripts perform static analysis and transformations where feasible. The LLM reads the diff and suggests changes to code (common) or to the product design (rare, when software constraints require it).

## Prior Art Survey

### Existing tools in this space

| Tool | What it does | Relevance |
|------|-------------|-----------|
| **Terraform/OpenTofu** | Typed resources in `.tf` files, references by ID, `plan` walks the dependency graph | Closest precedent: typed data in files, scripts walk connections |
| **dbt** | SQL models as files, `ref()` creates DAG, schema YAML sidecars validate | M1 = schema YAML, M0 = SQL files, `dbt run` = compiler |
| **Backstage (Spotify)** | `catalog-info.yaml` per service, typed entities with relations, catalog walks the graph | Architecture description as typed YAML in filesystem |
| **CUE** | Typed configuration with validation, unifies types and values, walks references | Powerful but high ceremony for this use case |
| **Smithy (AWS)** | `.smithy` files define typed shapes with relationships, CLI builds model graph | Traits (annotations) similar to Carta's DisplayHint |
| **LinkML** | YAML schema that generates JSON Schema, SHACL, SQL DDL from one source | "One schema, many targets" — similar to Carta's formatter registry |

### Comparison with RDF/SHACL and JSON Schema

**RDF/SHACL**: Open-world ontology languages optimized for inference. Carta's system is closed-world and doesn't need inference. The ceremony-to-value ratio is wrong for spec-driven development.

**JSON Schema**: Can enforce M1 types on M0 instances, including constraining schemas themselves via meta-schemas. The structural relationship `TypeScript interface --> conforming values` is identical to `JSON Schema --> conforming JSON documents`. JSON Schema falls short only for runtime graph validation (e.g., `canConnect()` polarity algorithm), but TypeScript falls short in the same way — both enforce shape, neither enforces graph-level connection semantics declaratively.

### Design principles applied

**Simon's nearly-decomposable systems** (doc01.05.08.05): Well-partitioned data are easier to manipulate and transform. One file per module means each piece can be diffed, updated, and reasoned about independently.

**Shannon entropy**: The LLM does a better job when the intent of the source data is more certain. Low-entropy files (narrow, predictable purpose) produce better LLM outputs than high-entropy files (mixed concerns).

## Data Format

### Core conventions

Three rules make the data walkable by scripts:

1. **Every file has an `id`** — the join key. Scripts build an index on first pass: `{id -> file_path}`.
2. **Every reference is a bare `id` string** — no paths, no URIs. `depends-on: [user-db, auth-service]` means "find the files whose `id` matches."
3. **Every file declares its `type`** — scripts filter without reading the body. `type: shape`, `type: pattern`, `type: architecture`.

### Shape file format

YAML frontmatter + freeform prose body. Frontmatter is machine-parseable; body is human/LLM context.

```yaml
---
id: account-creation
type: shape
feature: onboarding
depends-on: [household-db, auth-service]
exposes:
  - POST /api/accounts
  - GET /api/accounts/{id}
patterns: [layering, error-handling, data-access]
---

Handles new account creation for the household tax+payroll service.
Validates household data, creates account record, triggers welcome email.
```

### Pattern files

Patterns encode implementation constraints orthogonal to business rules: layering conventions, data access strategies, error handling, mapping between layers. They are referenced by shapes via the `patterns` key, with workspace-level defaults in `_defaults.yaml`.

```yaml
---
id: error-handling
type: pattern
applies-to: [controller, service]
---

Use RFC 7807 Problem Details for all error responses.
Allowed status codes: 400, 401, 403, 404, 500. No others.
Services throw typed exceptions. Controllers catch and map via middleware.
```

### Directory structure

```
spec/
  patterns/
    layering.md
    data-access.md
    error-handling.md
    mapping.md
  shapes/
    account-creation.md
    account-submission.md
    household-db.md
  architecture.md
  _defaults.yaml          # default patterns applied to all shapes
```

### What to avoid in the format

- References embedded in prose (wiki-link style) — not parseable without body scanning
- Nested objects in frontmatter — harder to diff, harder to validate
- Multiple files sharing an ID — breaks the index invariant
- Formal IDLs (Protobuf, GraphQL SDL) as the top-level format — too specific to API contracts

## Deterministic Scripts

Five scripts that are pure functions of the filesystem — no state, no side effects, no network calls. An LLM can call these as tools.

### `validate.py` — Referential integrity

Input: spec directory. Output: errors (broken `depends-on` references, missing files, cycles, missing required frontmatter fields, patterns referenced but not found). Graph walk + schema check on frontmatter.

### `extract.py` — Shape extraction from codebase

Input: solution/project directory. Output: shape files in the same YAML frontmatter format. Walks controllers for endpoints, follows service/repository layers for dependencies, reads DbContext for data model references. Emits `id`, `type`, `depends-on`, `exposes` per module. For .NET: Roslyn or convention-based file path parsing. For TypeScript: ts-morph or madge.

### `diff.py` — Spec vs. code comparison

Input: spec shapes directory, extracted shapes directory. Output: per-module diff report (missing endpoints, extra dependencies, unmatched modules). Compares YAML frontmatter blocks — set difference on `depends-on` and `exposes`.

### `collate.py` — LLM context assembly

Input: a shape file (or slice), patterns directory, architecture file. Output: single markdown document with the shape, all referenced patterns, and relevant architecture context inlined. Reads `patterns:` from frontmatter (or defaults), concatenates in predictable order.

### `slice.py` — Vertical slice materialization

Input: shapes directory, patterns directory, slicing strategy (by feature tag or endpoint group). Output: collated slice files in a temp/build directory. Walks `depends-on` transitively from a root shape, collects all referenced patterns (union + defaults), emits a flat directory.

### Calling order

```
extract.py  <-- run against codebase
     |
validate.py <-- run against spec AND extracted
     |
diff.py     <-- compare spec vs extracted
     |
collate.py  <-- prepare context for LLM (per module delta)
     |
slice.py    <-- when generating code for new features
```

## Slices Are Ephemeral

A vertical slice is a *view* — a projection of shapes + patterns into a single context window for a worker agent. It is an aggregate of a subsystem in Simon's terms, not a subsystem in itself.

**Slices should be discarded after use.** They are build artifacts, not source data:

- A slice is a function of (shapes + patterns + partitioning strategy). If any input changes, the slice is stale.
- The partitioning strategy ("group by vertical feature") is itself a pattern — encode it once, regenerate on demand.
- Stored slices create dual source-of-truth problems.

Slices go in a gitignored `generate/` or `.build/` directory, exist for the duration of the generation run, and are disposable. The subsystems (shapes) persist; the assemblies (slices) don't.

## Carta's Role

Carta sits at the authoring layer — the visual editor for the spec side. The canvas is how domain experts and architects create and connect module specs. The compiler emits the markdown+frontmatter files. Static analysis scripts emit the code-side equivalent. The diff happens outside Carta, in the filesystem.

**Key design implication**: Carta's compilation output format should match what the static analysis tools produce. If `extract.py` emits YAML with `id`, `type`, `depends-on`, `exposes`, then Carta's compiler should emit the same keys. The reconciliation becomes mechanical.

## Outcome

This research session produced:
- A data format specification (YAML frontmatter with id/type/references)
- A script architecture (five deterministic tools for LLM orchestration)
- Design principles for the format (Simon decomposition, Shannon entropy)
- Clarification that slices are ephemeral build artifacts, not persistent data
- Direction for Carta's compiler output format alignment with static analysis tools
