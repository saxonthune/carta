# .carta/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

**Retrieval strategy:** See doc00.05 for AI retrieval patterns inspired by legal RAG research.

## Column Definitions

- **Ref**: Cross-reference ID (`docXX.YY.ZZ`)
- **File**: Path relative to title directory
- **Summary**: One-line description for semantic matching
- **Tags**: Keywords for file-path→doc mapping
- **Deps**: Doc refs to check when this doc changes

## 00-codex — Codex Index

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc00.00 | `00-index.md` | Codex section index: what meta-documentation covers | index, meta | — |
| doc00.01 | `01-about.md` | How to read docs, cross-reference syntax | docs, meta | — |
| doc00.02 | `02-taxonomy.md` | Title system rationale, Diataxis spirit | docs, structure | — |
| doc00.03 | `03-conventions.md` | docXX.YY syntax, front matter, file naming | docs, conventions | — |
| doc00.04 | `04-maintenance.md` | Git versioning, epochs, adding/deprecating | docs, maintenance | — |
| doc00.05 | `05-ai-retrieval.md` | AI retrieval patterns, legal RAG inspiration | docs, ai, retrieval | — |
| doc00.06 | `06-ai-agent-integration.md` | AI workflow patterns: spec-to-code, code-to-spec, MCP setup, guide directory | ai, workflow, mcp, guides | doc01.03.03 |

## 01-product — Product Index

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc01.00 | `00-index.md` | Product section index: goals, features, research | index, product | — |
| doc01.02.01 | `02-features/01-docs-system.md` | The .carta/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST | docs, workspace, format | doc01.01.01 |
| doc01.02.02 | `02-features/02-workspace-scripts.md` | CLI tools for workspace structure and spec-code reconciliation | cli, workspace, tools, reconciliation, scripts | doc01.02.01 |
| doc01.02.03 | `02-features/03-vscode-extension.md` | Canvas viewer and workspace browser for VS Code | vscode, extension, canvas | doc01.02.01, doc01.02.04 |
| doc01.02.04 | `02-features/04-canvas.md` | Visual architecture editor — typed constructs, ports, connections, LOD rendering | canvas, editor, constructs, ports | doc01.01.01 |
| doc01.02.05 | `02-features/05-web-platform.md` | Future web client with git-backed server for nontechnical users | web, server, collaboration, git | doc01.02.04 |
| doc01.02.06 | `02-features/06-cli-user-flow.md` | How users install the carta CLI, hydrate a repo, and use it for workspace operations | cli, workflow, installation, use-case | doc01.02.02 |

### Goals Index

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc01.01.00 | `01-goals/00-index.md` | Goals section index: mission, principles, vocabulary | index, goals | — |
| doc01.01.01 | `01-goals/01-mission.md` | Core goal — spec-driven development tool | mission, principles | — |
| doc01.01.02 | `01-goals/02-principles.md` | 12 design principles: symmetric storage, inverse derivability | principles, design | doc01.01.01 |
| doc01.01.03 | `01-goals/03-glossary.md` | Canonical vocabulary: workspace, spec, shape, reconciliation | glossary, terms | — |
| doc01.01.04.00 | `01-goals/04-primary-sources/00-index.md` | Author's original writings, directional intent | inspiration, vision, primary-source | — |
| doc01.01.04.01 | `01-goals/04-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | AI, coding, planning, category theory, morphisms, artifact-driven development | doc01.01.01 |

### Research Sessions

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc01.03.00 | `03-research/00-index.md` | Research section index: session format, what belongs here | index, research | — |
| doc01.03.01 | `03-research/01-visual-semantics-in-organizers.md` | Shape differentiation, sequence badges, icon markers for organizer contents | presentation, rendering, organizers, bpmn, notation, dual-mandate | doc01.09, doc01.07, doc01.06 |
| doc01.03.02 | `03-research/02-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | tokens, efficiency, skills, agents, context-engineering | — |
| doc01.03.03 | `03-research/03-wagon-aware-layout-architecture.md` | Wagon layout units, 3-layer sync, snap normalization, state pitfalls | layout, organizers, wagons, presentation, state-management | doc01.09, doc02.01.02 |
| doc01.03.04 | `03-research/04-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc01.03.02, doc02.01.02 |
| doc01.03.05 | `03-research/05-decomposition-and-composition-theory.md` | Mathematical foundations for spec-driven development — what makes a good decomposition, and how pieces compose back | decomposition, composition, information-theory, modularity, spec-driven, category-theory, complexity | doc01.01.02, doc01.01.04.01 |
| doc01.03.06 | `03-research/06-spec-code-reconciliation.md` | Two-source-of-truth model, filesystem data formats, deterministic scripts, LLM-assisted reconciliation between product specs and codebases | spec-driven, reconciliation, formats, scripts, decomposition, information-theory, llm, static-analysis | doc01.01.02, doc01.01.04.01, doc02.06.09 |
| doc01.03.07 | `03-research/07-documentation-systems-and-retrieval.md` | Principles behind hierarchical docs systems, agentic search improvement, scientific comparison of docs structures, and what makes individual specs good enough for code generation | docs, retrieval, ai, specifications, elicitation, information-architecture, evaluation | doc00.05, doc01.03.06 |

## 02-architecture — Architecture Index

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc02.00 | `00-index.md` | Architecture section index: overview, script pipeline, canvas, decisions | index, architecture | — |
| doc02.01 | `01-overview.md` | Layer architecture, monorepo structure, data flow | architecture, packages | — |
| doc02.02 | `02-script-pipeline.md` | Architecture of the five-stage reconciliation script pipeline | scripts, reconciliation, pipeline, architecture | doc01.02.02 |
| doc02.03 | `03-vscode-extension.md` | Extension architecture — WebView canvas viewer, workspace tree provider | vscode, extension, architecture | doc01.02.03 |
| doc02.05 | `05-web-platform.md` | Future server architecture — git-backed workspace, WebSocket sync, REST API | server, web, architecture, git | doc01.02.05 |

### Canvas Architecture Index

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc02.04.00 | `04-canvas/00-index.md` | Canvas subsystem architecture: state, metamodel, frontend, presentation, pipelines, engine, design | index, canvas, architecture | doc01.02.04 |
| doc02.04.01 | `04-canvas/01-state.md` | Yjs Y.Doc, state partitioning, hooks, adapters | state, yjs, hooks, adapters | doc01.01.01 |
| doc02.04.02 | `04-canvas/02-metamodel.md` | M2/M1/M0 metamodel, DataKind, ConstructSchema | metamodel, schemas, ports | doc01.01.02 |
| doc02.04.03 | `04-canvas/03-frontend-architecture.md` | Four-layer component model, state partitioning | components, hooks, architecture | doc01.01.02, doc02.04.07 |
| doc02.04.04 | `04-canvas/04-presentation-model.md` | Presentation model, organizers, layout strategies, visual vs semantic | presentation, organizers, layout, rendering | doc02.04.03, doc01.01.02 |
| doc02.04.05 | `04-canvas/05-data-pipelines.md` | Map.tsx memo cascades, node/edge pipelines, waypoint flow, write-back points | pipeline, edges, nodes, waypoints, sync, Map | doc02.04.03, doc02.04.04, doc01.01.02 |
| doc02.04.06 | `04-canvas/06-engine.md` | Canvas engine primitives: useViewport, useConnectionDrag, ConnectionHandle, composition pattern | canvas-engine, viewport, connections, primitives | doc02.04.03 |
| doc02.04.07 | `04-canvas/07-design-system.md` | Depth system, island pattern, colors, typography | design, ui, styling, lod | — |
| doc02.04.08 | `04-canvas/08-glossary.md` | Canvas-specific vocabulary — construct, schema, port, polarity, organizer, LOD | glossary, canvas, terms | doc02.04.02 |

### Decisions Index

| Ref | File | Summary | Tags | Deps |
|-----|------|---------|------|------|

| doc02.06.00 | `06-decisions/00-index.md` | Architecture Decision Records | index, adr, decisions | — |
| doc02.06.01 | `06-decisions/01-yjs-state.md` | ADR: Yjs as single state store | adr, yjs, state | doc01.01.02 |
| doc02.06.02 | `06-decisions/02-port-polarity.md` | ADR: five-value polarity model | adr, ports, polarity | doc02.04.02 |
| doc02.06.03 | `06-decisions/03-output-formatter-registry.md` | ADR: extensible formatter registry | adr, compiler, formatters | — |
| doc02.06.04 | `06-decisions/04-unified-deployment.md` | ADR: simplified deployment config | adr, deployment, config | doc01.01.04 |
| doc02.06.05 | `06-decisions/05-presentation-model-organizers.md` | ADR: presentation model, organizers replace visual groups | adr, presentation, organizers, layout | doc02.04.04 |
| doc02.06.06 | `06-decisions/06-yjs-authoritative-layout.md` | ADR: Yjs-authoritative layout, RF as renderer only, eliminate 3-layer sync | adr, state, layout, yjs, architecture | doc01.01.02, doc01.03.03 |
| doc02.06.07 | `06-decisions/07-package-loading-architecture.md` | ADR: Package-based schema loading, dual identity (UUID + content hash), manifest, snapshots | adr, packages, loading, seeds, identity, library | doc02.04.02 |
| doc02.06.08 | `06-decisions/08-resources.md` | **Archived.** ADR: Resources — superseded by filesystem-first workspace (ADR 009) | adr, archived | — |
| doc02.06.09 | `06-decisions/09-filesystem-workspace.md` | ADR: Filesystem-first workspace — `.carta/` directory, JSON canonical with binary sidecar, spec groups as directories, narrowed MCP surface, `carta serve .` | adr, workspace, filesystem, deployment, mcp, groups | doc01.01.04 |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `AI` | doc01.01.04.01 |
| `Map` | doc02.04.05 |
| `adapters` | doc02.04.01 |
| `adr` | doc02.06.00, doc02.06.01, doc02.06.02, doc02.06.03, doc02.06.04, doc02.06.05, doc02.06.06, doc02.06.07, doc02.06.08, doc02.06.09 |
| `agents` | doc01.03.02, doc01.03.04 |
| `ai` | doc00.05, doc00.06, doc01.03.07 |
| `architecture` | doc02.00, doc02.01, doc02.02, doc02.03, doc02.04.00, doc02.04.03, doc02.05, doc02.06.06 |
| `archived` | doc02.06.08 |
| `artifact-driven development` | doc01.01.04.01 |
| `bpmn` | doc01.03.01 |
| `canvas` | doc01.02.03, doc01.02.04, doc02.04.00, doc02.04.08 |
| `canvas-engine` | doc02.04.06 |
| `category theory` | doc01.01.04.01 |
| `category-theory` | doc01.03.05 |
| `cli` | doc01.02.02, doc01.02.06 |
| `coding` | doc01.01.04.01 |
| `collaboration` | doc01.02.05 |
| `compiler` | doc02.06.03 |
| `complexity` | doc01.03.05 |
| `components` | doc02.04.03 |
| `composition` | doc01.03.05 |
| `config` | doc02.06.04 |
| `connections` | doc02.04.06 |
| `constructs` | doc01.02.04 |
| `context-engineering` | doc01.03.02 |
| `conventions` | doc00.03 |
| `decisions` | doc02.06.00 |
| `decomposition` | doc01.03.05, doc01.03.06 |
| `deployment` | doc02.06.04, doc02.06.09 |
| `design` | doc01.01.02, doc02.04.07 |
| `docs` | doc00.01, doc00.02, doc00.03, doc00.04, doc00.05, doc01.02.01, doc01.03.07 |
| `dual-mandate` | doc01.03.01 |
| `edges` | doc02.04.05 |
| `editor` | doc01.02.04 |
| `efficiency` | doc01.03.02 |
| `elicitation` | doc01.03.07 |
| `epistemology` | doc01.03.04 |
| `evaluation` | doc01.03.07 |
| `extension` | doc01.02.03, doc02.03 |
| `filesystem` | doc02.06.09 |
| `format` | doc01.02.01 |
| `formats` | doc01.03.06 |
| `formatters` | doc02.06.03 |
| `git` | doc01.02.05, doc02.05 |
| `glossary` | doc01.01.03, doc02.04.08 |
| `goals` | doc01.01.00 |
| `groups` | doc02.06.09 |
| `guides` | doc00.06 |
| `hooks` | doc02.04.01, doc02.04.03 |
| `identity` | doc02.06.07 |
| `index` | doc00.00, doc01.00, doc01.01.00, doc01.03.00, doc02.00, doc02.04.00, doc02.06.00 |
| `information-architecture` | doc01.03.07 |
| `information-theory` | doc01.03.05, doc01.03.06 |
| `inspiration` | doc01.01.04.00 |
| `installation` | doc01.02.06 |
| `layout` | doc01.03.03, doc02.04.04, doc02.06.05, doc02.06.06 |
| `library` | doc02.06.07 |
| `llm` | doc01.03.06 |
| `loading` | doc02.06.07 |
| `lod` | doc02.04.07 |
| `maintenance` | doc00.04 |
| `mcp` | doc00.06, doc02.06.09 |
| `meta` | doc00.00, doc00.01 |
| `metamodel` | doc02.04.02 |
| `mission` | doc01.01.01 |
| `modularity` | doc01.03.05 |
| `morphisms` | doc01.01.04.01 |
| `nodes` | doc02.04.05 |
| `notation` | doc01.03.01 |
| `oracles` | doc01.03.04 |
| `organizers` | doc01.03.01, doc01.03.03, doc02.04.04, doc02.06.05 |
| `packages` | doc02.01, doc02.06.07 |
| `pipeline` | doc02.02, doc02.04.05 |
| `planning` | doc01.01.04.01 |
| `polarity` | doc02.06.02 |
| `ports` | doc01.02.04, doc02.04.02, doc02.06.02 |
| `presentation` | doc01.03.01, doc01.03.03, doc02.04.04, doc02.06.05 |
| `primary-source` | doc01.01.04.00 |
| `primitives` | doc02.04.06 |
| `principles` | doc01.01.01, doc01.01.02 |
| `product` | doc01.00 |
| `properties` | doc01.03.04 |
| `reconciliation` | doc01.02.02, doc01.03.06, doc02.02 |
| `rendering` | doc01.03.01, doc02.04.04 |
| `research` | doc01.03.00 |
| `retrieval` | doc00.05, doc01.03.07 |
| `schemas` | doc02.04.02 |
| `scripts` | doc01.02.02, doc01.03.06, doc02.02 |
| `seeds` | doc02.06.07 |
| `server` | doc01.02.05, doc02.05 |
| `skills` | doc01.03.02 |
| `spec-driven` | doc01.03.05, doc01.03.06 |
| `specifications` | doc01.03.07 |
| `state` | doc02.04.01, doc02.06.01, doc02.06.06 |
| `state-management` | doc01.03.03 |
| `static-analysis` | doc01.03.06 |
| `structure` | doc00.02 |
| `styling` | doc02.04.07 |
| `sync` | doc02.04.05 |
| `terms` | doc01.01.03, doc02.04.08 |
| `testability` | doc01.03.04 |
| `testing` | doc01.03.04 |
| `tokens` | doc01.03.02 |
| `tools` | doc01.02.02 |
| `ui` | doc02.04.07 |
| `use-case` | doc01.02.06 |
| `verification` | doc01.03.04 |
| `viewport` | doc02.04.06 |
| `vision` | doc01.01.04.00 |
| `vscode` | doc01.02.03, doc02.03 |
| `wagons` | doc01.03.03 |
| `waypoints` | doc02.04.05 |
| `web` | doc01.02.05, doc02.05 |
| `workflow` | doc00.06, doc01.02.06 |
| `workspace` | doc01.02.01, doc01.02.02, doc02.06.09 |
| `yjs` | doc02.04.01, doc02.06.01, doc02.06.06 |
