# .carta/ Manifest

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
| doc00.06 | `06-ai-agent-integration.md` | AI workflow patterns: spec-to-code, code-to-spec, MCP setup, guide directory | ai, workflow, mcp, guides | doc02.03 |

## 01-context — Mission, principles, vocabulary

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc01.01 | `01-mission.md` | Core goal, dual mandate | mission, principles | — |
| doc01.02 | `02-principles.md` | 12 design principles: symmetric storage, inverse derivability | principles, design | doc01.01 |
| doc01.03 | `03-glossary.md` | Canonical vocabulary: construct, schema, port, polarity | glossary, terms | — |
| doc01.04 | `04-ux-principles.md` | Fitts's Law, Hick's Law, visual design principles | ux, design, ui | — |
| doc01.05 | `05-primary-sources/` | Author's original writings, directional intent | inspiration, vision, primary-source | — |
| doc01.05.01 | `05-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | artifacts, abstraction, vision | doc01.01 |

## 02-system — Architecture and technical design

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc02.01 | `01-overview.md` | Layer architecture, monorepo structure, data flow | architecture, packages | — |
| doc02.02 | `02-state.md` | Yjs Y.Doc, state partitioning, hooks, adapters | state, yjs, hooks, adapters | doc02.01 |
| doc02.03 | `03-interfaces.md` | File format, compiler output, MCP, WebSocket | interfaces, api, mcp | doc02.02 |
| doc02.04 | `04-decisions/` | ADR directory | adr, decisions | — |
| doc02.04.01 | `04-decisions/01-yjs-state.md` | ADR: Yjs as single state store | adr, yjs, state | doc02.02 |
| doc02.04.02 | `04-decisions/02-port-polarity.md` | ADR: five-value polarity model | adr, ports, polarity | doc02.06 |
| doc02.04.03 | `04-decisions/03-output-formatter-registry.md` | ADR: extensible formatter registry | adr, compiler, formatters | doc03.01.02.01 |
| doc02.04.04 | `04-decisions/04-unified-deployment.md` | ADR: simplified deployment config | adr, deployment, config | doc02.05 |
| doc02.04.05 | `04-decisions/05-presentation-model-organizers.md` | ADR: presentation model, organizers replace visual groups | adr, presentation, organizers, layout | doc02.09 |
| doc02.04.06 | `04-decisions/06-yjs-authoritative-layout.md` | ADR: Yjs-authoritative layout, RF as renderer only, eliminate 3-layer sync | adr, state, layout, yjs, react-flow | doc02.02, doc05.03 |
| doc02.04.07 | `04-decisions/07-package-loading-architecture.md` | ADR: Package-based schema loading, dual identity (UUID + content hash), manifest, snapshots | adr, packages, loading, seeds, identity, library | doc02.06, doc03.01.01.07 |
| doc02.04.08 | `04-decisions/08-resources.md` | **Archived.** ADR: Resources — superseded by filesystem-first workspace (ADR 009) | adr, archived | — |
| doc02.04.09 | `04-decisions/09-filesystem-workspace.md` | ADR: Filesystem-first workspace — `.carta/` directory, JSON canonical with binary sidecar, spec groups as directories, narrowed MCP surface, `carta serve .` | adr, workspace, filesystem, deployment, mcp, groups | doc02.04.04, doc02.05 |
| doc02.05 | `05-deployment-targets.md` | VITE_SYNC_URL, VITE_AI_MODE, document sources | deployment, config, server | doc02.01 |
| doc02.06 | `06-metamodel.md` | M2/M1/M0 metamodel, DataKind, ConstructSchema | metamodel, schemas, ports | doc01.02 |
| doc02.07 | `07-design-system.md` | Depth system, island pattern, colors, typography | design, ui, styling, lod | doc01.04 |
| doc02.08 | `08-frontend-architecture.md` | Four-layer component model, state partitioning | components, hooks, architecture | doc02.02, doc02.07 |
| doc02.09 | `09-presentation-model.md` | Presentation model, organizers, layout strategies, visual vs semantic | presentation, organizers, layout, rendering | doc02.08, doc02.02 |
| doc02.10 | `10-canvas-data-pipelines.md` | Map.tsx memo cascades, node/edge pipelines, waypoint flow, write-back points | pipeline, edges, nodes, waypoints, sync, Map | doc02.08, doc02.09, doc02.02 |
| doc02.11 | `11-canvas-engine.md` | Canvas engine primitives: useViewport, useConnectionDrag, ConnectionHandle, composition pattern | canvas-engine, viewport, connections, primitives | doc02.08 |

## 03-product — Features, use cases, workflows

### Modeling (doc03.01.01)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc03.00 | `00-index.md` | Feature catalog, use case table, workflow table | index, catalog | — |
| doc03.01.01.01 | `01-features/01-modeling/01-canvas.md` | Pan, zoom, LOD rendering, node manipulation | canvas, lod, zoom | doc02.07 |
| doc03.01.01.02 | `01-features/01-modeling/02-constructs.md` | Typed nodes, schemas, fields, semantic ID | constructs, schemas, nodes | doc02.06 |
| doc03.01.01.03 | `01-features/01-modeling/03-ports-and-connections.md` | Port model, polarity, validation, edge rendering | ports, connections, edges | doc02.06 |
| doc03.01.01.04 | `01-features/01-modeling/04-pages.md` | Multi-page views, page switching | pages, views | — |
| doc03.01.01.05 | `01-features/01-modeling/05-metamap.md` | Schema-level visual editor, schema nodes | metamap, schemas | doc02.06 |
| doc03.01.01.06 | `01-features/01-modeling/06-schema-editor.md` | Wizard for creating/editing construct schemas | schemas, editor | doc02.06 |
| doc03.01.01.07 | `01-features/01-modeling/07-schema-library.md` | Schema package loading, dual identity, manifest, standard library, drift detection | library, schemas, seeds, versioning, packages, loading | doc02.06, doc02.05, doc02.04.07 |
| doc03.01.14 | `01-features/14-simple-mode.md` | Sketch-phase rendering, composable render modes, separate primitives | sketching, simple, rendering, rough, architecture | doc03.03.08, doc02.07, doc02.08 |

### Output (doc03.01.02)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc03.01.02.01 | `01-features/02-output/01-compilation.md` | Compiler, formatters, AI-readable output | compiler, output | doc02.03 |
| doc03.01.02.02 | `01-features/02-output/02-import-export.md` | .carta file format, import/export | files, import, export | doc02.03 |

### Environment (doc03.01.03)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc03.01.03.01 | `01-features/03-environment/01-storage-navigation.md` | Vault browsing, filesystem-style document management | storage, navigation, vault, documents | doc02.05 |
| doc03.01.03.02 | `01-features/03-environment/02-collaboration.md` | Real-time sync, sharing, WebSocket | collaboration, server, sync | doc02.05 |
| doc03.01.03.03 | `01-features/03-environment/03-ai-assistant.md` | AI sidebar, chat, MCP tools | ai, chat, mcp | doc02.03 |
| doc03.01.03.04 | `01-features/03-environment/04-theming.md` | Light/dark/warm themes | themes, styling | doc02.07 |
| doc03.01.03.05 | `01-features/03-environment/05-new-user-experience.md` | First-load starter document, auto-create | onboarding, starter | — |
| doc03.01.03.06 | `01-features/03-environment/06-keyboard-and-clipboard.md` | Shortcuts, copy/paste, undo/redo | keyboard, clipboard, undo | — |

### Use Cases (doc03.02)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc03.02.01 | `02-use-cases/01-architect.md` | Software architect: workspace in a repo, `carta serve .` | persona, architect, workspace | doc02.04.09 |
| doc03.02.02 | `02-use-cases/02-team-lead.md` | Team lead: schema governance, PR review of canvas changes | persona, team, schemas, git | doc02.04.09 |
| doc03.02.03 | `02-use-cases/03-enterprise-self-hosted.md` | Team workspace: shared server wraps git repo, commits on behalf of web users | team, workspace, git | doc02.04.09, doc02.05 |
| doc03.02.04 | `02-use-cases/04-solo-user.md` | Browser playground or local workspace server | solo, playground, workspace | doc02.05 |
| doc03.02.05 | `02-use-cases/05-saas-provider.md` | **Archived.** Superseded by workspace model (ADR 009) | archived | — |

### Workflows (doc03.03)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc03.03.01 | `03-workflows/01-create-construct.md` | Create construct workflow | workflow, constructs | doc03.01.01.02 |
| doc03.03.02 | `03-workflows/02-connect-constructs.md` | Connect constructs workflow | workflow, connections | doc03.01.01.03 |
| doc03.03.03 | `03-workflows/03-define-schema.md` | Define schema workflow | workflow, schemas | doc03.01.01.06 |
| doc03.03.04 | `03-workflows/04-compile-project.md` | Compile project workflow | workflow, compiler | doc03.01.02.01 |
| doc03.03.05 | `03-workflows/05-import-project.md` | Import project workflow | workflow, import | doc03.01.02.02 |
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

## 05-research — Design explorations and research sessions

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|
| doc05.00 | `00-index.md` | Research session format and purpose | research, meta | — |
| doc05.01 | `01-visual-semantics-in-organizers.md` | Shape differentiation, sequence badges, icon markers for organizer contents | research, notation, bpmn, presentation, organizers | doc02.09, doc02.07, doc02.06 |
| doc05.02 | `02-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | research, tokens, efficiency, skills, agents | — |
| doc05.03 | `03-wagon-aware-layout-architecture.md` | Wagon layout units, 3-layer sync, snap normalization, state pitfalls | research, layout, wagons, organizers, state | doc02.09, doc02.02 |
| doc05.04 | `04-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc04.02, doc02.02 |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `hooks` | doc02.02, doc02.08 |
| `state` | doc02.02, doc02.04.01 |
| `components` | doc02.08, doc02.07 |
| `canvas` | doc03.01.01.01, doc02.07 |
| `canvas-engine` | doc02.11 |
| `viewport` | doc02.11 |
| `schemas` | doc02.06, doc03.01.01.02, doc03.01.01.05, doc03.01.01.06, doc03.01.01.07 |
| `library` | doc03.01.01.07 |
| `seeds` | doc03.01.01.07, doc02.06, doc02.04.07 |
| `packages` | doc02.04.07, doc03.01.01.07, doc02.06 |
| `identity` | doc02.04.07 |
| `loading` | doc02.04.07 |
| `versioning` | doc03.01.01.07 |
| `ports` | doc02.06, doc03.01.01.03, doc02.04.02 |
| `compiler` | doc03.01.02.01, doc02.03, doc02.04.03 |
| `deployment` | doc02.05, doc04.03, doc02.04.04 |
| `storage` | doc03.01.03.01, doc02.05 |
| `collaboration` | doc03.01.03.02, doc02.05 |
| `ui` | doc02.07, doc01.04 |
| `organizers` | doc02.09, doc03.01.01.01 |
| `pipeline` | doc02.10 |
| `waypoints` | doc02.10 |
| `sync` | doc02.10, doc02.02 |
| `presentation` | doc02.09, doc02.08 |
| `layout` | doc02.09 |
| `rendering` | doc02.09, doc03.01.14, doc02.07 |
| `testing` | doc04.02, doc05.04 |
| `verification` | doc05.04 |
| `epistemology` | doc05.04 |
| `testability` | doc05.04 |
| `oracles` | doc05.04 |
| `resources` | doc02.04.08 (archived) |
| `workspace` | doc02.04.09, doc02.05 |
| `filesystem` | doc02.04.09 |
| `datakind` | doc02.06, doc01.02 |
| `mcp` | doc02.03, doc03.01.03.03, doc00.06 |
| `research` | doc05.01, doc05.02 |
| `tokens` | doc05.02 |
| `efficiency` | doc05.02 |
| `notation` | doc05.01, doc02.07 |
| `bpmn` | doc05.01 |
| `primary-source` | doc01.05 |
| `vision` | doc01.05, doc01.05.01 |
| `inspiration` | doc01.05 |
| `ai` | doc00.05, doc00.06 |
| `workflow` | doc00.06 |
| `guides` | doc00.06 |
