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
| doc00.00 | `00-index.md` | Codex section index: what meta-documentation covers | index, meta | — |
| doc00.01 | `01-about.md` | How to read docs, cross-reference syntax | docs, meta | — |
| doc00.02 | `02-taxonomy.md` | Title system rationale, Diataxis spirit | docs, structure | — |
| doc00.03 | `03-conventions.md` | docXX.YY syntax, front matter, file naming | docs, conventions | — |
| doc00.04 | `04-maintenance.md` | Git versioning, epochs, adding/deprecating | docs, maintenance | — |
| doc00.05 | `05-ai-retrieval.md` | AI retrieval patterns, legal RAG inspiration | docs, ai, retrieval | — |
| doc00.06 | `06-ai-agent-integration.md` | AI workflow patterns: spec-to-code, code-to-spec, MCP setup, guide directory | ai, workflow, mcp, guides | doc02.03 |

## 01-context — Mission, principles, vocabulary

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc01.01.00 | `01-context/00-index.md` | Context section index: mission, principles, vocabulary | index, context | — |
| doc01.01.01 | `01-context/01-mission.md` | Core goal, dual mandate | mission, principles | — |
| doc01.01.02 | `01-context/02-principles.md` | 12 design principles: symmetric storage, inverse derivability | principles, design | doc01.01.01 |
| doc01.01.03 | `01-context/03-glossary.md` | Canonical vocabulary: construct, schema, port, polarity | glossary, terms | — |
| doc01.01.04 | `01-context/04-ux-principles.md` | Fitts's Law, Hick's Law, visual design principles | ux, design, ui | — |
| doc01.01.05 | `01-context/05-primary-sources/` | Author's original writings, directional intent | inspiration, vision, primary-source | — |
| doc01.01.05.01 | `01-context/05-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | artifacts, abstraction, vision | doc01.01.01 |
| doc01.00 | `00-index.md` | Product section index: feature catalog, use cases, workflows | index, product, catalog | — |
| doc01.02.01.01 | `02-features/01-modeling/01-canvas.md` | Pan, zoom, LOD rendering, node manipulation | canvas, lod, zoom | doc02.07 |
| doc01.02.01.02 | `02-features/01-modeling/02-constructs.md` | Typed nodes, schemas, fields, semantic ID | constructs, schemas, nodes | doc02.06 |
| doc01.02.01.03 | `02-features/01-modeling/03-ports-and-connections.md` | Port model, polarity, validation, edge rendering | ports, connections, edges | doc02.06 |
| doc01.02.01.04 | `02-features/01-modeling/04-pages.md` | Multi-page views, page switching | pages, views | — |
| doc01.02.01.05 | `02-features/01-modeling/05-metamap.md` | Schema-level visual editor, schema nodes | metamap, schemas | doc02.06 |
| doc01.02.01.06 | `02-features/01-modeling/06-schema-editor.md` | Wizard for creating/editing construct schemas | schemas, editor | doc02.06 |
| doc01.02.01.07 | `02-features/01-modeling/07-schema-library.md` | Schema package loading, dual identity, manifest, standard library, drift detection | library, schemas, seeds, versioning, packages, loading | doc02.06, doc01.01.05, doc01.04.07 |
| doc01.02.14 | `02-features/14-simple-mode.md` | Sketch-phase rendering, composable render modes, separate primitives | sketching, simple, rendering, rough, architecture | doc01.04.08, doc02.07, doc02.08 |
| doc01.02.02.01 | `02-features/02-output/01-compilation.md` | Compiler, formatters, AI-readable output | compiler, output | doc01.01.03 |
| doc01.02.02.02 | `02-features/02-output/02-import-export.md` | .carta file format, import/export | files, import, export | doc01.01.03 |
| doc01.02.03.01 | `02-features/03-environment/01-storage-navigation.md` | Vault browsing, filesystem-style document management | storage, navigation, vault, documents | doc01.01.05 |
| doc01.02.03.02 | `02-features/03-environment/02-collaboration.md` | Real-time sync, sharing, WebSocket | collaboration, server, sync | doc01.01.05 |
| doc01.02.03.03 | `02-features/03-environment/03-ai-assistant.md` | AI sidebar, chat, MCP tools | ai, chat, mcp | doc01.01.03 |
| doc01.02.03.04 | `02-features/03-environment/04-theming.md` | Light/dark/warm themes | themes, styling | doc02.07 |
| doc01.02.03.05 | `02-features/03-environment/05-new-user-experience.md` | First-load starter document, auto-create | onboarding, starter | — |
| doc01.02.03.06 | `02-features/03-environment/06-keyboard-and-clipboard.md` | Shortcuts, copy/paste, undo/redo | keyboard, clipboard, undo | — |
| doc01.03.01 | `03-use-cases/01-architect.md` | Software architect: workspace in a repo, `carta serve .` | persona, architect, workspace | doc02.04.09 |
| doc01.03.02 | `03-use-cases/02-team-lead.md` | Team lead: schema governance, PR review of canvas changes | persona, team, schemas, git | doc02.04.09 |
| doc01.03.03 | `03-use-cases/03-enterprise-self-hosted.md` | Team workspace: shared server wraps git repo, commits on behalf of web users | team, workspace, git | doc02.04.09, doc01.01.05 |
| doc01.03.04 | `03-use-cases/04-solo-user.md` | Browser playground or local workspace server | solo, playground, workspace | doc01.01.05 |
| doc01.03.05 | `03-use-cases/05-saas-provider.md` | **Archived.** Superseded by workspace model (ADR 009) | archived | — |
| doc01.04.01 | `04-workflows/01-create-construct.md` | Create construct workflow | workflow, constructs | doc01.02.01.02 |
| doc01.04.02 | `04-workflows/02-connect-constructs.md` | Connect constructs workflow | workflow, connections | doc01.02.01.03 |
| doc01.04.03 | `04-workflows/03-define-schema.md` | Define schema workflow | workflow, schemas | doc01.02.01.06 |
| doc01.04.04 | `04-workflows/04-compile-project.md` | Compile project workflow | workflow, compiler | doc01.02.02.01 |
| doc01.04.05 | `04-workflows/05-import-project.md` | Import project workflow | workflow, import | doc01.02.02.02 |
| doc01.04.06 | `04-workflows/06-iterative-modeling.md` | Iterative modeling on the map | workflow, modeling | — |
| doc01.04.07 | `04-workflows/07-schema-design-patterns.md` | Schema design patterns | workflow, patterns | doc02.06 |
| doc01.04.08 | `04-workflows/08-rough-to-refined.md` | Rough to refined modeling | workflow, modeling | — |
## 02-system — Architecture and technical design

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc02.00 | `00-index.md` | System section index: architecture, state, interfaces, decisions | index, architecture | — |
| doc02.01 | `01-overview.md` | Layer architecture, monorepo structure, data flow | architecture, packages | — |
| doc02.02 | `02-state.md` | Yjs Y.Doc, state partitioning, hooks, adapters | state, yjs, hooks, adapters | doc01.01.01 |
| doc02.03 | `03-interfaces.md` | File format, compiler output, MCP, WebSocket | interfaces, api, mcp | doc01.01.02 |
| doc02.04 | `04-decisions/` | ADR directory | adr, decisions | — |
| doc02.04.01 | `04-decisions/01-yjs-state.md` | ADR: Yjs as single state store | adr, yjs, state | doc01.01.02 |
| doc02.04.02 | `04-decisions/02-port-polarity.md` | ADR: five-value polarity model | adr, ports, polarity | doc02.06 |
| doc02.04.03 | `04-decisions/03-output-formatter-registry.md` | ADR: extensible formatter registry | adr, compiler, formatters | doc01.02.02.01 |
| doc02.04.04 | `04-decisions/04-unified-deployment.md` | ADR: simplified deployment config | adr, deployment, config | doc01.01.05 |
| doc02.04.05 | `04-decisions/05-presentation-model-organizers.md` | ADR: presentation model, organizers replace visual groups | adr, presentation, organizers, layout | doc02.09 |
| doc02.04.06 | `04-decisions/06-yjs-authoritative-layout.md` | ADR: Yjs-authoritative layout, RF as renderer only, eliminate 3-layer sync | adr, state, layout, yjs, react-flow | doc01.01.02, doc04.03 |
| doc02.04.07 | `04-decisions/07-package-loading-architecture.md` | ADR: Package-based schema loading, dual identity (UUID + content hash), manifest, snapshots | adr, packages, loading, seeds, identity, library | doc02.06, doc01.02.01.07 |
| doc02.04.08 | `04-decisions/08-resources.md` | **Archived.** ADR: Resources — superseded by filesystem-first workspace (ADR 009) | adr, archived | — |
| doc02.04.09 | `04-decisions/09-filesystem-workspace.md` | ADR: Filesystem-first workspace — `.carta/` directory, JSON canonical with binary sidecar, spec groups as directories, narrowed MCP surface, `carta serve .` | adr, workspace, filesystem, deployment, mcp, groups | doc01.04.04, doc01.01.05 |
| doc02.05 | `05-deployment-targets.md` | VITE_SYNC_URL, VITE_AI_MODE, document sources | deployment, config, server | doc01.01.01 |
| doc02.06 | `06-metamodel.md` | M2/M1/M0 metamodel, DataKind, ConstructSchema | metamodel, schemas, ports | doc01.01.02 |
| doc02.07 | `07-design-system.md` | Depth system, island pattern, colors, typography | design, ui, styling, lod | doc01.01.04 |
| doc02.08 | `08-frontend-architecture.md` | Four-layer component model, state partitioning | components, hooks, architecture | doc01.01.02, doc02.07 |
| doc02.09 | `09-presentation-model.md` | Presentation model, organizers, layout strategies, visual vs semantic | presentation, organizers, layout, rendering | doc02.08, doc01.01.02 |
| doc02.10 | `10-canvas-data-pipelines.md` | Map.tsx memo cascades, node/edge pipelines, waypoint flow, write-back points | pipeline, edges, nodes, waypoints, sync, Map | doc02.08, doc02.09, doc01.01.02 |
| doc02.11 | `11-canvas-engine.md` | Canvas engine primitives: useViewport, useConnectionDrag, ConnectionHandle, composition pattern | canvas-engine, viewport, connections, primitives | doc02.08 |
## 03-product — Features, use cases, workflows

### Modeling (doc01.02.01)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

### Output (doc01.02.02)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

### Environment (doc01.02.03)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

### Use Cases (doc01.03)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

### Workflows (doc01.04)

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc03.00 | `00-index.md` | Operations section index: dev setup, testing, deployment, contributing | index, operations | — |
| doc03.01 | `01-development.md` | Dev setup, commands, environment | dev, setup, commands | — |
| doc03.02 | `02-testing.md` | Test commands, CI, integration, E2E | testing, ci, e2e | — |
| doc03.03 | `03-deployment.md` | Build, deploy, env vars | deployment, build | doc02.01.05 |
| doc03.04 | `04-contributing.md` | Contribution guidelines, PR process | contributing, pr | — |
## 04-operations — Development and process

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc04.00 | `00-index.md` | Research section index: session format, what belongs here | index, research | — |
| doc04.01 | `01-visual-semantics-in-organizers.md` | Shape differentiation, sequence badges, icon markers for organizer contents | research, notation, bpmn, presentation, organizers | doc01.09, doc01.07, doc01.06 |
| doc04.02 | `02-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | research, tokens, efficiency, skills, agents | — |
| doc04.03 | `03-wagon-aware-layout-architecture.md` | Wagon layout units, 3-layer sync, snap normalization, state pitfalls | research, layout, wagons, organizers, state | doc01.09, doc02.01.02 |
| doc04.04 | `04-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc03.02, doc02.01.02 |
## 05-research — Design explorations and research sessions

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `hooks` | doc02.02, doc02.08 |
| `state` | doc02.02, doc02.04.01 |
| `components` | doc02.08, doc02.07 |
| `canvas` | doc01.02.01.01, doc02.07 |
| `canvas-engine` | doc02.11 |
| `viewport` | doc02.11 |
| `schemas` | doc02.06, doc01.02.01.02, doc01.02.01.05, doc01.02.01.06, doc01.02.01.07 |
| `library` | doc01.02.01.07 |
| `seeds` | doc01.02.01.07, doc02.06, doc02.04.07 |
| `packages` | doc02.04.07, doc01.02.01.07, doc02.06 |
| `identity` | doc02.04.07 |
| `loading` | doc02.04.07 |
| `versioning` | doc01.02.01.07 |
| `ports` | doc02.06, doc01.02.01.03, doc02.04.02 |
| `compiler` | doc01.02.02.01, doc02.03, doc02.04.03 |
| `deployment` | doc02.05, doc03.03, doc02.04.04 |
| `storage` | doc01.02.03.01, doc02.05 |
| `collaboration` | doc01.02.03.02, doc02.05 |
| `ui` | doc02.07, doc01.01.04 |
| `organizers` | doc02.09, doc01.02.01.01 |
| `pipeline` | doc02.10 |
| `waypoints` | doc02.10 |
| `sync` | doc02.10, doc02.02 |
| `presentation` | doc02.09, doc02.08 |
| `layout` | doc02.09 |
| `rendering` | doc02.09, doc01.02.14, doc02.07 |
| `testing` | doc03.02, doc04.04 |
| `verification` | doc04.04 |
| `epistemology` | doc04.04 |
| `testability` | doc04.04 |
| `oracles` | doc04.04 |
| `resources` | doc02.04.08 (archived) |
| `workspace` | doc02.04.09, doc02.05 |
| `filesystem` | doc02.04.09 |
| `datakind` | doc02.06, doc01.01.02 |
| `mcp` | doc02.03, doc01.02.03.03, doc00.06 |
| `research` | doc04.01, doc04.02 |
| `tokens` | doc04.02 |
| `efficiency` | doc04.02 |
| `notation` | doc04.01, doc02.07 |
| `bpmn` | doc04.01 |
| `primary-source` | doc01.01.05 |
| `vision` | doc01.01.05, doc01.01.05.01 |
| `inspiration` | doc01.01.05 |
| `ai` | doc00.05, doc00.06 |
| `workflow` | doc00.06 |
| `guides` | doc00.06 |
