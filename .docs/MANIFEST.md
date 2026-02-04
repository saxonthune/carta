# .docs/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

**Retrieval strategy:** See doc00.05 for AI retrieval patterns inspired by legal RAG research.

## Column Definitions

- **Ref**: Cross-reference ID (`docXX.YY.ZZ`)
- **File**: Path relative to title directory
- **Summary**: One-line description for semantic matching
- **Tags**: Keywords for file-path→doc mapping
- **Deps**: Doc refs to check when this doc changes

## 00-codex — Meta-documentation

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc00.01 | `01-about.md` | How to read docs, cross-reference syntax | docs, meta | — |
| doc00.02 | `02-taxonomy.md` | Title system rationale, Diataxis spirit | docs, structure | — |
| doc00.03 | `03-conventions.md` | docXX.YY syntax, front matter, file naming | docs, conventions | — |
| doc00.04 | `04-maintenance.md` | Git versioning, epochs, adding/deprecating | docs, maintenance | — |
| doc00.05 | `05-ai-retrieval.md` | AI retrieval patterns, legal RAG inspiration | docs, ai, retrieval | — |

## 01-context — Mission, principles, vocabulary

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc01.01 | `01-mission.md` | Core goal, dual mandate | mission, principles | — |
| doc01.02 | `02-principles.md` | 12 design principles: symmetric storage, inverse derivability | principles, design | doc01.01 |
| doc01.03 | `03-glossary.md` | Canonical vocabulary: construct, schema, port, polarity | glossary, terms | — |
| doc01.04 | `04-ux-principles.md` | Fitts's Law, Hick's Law, visual design principles | ux, design, ui | — |

## 02-system — Architecture and technical design

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc02.01 | `01-overview.md` | Layer architecture, monorepo structure, data flow | architecture, packages | — |
| doc02.02 | `02-state.md` | Yjs Y.Doc, state partitioning, hooks, adapters | state, yjs, hooks, adapters | doc02.01 |
| doc02.03 | `03-interfaces.md` | File format, compiler output, MCP, WebSocket | interfaces, api, mcp | doc02.02 |
| doc02.04 | `04-decisions/` | ADR directory | adr, decisions | — |
| doc02.04.01 | `04-decisions/01-yjs-state.md` | ADR: Yjs as single state store | adr, yjs, state | doc02.02 |
| doc02.04.02 | `04-decisions/02-port-polarity.md` | ADR: five-value polarity model | adr, ports, polarity | doc02.06 |
| doc02.04.03 | `04-decisions/03-output-formatter-registry.md` | ADR: extensible formatter registry | adr, compiler, formatters | doc03.01.07 |
| doc02.04.04 | `04-decisions/04-unified-deployment.md` | ADR: simplified deployment config | adr, deployment, config | doc02.05 |
| doc02.05 | `05-deployment-targets.md` | VITE_SERVER_URL, VITE_AI_MODE, document sources | deployment, config, server | doc02.01 |
| doc02.06 | `06-metamodel.md` | M2/M1/M0 metamodel, DataKind, ConstructSchema | metamodel, schemas, ports | doc01.02 |
| doc02.07 | `07-design-system.md` | Depth system, island pattern, colors, typography | design, ui, styling, lod | doc01.04 |
| doc02.08 | `08-frontend-architecture.md` | Four-layer component model, state partitioning | components, hooks, architecture | doc02.02, doc02.07 |

## 03-product — Features, use cases, workflows

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc03.00 | `00-index.md` | Feature catalog, use case table, workflow table | index, catalog | — |
| doc03.01.01 | `01-features/01-canvas.md` | Pan, zoom, LOD rendering, node manipulation | canvas, lod, zoom | doc02.07 |
| doc03.01.02 | `01-features/02-constructs.md` | Typed nodes, schemas, fields, semantic ID | constructs, schemas, nodes | doc02.06 |
| doc03.01.03 | `01-features/03-ports-and-connections.md` | Port model, polarity, validation, edge rendering | ports, connections, edges | doc02.06 |
| doc03.01.04 | `01-features/04-levels.md` | Multi-level views, level switching | levels, views | — |
| doc03.01.05 | `01-features/05-metamap.md` | Schema-level visual editor, schema nodes | metamap, schemas | doc02.06 |
| doc03.01.06 | `01-features/06-schema-editor.md` | Wizard for creating/editing construct schemas | schemas, editor | doc02.06 |
| doc03.01.07 | `01-features/07-compilation.md` | Compiler, formatters, AI-readable output | compiler, output | doc02.03 |
| doc03.01.08 | `01-features/08-import-export.md` | .carta file format, import/export | files, import, export | doc02.03 |
| doc03.01.09 | `01-features/09-collaboration.md` | Single/multi-document modes, WebSocket, document browser | collaboration, server, sync | doc02.05 |
| doc03.01.10 | `01-features/10-ai-assistant.md` | AI sidebar, chat, MCP tools | ai, chat, mcp | doc02.03 |
| doc03.01.11 | `01-features/11-keyboard-and-clipboard.md` | Shortcuts, copy/paste, undo/redo | keyboard, clipboard, undo | — |
| doc03.01.12 | `01-features/12-theming.md` | Light/dark/warm themes | themes, styling | doc02.07 |
| doc03.01.13 | `01-features/13-new-user-experience.md` | First-load starter document, auto-create | onboarding, starter | — |
| doc03.02.01 | `02-use-cases/01-architect.md` | Software architect persona | persona, architect | — |
| doc03.02.02 | `02-use-cases/02-team-lead.md` | Team lead persona | persona, team | — |
| doc03.02.03 | `02-use-cases/03-enterprise-self-hosted.md` | Enterprise storage host, managed AI | enterprise, selfhost | doc02.05 |
| doc03.02.04 | `02-use-cases/04-solo-user.md` | Single-document browser, desktop standalone | solo, desktop | doc02.05 |
| doc03.02.05 | `02-use-cases/05-saas-provider.md` | Storage host, auth/billing surfaces | saas, provider | doc02.05 |
| doc03.03.01 | `03-workflows/01-create-construct.md` | Create construct workflow | workflow, constructs | doc03.01.02 |
| doc03.03.02 | `03-workflows/02-connect-constructs.md` | Connect constructs workflow | workflow, connections | doc03.01.03 |
| doc03.03.03 | `03-workflows/03-define-schema.md` | Define schema workflow | workflow, schemas | doc03.01.06 |
| doc03.03.04 | `03-workflows/04-compile-project.md` | Compile project workflow | workflow, compiler | doc03.01.07 |
| doc03.03.05 | `03-workflows/05-import-project.md` | Import project workflow | workflow, import | doc03.01.08 |
| doc03.03.06 | `03-workflows/06-iterative-modeling.md` | Iterative modeling on the map | workflow, modeling | — |
| doc03.03.07 | `03-workflows/07-schema-design-patterns.md` | Schema design patterns | workflow, patterns | doc02.06 |
| doc03.03.08 | `03-workflows/08-rough-to-refined.md` | Rough to refined modeling | workflow, modeling | — |

## 04-operations — Development and process

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc04.01 | `01-development.md` | Dev setup, commands, environment | dev, setup, commands | — |
| doc04.02 | `02-testing.md` | Test commands, CI, integration, E2E | testing, ci, e2e | — |
| doc04.03 | `03-deployment.md` | Build, deploy, env vars | deployment, build | doc02.05 |
| doc04.04 | `04-contributing.md` | Contribution guidelines, PR process | contributing, pr | — |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `hooks` | doc02.02, doc02.08 |
| `state` | doc02.02, doc02.04.01 |
| `components` | doc02.08, doc02.07 |
| `canvas` | doc03.01.01, doc02.07 |
| `schemas` | doc02.06, doc03.01.02, doc03.01.05, doc03.01.06 |
| `ports` | doc02.06, doc03.01.03, doc02.04.02 |
| `compiler` | doc03.01.07, doc02.03, doc02.04.03 |
| `deployment` | doc02.05, doc04.03, doc02.04.04 |
| `collaboration` | doc03.01.09, doc02.05 |
| `ui` | doc02.07, doc01.04 |
| `testing` | doc04.02 |
| `mcp` | doc02.03, doc03.01.10 |
