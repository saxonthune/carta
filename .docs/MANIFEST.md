# .docs/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

## 00-codex — Meta-documentation

| Ref | File | Topics |
|-----|------|--------|
| doc00.01 | `00-codex/01-about.md` | how to read docs, cross-reference syntax, one canonical location |
| doc00.02 | `00-codex/02-taxonomy.md` | title system rationale, Diataxis spirit, prior art, extension rules |
| doc00.03 | `00-codex/03-conventions.md` | docXX.YY.ZZ syntax, front matter schema, file naming, writing style |
| doc00.04 | `00-codex/04-maintenance.md` | git versioning, epoch markers, adding/deprecating docs |

## 01-context — Mission, principles, vocabulary

| Ref | File | Topics |
|-----|------|--------|
| doc01.01 | `01-context/01-mission.md` | core goal, dual mandate, modeling capability vs compilation |
| doc01.02 | `01-context/02-principles.md` | 12 design principles: symmetric storage, inverse derivability, no embedded tables, DataKind, dual identity, etc. |
| doc01.03 | `01-context/03-glossary.md` | canonical vocabulary: construct, schema, port, polarity, deployable, portfolio, semantic ID, etc. |
| doc01.04 | `01-context/04-ux-principles.md` | Fitts's Law, Hick's Law, Miller's Law, Doherty Threshold, progressive disclosure, direct manipulation, feedback latency |

## 02-system — Architecture and technical design

| Ref | File | Topics |
|-----|------|--------|
| doc02.01 | `02-system/01-overview.md` | layer architecture, monorepo structure, data flow, package dependency graph |
| doc02.02 | `02-system/02-state.md` | Yjs Y.Doc, state partitioning, persistence, undo/redo, adapter interface |
| doc02.03 | `02-system/03-interfaces.md` | file format, compiler output, MCP, WebSocket, DocumentAdapter |
| doc02.04 | `02-system/04-decisions/` | ADR directory (see below) |
| doc02.04.01 | `02-system/04-decisions/01-yjs-state.md` | ADR: Yjs as single state store |
| doc02.04.02 | `02-system/04-decisions/02-port-polarity.md` | ADR: five-value polarity model |
| doc02.04.03 | `02-system/04-decisions/03-output-formatter-registry.md` | ADR: extensible formatter registry |
| doc02.05 | `02-system/05-deployment-targets.md` | portfolio concept, 3 deployment modes, AI access matrix, monorepo status |
| doc02.06 | `02-system/06-metamodel.md` | M2/M1/M0 three-level metamodel, DataKind, DisplayHint, Polarity, ConstructSchema, FieldSchema, PortConfig, PortSchema, child construct pattern |
| doc02.07 | `02-system/07-design-system.md` | depth system (3 levels), island pattern, spacing scale, button hierarchy, semantic colors, typography, text-halo |
| doc02.08 | `02-system/08-frontend-architecture.md` | four-layer component model, state partitioning, container pattern, feature boundaries, audit checklist |

## 03-product — Features, use cases, workflows

| Ref | File | Topics |
|-----|------|--------|
| doc03.00 | `03-product/00-index.md` | feature catalog table, use case table, workflow table |
| doc03.01.01 | `03-product/01-features/01-canvas.md` | pan, zoom, LOD rendering, node manipulation, virtual parents, zoom controls |
| doc03.01.02 | `03-product/01-features/02-constructs.md` | typed nodes, schemas, fields, display field, semantic ID, instance color |
| doc03.01.03 | `03-product/01-features/03-ports-and-connections.md` | port model, polarity, validation, edge rendering, bundling |
| doc03.01.04 | `03-product/01-features/04-levels.md` | multi-level views, level switching, per-level state |
| doc03.01.05 | `03-product/01-features/05-metamap.md` | schema-level visual editor, schema nodes, group nodes |
| doc03.01.06 | `03-product/01-features/06-schema-editor.md` | wizard for creating/editing construct schemas |
| doc03.01.07 | `03-product/01-features/07-compilation.md` | compiler, formatters, AI-readable output |
| doc03.01.08 | `03-product/01-features/08-import-export.md` | .carta file format, import/export |
| doc03.01.09 | `03-product/01-features/09-collaboration.md` | server mode, WebSocket sync, document browser |
| doc03.01.10 | `03-product/01-features/10-ai-assistant.md` | AI sidebar, chat, MCP tools |
| doc03.01.11 | `03-product/01-features/11-keyboard-and-clipboard.md` | shortcuts, copy/paste, undo/redo |
| doc03.01.12 | `03-product/01-features/12-theming.md` | light/dark/warm themes |
| doc03.02.01 | `03-product/02-use-cases/01-architect.md` | software architect persona |
| doc03.02.02 | `03-product/02-use-cases/02-team-lead.md` | team lead persona |
| doc03.03.01 | `03-product/03-workflows/01-create-construct.md` | create construct workflow |
| doc03.03.02 | `03-product/03-workflows/02-connect-constructs.md` | connect constructs workflow |
| doc03.03.03 | `03-product/03-workflows/03-define-schema.md` | define schema workflow |
| doc03.03.04 | `03-product/03-workflows/04-compile-project.md` | compile project workflow |
| doc03.03.05 | `03-product/03-workflows/05-import-project.md` | import project workflow |

## 04-operations — Development and process

| Ref | File | Topics |
|-----|------|--------|
| doc04.01 | `04-operations/01-development.md` | dev setup, commands, environment, hosting modes |
| doc04.02 | `04-operations/02-testing.md` | test commands, CI, integration tests, E2E tests |
| doc04.03 | `04-operations/03-deployment.md` | build, deploy, static vs server mode |
| doc04.04 | `04-operations/04-contributing.md` | contribution guidelines, PR process |
