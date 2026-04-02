# .carta/ Manifest

Machine-readable index for AI navigation. Read this file first, then open only the docs relevant to your query.

**Retrieval strategy:** See doc00.04 for AI retrieval patterns.

## Column Definitions

- **Ref**: Cross-reference ID (`docXX.YY.ZZ`)
- **File**: Path relative to title directory
- **Summary**: One-line description for semantic matching
- **Tags**: Keywords for file-path→doc mapping
- **Deps**: Doc refs to check when this doc changes
- **Refs**: Reverse deps — docs that list this one in their Deps (computed automatically)

## 00-codex — Codex Index

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc00.00 | `00-index.md` | Codex section index: what meta-documentation covers | index, meta | — | — |
| doc00.01 | `01-about.md` | Why this workspace exists, two-sources-of-truth theory, how to read | docs, meta, theory | — | — |
| doc00.02 | `02-maintenance.md` | Doc lifecycle — unfolding philosophy, development loop, versioning, epochs | docs, maintenance, philosophy | — | doc01.01.00 |
| doc00.03 | `03-conventions.md` | docXX.YY syntax, front matter, file naming | docs, conventions | — | doc00.07 |
| doc00.04 | `04-ai-retrieval.md` | AI retrieval patterns, legal RAG inspiration | docs, ai, retrieval | — | doc01.05.08.07 |
| doc00.05 | `05-taxonomy.md` | Title system rationale, Diataxis spirit | docs, structure | — | doc01.01.00 |
| doc00.06 | `06-ai-agent-integration.md` | AI workflow patterns: spec-to-code, code-to-spec, MCP setup, guide directory | ai, workflow, mcp, guides | doc01.05.08.03 | — |
| doc00.07 | `07-docs-syntax-reference.md` | Formal grammar and extraction rules for doc references, sections, frontmatter, and MANIFEST | docs, syntax, reference, sections, grammar | doc00.03 | — |

## 01-carta-gold — Carta Gold

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.00 | `00-index.md` |  |  | — | — |

### Projects

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.01.00 | `01-projects/00-index.md` | Objective-driven workspaces that track changes needed across doc01.05–doc01.04.02 | projects | doc00.05, doc00.02 | — |
| doc01.01.01.00 | `01-projects/01-product-design-ui/00-index.md` | Rework the canvas engine to support structured product modeling tools for nontechnical users | project, canvas, product-modeling, editors | doc01.05.08.10, doc01.03.07, doc01.05.06.02 | doc01.04.09 |
| doc01.01.01.01 | `01-projects/01-product-design-ui/01-gap-analysis.md` | What exists today vs what's needed for structured product modeling tools | project, gap-analysis, canvas, product-modeling | doc01.05.08.10, doc01.03.07, doc01.05.06.02, doc01.05.06.04, doc01.04.06 | doc01.01.01.02, doc01.01.01.03.00 |
| doc01.01.01.02 | `01-projects/01-product-design-ui/02-engine-changes.md` | Canvas engine rework required to support the full range of product design editors | project, canvas-engine, architecture | doc01.03.07, doc01.04.06, doc01.01.01.01 | doc01.01.01.03.00 |
| doc01.01.01.03.00 | `01-projects/01-product-design-ui/03-structures/00-index.md` | The product design structures and their visual editors — from doc01.05.08.10 editor metaphors to real tools | project, product-modeling, editors, structures | doc01.05.08.10, doc01.01.01.01, doc01.01.01.02 | — |
| doc01.01.01.03.01 | `01-projects/01-product-design-ui/03-structures/01-enumerations.md` | Enumeration structure — data model, YAML format, UI design, and interaction vocabulary | project, enumerations, ui, structures | doc01.01.01.03, doc01.05.08.10 | — |
| doc01.01.01.03.02 | `01-projects/01-product-design-ui/03-structures/02-process-flow.md` | Process flow (flowchart) structure — data model, UI design, canvas interactions, and engine requirements | project, process-flow, flowchart, ui, structures, canvas | doc01.01.01.03, doc01.05.08.10, doc01.03.07 | — |
| doc01.01.01.04 | `01-projects/01-product-design-ui/04-user-experience.md` | How users interact with product design structures — nouns, verbs, and flows | project, user-experience, product-modeling, canvas | doc01.01.01.03, doc01.05.02 | doc01.04.09 |

### Code Shapes

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.02.00 | `02-code-shapes/00-index.md` |  |  | — | — |

### Architecture

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.03.00 | `03-architecture/00-index.md` |  |  | — | — |
| doc01.03.01 | `03-architecture/01-overview.md` | Layer architecture, monorepo structure, data flow | architecture, packages | — | doc01.04.02 |
| doc01.03.02 | `03-architecture/02-script-pipeline.md` | Architecture considerations for spec-code reconciliation — mechanism-agnostic, research-stage | reconciliation, architecture, specs, alignment | doc01.05.07 | — |
| doc01.03.03 | `03-architecture/03-vscode-extension.md` | Extension architecture — WebView canvas viewer, workspace tree provider | vscode, extension, architecture | doc01.03.03 | doc01.03.03 |
| doc01.03.04 | `03-architecture/04-canvas-state.md` | Yjs Y.Doc, state partitioning, hooks, adapters | state, yjs, hooks, adapters | doc01.05.01 | — |
| doc01.03.05 | `03-architecture/05-frontend-architecture.md` | Four-layer component model, state partitioning | components, hooks, architecture | doc01.05.02, doc01.03.08 | doc01.03.06, doc01.03.07, doc01.04.06, doc01.05.08.03, doc01.05.08.04 |
| doc01.03.06 | `03-architecture/06-data-pipelines.md` | Map.tsx memo cascades, node/edge pipelines, waypoint flow, write-back points | pipeline, edges, nodes, waypoints, sync, Map | doc01.03.05, doc01.04.08, doc01.05.02 | — |
| doc01.03.07 | `03-architecture/07-canvas-engine.md` | Cactus — composable canvas primitives: Canvas, useViewport, useNodeDrag, useConnectionDrag, ConnectionHandle, and more | canvas-engine, cactus, viewport, connections, primitives | doc01.03.05 | doc01.01.01.00, doc01.01.01.01, doc01.01.01.02, doc01.01.01.03.02 |
| doc01.03.08 | `03-architecture/08-design-system.md` | Depth system, island pattern, colors, typography | design, ui, styling, lod | — | doc01.03.05 |
| doc01.03.09 | `03-architecture/09-web-platform.md` | Future server architecture — git-backed workspace, WebSocket sync, REST API | server, web, architecture, git | doc01.04.01 | doc01.04.04.03, doc01.04.07, doc01.04.08.02, doc01.04.08.07 |
| doc01.03.10.00 | `03-architecture/10-design-patterns/00-index.md` | Language-specific patterns and conventions for AI-maintainable code | patterns, conventions, ai, architecture | — | — |
| doc01.03.10.01 | `03-architecture/10-design-patterns/01-python-for-ai.md` | File structure, typing, naming, testability patterns for AI-maintained Python | python, patterns, ai, conventions, testing, typing | doc01.03.10 | — |

### Product Design

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.04.00 | `04-product-design/00-index.md` |  |  | — | — |
| doc01.04.01 | `04-product-design/01-workspace-scripts.md` | Design details for the Carta Docs API — command semantics, delivery mechanisms, scope boundary | docs-api, workspace, tools, scripts | doc01.05.06.01 | doc01.03.09 |
| doc01.04.02 | `04-product-design/02-cli-user-flow.md` | How users install the carta CLI, hydrate a repo, and use it for workspace operations | cli, workflow, installation, use-case | doc01.03.01 | — |
| doc01.04.03 | `04-product-design/03-vscode-extension.md` | Canvas viewer and workspace browser for VS Code | vscode, extension, canvas | doc01.05.05, doc01.05.06.02 | — |
| doc01.04.04.00 | `04-product-design/04-web-platform/00-index.md` | Web client for nontechnical spec editing — conversational AI and direct editing flows | web, server, collaboration, git, ai, specs | doc01.05.06.02, doc01.05.05, doc01.05.02 | doc01.04.04.01, doc01.04.04.02, doc01.04.04.03 |
| doc01.04.04.01 | `04-product-design/04-web-platform/01-conversational-flow.md` | AI-heavy interaction flavor — agent elicits domain knowledge and produces specs | web, ai, specs, workflow | doc01.04.04.00 | — |
| doc01.04.04.02 | `04-product-design/04-web-platform/02-direct-editing-flow.md` | Editor-heavy interaction flavor — user writes, AI transforms into well-formed specs | web, ai, specs, workflow, editor | doc01.04.04.00 | — |
| doc01.04.04.03 | `04-product-design/04-web-platform/03-conflict-resolution.md` | Server-side conflict handling for simultaneous nontechnical users | web, collaboration, conflicts, server | doc01.04.04.00, doc01.03.09 | — |
| doc01.04.05 | `04-product-design/05-metamodel.md` | M2/M1/M0 metamodel, DataKind, ConstructSchema | metamodel, schemas, ports | doc01.05.02 | — |
| doc01.04.06 | `04-product-design/06-presentation-model.md` | Presentation model, organizers, layout strategies, visual vs semantic | presentation, organizers, layout, rendering | doc01.03.05, doc01.05.02 | doc01.01.01.01, doc01.01.01.02 |
| doc01.04.07 | `04-product-design/07-canvas-glossary.md` | Canvas-specific vocabulary — construct, schema, port, polarity, organizer, LOD | glossary, canvas, terms | doc01.03.09 | — |
| doc01.04.08.00 | `04-product-design/08-decisions/00-index.md` | Architecture Decision Records | index, adr, decisions | — | — |
| doc01.04.08.01 | `04-product-design/08-decisions/01-yjs-state.md` | ADR: Yjs as single state store | adr, yjs, state | doc01.05.02 | — |
| doc01.04.08.02 | `04-product-design/08-decisions/02-port-polarity.md` | ADR: five-value polarity model | adr, ports, polarity | doc01.03.09 | — |
| doc01.04.08.03 | `04-product-design/08-decisions/03-output-formatter-registry.md` | ADR: extensible formatter registry | adr, compiler, formatters | — | — |
| doc01.04.08.04 | `04-product-design/08-decisions/04-unified-deployment.md` | ADR: simplified deployment config | adr, deployment, config | doc01.05.04 | — |
| doc01.04.08.05 | `04-product-design/08-decisions/05-presentation-model-organizers.md` | ADR: presentation model, organizers replace visual groups | adr, presentation, organizers, layout | doc01.04.08 | — |
| doc01.04.08.06 | `04-product-design/08-decisions/06-yjs-authoritative-layout.md` | ADR: Yjs-authoritative layout, RF as renderer only, eliminate 3-layer sync | adr, state, layout, yjs, architecture | doc01.05.02, doc01.05.08.03 | — |
| doc01.04.08.07 | `04-product-design/08-decisions/07-package-loading-architecture.md` | ADR: Package-based schema loading, dual identity (UUID + content hash), manifest, snapshots | adr, packages, loading, seeds, identity, library | doc01.03.09 | — |
| doc01.04.08.08 | `04-product-design/08-decisions/08-resources.md` | **Archived.** ADR: Resources — superseded by filesystem-first workspace (ADR 009) | adr, archived | — | — |
| doc01.04.08.09 | `04-product-design/08-decisions/09-filesystem-workspace.md` | ADR: Filesystem-first workspace — `.carta/` directory, JSON canonical with binary sidecar, spec groups as directories, narrowed MCP surface, `carta serve .` | adr, workspace, filesystem, deployment, mcp, groups | doc01.05.04 | doc01.05.08.06 |
| doc01.04.09 | `04-product-design/09-product-design-server.md` | Thin filesystem server that bridges the product design canvas to local files — REST API for canvas and source CRUD, SSE for live file watching | server, product-design, canvas, filesystem, api | doc01.01.01.00, doc01.01.01.04 | — |

### Product Strategy

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc01.05.00 | `05-product-strategy/00-index.md` |  |  | — | — |
| doc01.05.01 | `05-product-strategy/01-mission.md` | Core goal — spec-driven development tool | mission, principles | — | doc01.03.04, doc01.05.02, doc01.05.04.01, doc01.05.04.02, doc01.05.05, doc01.05.06.02, doc01.05.06.04 |
| doc01.05.02 | `05-product-strategy/02-principles.md` | Design principles: symmetric storage, inverse derivability, arrangement agnosticism | principles, design | doc01.05.01 | doc01.01.01.04, doc01.03.05, doc01.03.06, doc01.04.04.00, doc01.04.05, doc01.04.06, doc01.04.08.01, doc01.04.08.06, doc01.05.07, doc01.05.08.05, doc01.05.08.06, doc01.05.08.08 |
| doc01.05.03 | `05-product-strategy/03-glossary.md` | Canonical vocabulary: products, workspace, spec, shape | glossary, terms | — | — |
| doc01.05.04.00 | `05-product-strategy/04-primary-sources/00-index.md` | Author's original writings, directional intent | inspiration, vision, primary-source | — | — |
| doc01.05.04.01 | `05-product-strategy/04-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | AI, coding, planning, category theory, morphisms, artifact-driven development | doc01.05.01 | doc01.05.04.02, doc01.05.08.05, doc01.05.08.06, doc01.05.08.09, doc01.05.08.10 |
| doc01.05.04.02 | `05-product-strategy/04-primary-sources/02-theoretical-foundations.md` | Why spec-driven development works with AI — primary sources from Alexander, Simon, and Shannon, plus the decreasing indirection thesis | spec-driven, AI, theory, patterns, complexity, information-theory, artifact-driven development | doc01.05.01, doc01.05.04.01, doc01.05.08.05 | doc01.05.08.09, doc01.05.08.11 |
| doc01.05.05 | `05-product-strategy/05-docs-system.md` | The .carta/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST | docs, workspace, format | doc01.05.01 | doc01.04.03, doc01.04.04.00, doc01.05.06.01, doc01.05.07, doc01.05.08.08 |
| doc01.05.06.00 | `05-product-strategy/06-products/00-index.md` |  |  | — | — |
| doc01.05.06.01 | `05-product-strategy/06-products/01-cli-scripts.md` | Deterministic Python operations on .carta/ workspace documents — designed primarily for AI agents | docs-api, workspace, tools, scripts, ai | doc01.05.05 | doc01.04.01 |
| doc01.05.06.02 | `05-product-strategy/06-products/02-canvas.md` | Visual architecture editor — typed constructs, ports, connections, LOD rendering | canvas, editor, constructs, ports | doc01.05.01 | doc01.01.01.00, doc01.01.01.01, doc01.04.03, doc01.04.04.00 |
| doc01.05.06.03 | `05-product-strategy/06-products/03-spec-web-editor.md` |  |  | — | — |
| doc01.05.06.04 | `05-product-strategy/06-products/04-decision-table-renderer.md` | GUI editor for decision tables — structured data storage, rich table editing, markdown export for AI consumption | decision-tables, product, editor, rules | doc01.05.01 | doc01.01.01.01, doc01.05.08.10 |
| doc01.05.07 | `05-product-strategy/07-spec-reconciliation.md` | Comparing specifications against source code to detect drift and suggest alignment — mechanism-agnostic | reconciliation, specs, spec-driven, alignment | doc01.05.05, doc01.05.02 | doc01.03.02, doc01.05.08.06 |
| doc01.05.08.00 | `05-product-strategy/08-research/00-index.md` | Research section index: session format, what belongs here | index, research | — | — |
| doc01.05.08.01 | `05-product-strategy/08-research/01-visual-semantics-in-organizers.md` | Shape differentiation, sequence badges, icon markers for organizer contents | presentation, rendering, organizers, bpmn, notation, dual-mandate | doc01.05.06, doc01.05.06, doc01.05.06 | — |
| doc01.05.08.02 | `05-product-strategy/08-research/02-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | tokens, efficiency, skills, agents, context-engineering | — | doc01.05.08.04 |
| doc01.05.08.03 | `05-product-strategy/08-research/03-wagon-aware-layout-architecture.md` | Wagon layout units, 3-layer sync, snap normalization, state pitfalls | layout, organizers, wagons, presentation, state-management | doc01.05.06, doc01.03.05 | doc00.06, doc01.04.08.06 |
| doc01.05.08.04 | `05-product-strategy/08-research/04-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc01.05.08.02, doc01.03.05 | — |
| doc01.05.08.05 | `05-product-strategy/08-research/05-decomposition-and-composition-theory.md` | Mathematical foundations for spec-driven development — what makes a good decomposition, and how pieces compose back | decomposition, composition, information-theory, modularity, spec-driven, category-theory, complexity | doc01.05.02, doc01.05.04.01 | doc01.05.04.02, doc01.05.08.09 |
| doc01.05.08.06 | `05-product-strategy/08-research/06-spec-code-reconciliation.md` | Two-source-of-truth model, filesystem data formats, deterministic scripts, LLM-assisted reconciliation between product specs and codebases | spec-driven, reconciliation, formats, scripts, decomposition, information-theory, llm, static-analysis | doc01.05.02, doc01.05.04.01, doc01.05.07, doc01.04.08.09 | doc01.05.08.07, doc01.05.08.08 |
| doc01.05.08.07 | `05-product-strategy/08-research/07-documentation-systems-and-retrieval.md` | Principles behind hierarchical docs systems, agentic search improvement, scientific comparison of docs structures, and what makes individual specs good enough for code generation | docs, retrieval, ai, specifications, elicitation, information-architecture, evaluation | doc00.04, doc01.05.08.06 | — |
| doc01.05.08.08 | `05-product-strategy/08-research/08-spec-format-vocabulary.md` | What parts of the spec format Carta has opinions on vs what's up to users — format concerns vs user concerns | specs, vocabulary, format, agnosticism, workspace, principles | doc01.05.05, doc01.05.02, doc01.05.08, doc01.05.08.06 | — |
| doc01.05.08.09 | `05-product-strategy/08-research/09-product-as-transition-system.md` | Modeling products as guarded transition systems — verifiable reachability, dead-end detection, and deductive architecture from product properties | product-modeling, transition-systems, verification, architecture, reachability, spec-driven, artifact-driven development | doc01.05.04.01, doc01.05.04.02, doc01.05.08.05 | doc01.05.08.10, doc01.05.08.11 |
| doc01.05.08.10 | `05-product-strategy/08-research/10-structured-product-modeling.md` | The set of formal structures needed to fully describe a business product — entity models, decision tables, state machines, and six more — plus how they compose | product-modeling, decision-tables, state-machines, entities, enumerations, constraints, spec-driven | doc01.05.08.09, doc01.05.06.04, doc01.05.04.01 | doc01.01.01.00, doc01.01.01.01, doc01.01.01.03.00, doc01.01.01.03.01, doc01.01.01.03.02, doc01.05.08.11 |
| doc01.05.08.11 | `05-product-strategy/08-research/11-action-based-api-design.md` | Why REST taxonomies are dead structures, how action-based APIs grow additively, and the connection between API shape and living systems | api, rest, rpc, trpc, concept-design, living-structure, additive-growth | doc01.05.04.02, doc01.05.08.09, doc01.05.08.10 | — |

## 02-carta — Carta

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc02.00 | `00-index.md` |  |  | — | — |
| doc02.01 | `01-vision.md` | Carta is the transmission mechanism between AI and SDLC — converting AI capability into software through structured specifications | vision, transmission, ai, sdlc, spec-driven | — | doc02.02.00 |

### Concepts

| Ref | File | Summary | Tags | Deps | Refs |
|-----|------|---------|------|------|------|

| doc02.02.00 | `02-concepts/00-index.md` | Jackson-style concept inventory for Carta — the domain is software production | concepts, jackson, design | doc02.01 | — |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `AI` | doc01.05.04.01, doc01.05.04.02 |
| `Map` | doc01.03.06 |
| `adapters` | doc01.03.04 |
| `additive-growth` | doc01.05.08.11 |
| `adr` | doc01.04.08.00, doc01.04.08.01, doc01.04.08.02, doc01.04.08.03, doc01.04.08.04, doc01.04.08.05, doc01.04.08.06, doc01.04.08.07, doc01.04.08.08, doc01.04.08.09 |
| `agents` | doc01.05.08.02, doc01.05.08.04 |
| `agnosticism` | doc01.05.08.08 |
| `ai` | doc00.04, doc00.06, doc01.03.10.00, doc01.03.10.01, doc01.04.04.00, doc01.04.04.01, doc01.04.04.02, doc01.05.06.01, doc01.05.08.07, doc02.01 |
| `alignment` | doc01.03.02, doc01.05.07 |
| `api` | doc01.04.09, doc01.05.08.11 |
| `architecture` | doc01.01.01.02, doc01.03.01, doc01.03.02, doc01.03.03, doc01.03.05, doc01.03.09, doc01.03.10.00, doc01.04.08.06, doc01.05.08.09 |
| `archived` | doc01.04.08.08 |
| `artifact-driven development` | doc01.05.04.01, doc01.05.04.02, doc01.05.08.09 |
| `bpmn` | doc01.05.08.01 |
| `cactus` | doc01.03.07 |
| `canvas` | doc01.01.01.00, doc01.01.01.01, doc01.01.01.03.02, doc01.01.01.04, doc01.04.03, doc01.04.07, doc01.04.09, doc01.05.06.02 |
| `canvas-engine` | doc01.01.01.02, doc01.03.07 |
| `category theory` | doc01.05.04.01 |
| `category-theory` | doc01.05.08.05 |
| `cli` | doc01.04.02 |
| `coding` | doc01.05.04.01 |
| `collaboration` | doc01.04.04.00, doc01.04.04.03 |
| `compiler` | doc01.04.08.03 |
| `complexity` | doc01.05.04.02, doc01.05.08.05 |
| `components` | doc01.03.05 |
| `composition` | doc01.05.08.05 |
| `concept-design` | doc01.05.08.11 |
| `concepts` | doc02.02.00 |
| `config` | doc01.04.08.04 |
| `conflicts` | doc01.04.04.03 |
| `connections` | doc01.03.07 |
| `constraints` | doc01.05.08.10 |
| `constructs` | doc01.05.06.02 |
| `context-engineering` | doc01.05.08.02 |
| `conventions` | doc00.03, doc01.03.10.00, doc01.03.10.01 |
| `decision-tables` | doc01.05.06.04, doc01.05.08.10 |
| `decisions` | doc01.04.08.00 |
| `decomposition` | doc01.05.08.05, doc01.05.08.06 |
| `deployment` | doc01.04.08.04, doc01.04.08.09 |
| `design` | doc01.03.08, doc01.05.02, doc02.02.00 |
| `docs` | doc00.01, doc00.02, doc00.03, doc00.04, doc00.05, doc00.07, doc01.05.05, doc01.05.08.07 |
| `docs-api` | doc01.04.01, doc01.05.06.01 |
| `dual-mandate` | doc01.05.08.01 |
| `edges` | doc01.03.06 |
| `editor` | doc01.04.04.02, doc01.05.06.02, doc01.05.06.04 |
| `editors` | doc01.01.01.00, doc01.01.01.03.00 |
| `efficiency` | doc01.05.08.02 |
| `elicitation` | doc01.05.08.07 |
| `entities` | doc01.05.08.10 |
| `enumerations` | doc01.01.01.03.01, doc01.05.08.10 |
| `epistemology` | doc01.05.08.04 |
| `evaluation` | doc01.05.08.07 |
| `extension` | doc01.03.03, doc01.04.03 |
| `filesystem` | doc01.04.08.09, doc01.04.09 |
| `flowchart` | doc01.01.01.03.02 |
| `format` | doc01.05.05, doc01.05.08.08 |
| `formats` | doc01.05.08.06 |
| `formatters` | doc01.04.08.03 |
| `gap-analysis` | doc01.01.01.01 |
| `git` | doc01.03.09, doc01.04.04.00 |
| `glossary` | doc01.04.07, doc01.05.03 |
| `grammar` | doc00.07 |
| `groups` | doc01.04.08.09 |
| `guides` | doc00.06 |
| `hooks` | doc01.03.04, doc01.03.05 |
| `identity` | doc01.04.08.07 |
| `index` | doc00.00, doc01.04.08.00, doc01.05.08.00 |
| `information-architecture` | doc01.05.08.07 |
| `information-theory` | doc01.05.04.02, doc01.05.08.05, doc01.05.08.06 |
| `inspiration` | doc01.05.04.00 |
| `installation` | doc01.04.02 |
| `jackson` | doc02.02.00 |
| `layout` | doc01.04.06, doc01.04.08.05, doc01.04.08.06, doc01.05.08.03 |
| `library` | doc01.04.08.07 |
| `living-structure` | doc01.05.08.11 |
| `llm` | doc01.05.08.06 |
| `loading` | doc01.04.08.07 |
| `lod` | doc01.03.08 |
| `maintenance` | doc00.02 |
| `mcp` | doc00.06, doc01.04.08.09 |
| `meta` | doc00.00, doc00.01 |
| `metamodel` | doc01.04.05 |
| `mission` | doc01.05.01 |
| `modularity` | doc01.05.08.05 |
| `morphisms` | doc01.05.04.01 |
| `nodes` | doc01.03.06 |
| `notation` | doc01.05.08.01 |
| `oracles` | doc01.05.08.04 |
| `organizers` | doc01.04.06, doc01.04.08.05, doc01.05.08.01, doc01.05.08.03 |
| `packages` | doc01.03.01, doc01.04.08.07 |
| `patterns` | doc01.03.10.00, doc01.03.10.01, doc01.05.04.02 |
| `philosophy` | doc00.02 |
| `pipeline` | doc01.03.06 |
| `planning` | doc01.05.04.01 |
| `polarity` | doc01.04.08.02 |
| `ports` | doc01.04.05, doc01.04.08.02, doc01.05.06.02 |
| `presentation` | doc01.04.06, doc01.04.08.05, doc01.05.08.01, doc01.05.08.03 |
| `primary-source` | doc01.05.04.00 |
| `primitives` | doc01.03.07 |
| `principles` | doc01.05.01, doc01.05.02, doc01.05.08.08 |
| `process-flow` | doc01.01.01.03.02 |
| `product` | doc01.05.06.04 |
| `product-design` | doc01.04.09 |
| `product-modeling` | doc01.01.01.00, doc01.01.01.01, doc01.01.01.03.00, doc01.01.01.04, doc01.05.08.09, doc01.05.08.10 |
| `project` | doc01.01.01.00, doc01.01.01.01, doc01.01.01.02, doc01.01.01.03.00, doc01.01.01.03.01, doc01.01.01.03.02, doc01.01.01.04 |
| `projects` | doc01.01.00 |
| `properties` | doc01.05.08.04 |
| `python` | doc01.03.10.01 |
| `reachability` | doc01.05.08.09 |
| `reconciliation` | doc01.03.02, doc01.05.07, doc01.05.08.06 |
| `reference` | doc00.07 |
| `rendering` | doc01.04.06, doc01.05.08.01 |
| `research` | doc01.05.08.00 |
| `rest` | doc01.05.08.11 |
| `retrieval` | doc00.04, doc01.05.08.07 |
| `rpc` | doc01.05.08.11 |
| `rules` | doc01.05.06.04 |
| `schemas` | doc01.04.05 |
| `scripts` | doc01.04.01, doc01.05.06.01, doc01.05.08.06 |
| `sdlc` | doc02.01 |
| `sections` | doc00.07 |
| `seeds` | doc01.04.08.07 |
| `server` | doc01.03.09, doc01.04.04.00, doc01.04.04.03, doc01.04.09 |
| `skills` | doc01.05.08.02 |
| `spec-driven` | doc01.05.04.02, doc01.05.07, doc01.05.08.05, doc01.05.08.06, doc01.05.08.09, doc01.05.08.10, doc02.01 |
| `specifications` | doc01.05.08.07 |
| `specs` | doc01.03.02, doc01.04.04.00, doc01.04.04.01, doc01.04.04.02, doc01.05.07, doc01.05.08.08 |
| `state` | doc01.03.04, doc01.04.08.01, doc01.04.08.06 |
| `state-machines` | doc01.05.08.10 |
| `state-management` | doc01.05.08.03 |
| `static-analysis` | doc01.05.08.06 |
| `structure` | doc00.05 |
| `structures` | doc01.01.01.03.00, doc01.01.01.03.01, doc01.01.01.03.02 |
| `styling` | doc01.03.08 |
| `sync` | doc01.03.06 |
| `syntax` | doc00.07 |
| `terms` | doc01.04.07, doc01.05.03 |
| `testability` | doc01.05.08.04 |
| `testing` | doc01.03.10.01, doc01.05.08.04 |
| `theory` | doc00.01, doc01.05.04.02 |
| `tokens` | doc01.05.08.02 |
| `tools` | doc01.04.01, doc01.05.06.01 |
| `transition-systems` | doc01.05.08.09 |
| `transmission` | doc02.01 |
| `trpc` | doc01.05.08.11 |
| `typing` | doc01.03.10.01 |
| `ui` | doc01.01.01.03.01, doc01.01.01.03.02, doc01.03.08 |
| `use-case` | doc01.04.02 |
| `user-experience` | doc01.01.01.04 |
| `verification` | doc01.05.08.04, doc01.05.08.09 |
| `viewport` | doc01.03.07 |
| `vision` | doc01.05.04.00, doc02.01 |
| `vocabulary` | doc01.05.08.08 |
| `vscode` | doc01.03.03, doc01.04.03 |
| `wagons` | doc01.05.08.03 |
| `waypoints` | doc01.03.06 |
| `web` | doc01.03.09, doc01.04.04.00, doc01.04.04.01, doc01.04.04.02, doc01.04.04.03 |
| `workflow` | doc00.06, doc01.04.02, doc01.04.04.01, doc01.04.04.02 |
| `workspace` | doc01.04.01, doc01.04.08.09, doc01.05.05, doc01.05.06.01, doc01.05.08.08 |
| `yjs` | doc01.03.04, doc01.04.08.01, doc01.04.08.06 |
