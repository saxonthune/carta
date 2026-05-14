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
- **Attachments**: Non-md files sharing the doc's numeric prefix. Sidecar artifacts that travel with the doc during structural operations. Purely filesystem-derived; not a frontmatter field.

Orphaned attachments (non-md files with no corresponding root .md) are reported as warnings on stderr during regeneration and do not appear in this table.

## 01-codex — Codex Index

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc01.00 | `00-index.md` | Codex section index: what meta-documentation covers | index, meta | — | — | — |
| doc01.01 | `01-about.md` | Why this workspace exists, two-sources-of-truth theory, how to read | docs, meta, theory | — | — | — |
| doc01.02 | `02-maintenance.md` | Doc philosophy — declarative intent, banned patterns, when to grow detail | docs, maintenance, philosophy | — | — | — |
| doc01.03 | `03-conventions.md` | docXX.YY syntax, front matter, file naming, writing style | docs, conventions | — | doc01.06 | — |
| doc01.04 | `04-ai-retrieval.md` | AI retrieval patterns, legal RAG inspiration | docs, ai, retrieval | — | doc04.08.05 | — |
| doc01.05 | `05-taxonomy.md` | Title system rationale, Diataxis spirit | docs, structure | — | — | — |
| doc01.06 | `06-docs-syntax-reference.md` | Formal grammar and extraction rules for doc references, sections, frontmatter, and MANIFEST | docs, syntax, reference, sections, grammar | doc01.03 | — | — |

## 02-architecture — Architecture

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc02.00 | `00-index.md` |  |  | — | — | — |
| doc02.01 | `01-script-pipeline.md` | Architecture considerations for spec-code reconciliation — mechanism-agnostic, research-stage | reconciliation, architecture, specs, alignment | doc04.07 | doc03.03 | — |

### Design Patterns

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc02.02.00 | `02-design-patterns/00-index.md` | Language-specific patterns and conventions for AI-maintainable code | patterns, conventions, ai, architecture | — | — | — |
| doc02.02.01 | `02-design-patterns/01-python-for-ai.md` | File structure, typing, naming, testability patterns for AI-maintained Python | python, patterns, ai, conventions, testing, typing | doc02.02 | — | — |

## 03-product-design — Product Design

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.00 | `00-index.md` |  |  | — | — | — |
| doc03.03 | `03-cli-user-flow.md` | How users install the carta CLI, hydrate a repo, and use it for workspace operations | cli, workflow, installation, use-case | doc02.01 | — | — |

### Workspace Scripts

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.01.00 | `01-workspace-scripts/00-index.md` |  |  | — | — | — |
| doc03.01.01 | `01-workspace-scripts/01-workspace-scripts.md` | Design details for the Carta Docs API — command semantics, delivery mechanisms, scope boundary | docs-api, workspace, tools, scripts | doc04.06.01 | — | — |
| doc03.01.02 | `01-workspace-scripts/02-invariants.md` | Invariants that every valid .carta/ workspace must satisfy at rest — functions of state, oracles for property tests | invariants, workspace, properties, specs | — | doc03.01.03, doc03.01.04, doc03.01.05.00, doc03.01.05.01, doc03.01.05.02, doc03.01.05.03, doc03.01.05.04, doc03.01.05.05, doc03.01.05.06, doc03.01.05.07, doc03.01.05.08, doc03.01.05.09, doc03.01.05.10 | — |
| doc03.01.03 | `01-workspace-scripts/03-properties.md` | PROP-* property statements for the action catalog, each tagged with the actions and invariants they correlate | properties, testing, invariants, specs | doc03.01.02 | doc03.01.05.00, doc03.01.05.01, doc03.01.05.02, doc03.01.05.03, doc03.01.05.04, doc03.01.05.05, doc03.01.05.06, doc03.01.05.07, doc03.01.05.08, doc03.01.05.09, doc03.01.05.10 | — |
| doc03.01.04 | `01-workspace-scripts/04-errors.md` | ERR-* error codes — one per guard failure, mapped to exception classes and CLI exit behavior | errors, guards, specs | doc03.01.02 | doc03.01.05.00, doc03.01.05.01, doc03.01.05.02, doc03.01.05.03, doc03.01.05.04, doc03.01.05.05, doc03.01.05.06, doc03.01.05.07, doc03.01.05.08, doc03.01.05.09, doc03.01.05.10 | — |
| doc03.01.05.00 | `01-workspace-scripts/05-actions/00-index.md` | Action catalog — one doc per Carta Docs API command, each with a machine-readable YAML sidecar | action-catalog, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | — |
| doc03.01.05.01 | `01-workspace-scripts/05-actions/01-punch.md` | Action spec for carta punch: convert NN-slug.md into NN-slug/00-index.md, moving bundle siblings with it | action-catalog, punch, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.02 | `01-workspace-scripts/05-actions/02-move.md` | Action spec for carta move: relocate a file or directory, renumbering siblings and rewriting refs | action-catalog, move, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.03 | `01-workspace-scripts/05-actions/03-delete.md` | Action spec for carta delete: remove files or directories, renumber siblings, rewrite refs, and report orphaned refs | action-catalog, delete, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.04 | `01-workspace-scripts/05-actions/04-create.md` | Action spec for carta create: write a new NN-slug.md at a position in a directory, with draft frontmatter | action-catalog, create, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.05 | `01-workspace-scripts/05-actions/05-flatten.md` | Action spec for carta flatten: hoist a directory's children into the parent and renumber | action-catalog, flatten, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.06 | `01-workspace-scripts/05-actions/06-attach.md` | Action spec for carta attach: copy a file into a doc's bundle, sharing the host's NN prefix | action-catalog, attach, docs-api, specs, bundles | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.07 | `01-workspace-scripts/05-actions/07-copy.md` | Action spec for carta copy: bring an outside file in as a numbered entry at a destination | action-catalog, copy, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.08 | `01-workspace-scripts/05-actions/08-rewrite.md` | Action spec for carta rewrite: apply old=new ref rewrites across the workspace | action-catalog, rewrite, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.09 | `01-workspace-scripts/05-actions/09-rename.md` | Action spec for carta rename: change the slug portion of NN-slug without changing NN or refs | action-catalog, rename, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |
| doc03.01.05.10 | `01-workspace-scripts/05-actions/10-regenerate.md` | Action spec for carta regenerate: recompute MANIFEST.md from current workspace state | action-catalog, regenerate, docs-api, specs | doc03.01.02, doc03.01.03, doc03.01.04 | — | yaml |

### Concepts

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.02.00 | `02-concepts/00-index.md` | Jackson-style concept inventory for Carta — the domain is software production | concepts, jackson, design | doc04.02 | — | — |
| doc03.02.01 | `02-concepts/01-attachment.md` | Non-md artifacts that inherit a host doc's structural position through prefix co-location | concepts, jackson, attachment, bundles, sidecars | — | — | — |

### Decisions Index

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc03.04.00 | `04-decisions/00-index.md` | Architecture Decision Records | index, adr, decisions | — | — | — |

## 04-product-strategy — Product Strategy

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc04.00 | `00-index.md` |  |  | — | — | — |
| doc04.01 | `01-mission.md` | Core goal — spec-driven development tool | mission, principles | — | doc04.04.01, doc04.04.02, doc04.04.03, doc04.05 | — |
| doc04.02 | `02-vision.md` | Carta is the transmission mechanism between AI and SDLC — converting AI capability into software through structured specifications | vision, transmission, ai, sdlc, spec-driven | — | doc03.02.00 | — |
| doc04.03 | `03-glossary.md` | Canonical vocabulary: products, workspace, spec, shape | glossary, terms | — | — | — |
| doc04.05 | `05-docs-system.md` | The .carta/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST | docs, workspace, format | doc04.01 | doc04.06.01, doc04.07, doc04.08.06 | — |
| doc04.07 | `07-spec-reconciliation.md` | Comparing specifications against source code to detect drift and suggest alignment — mechanism-agnostic | reconciliation, specs, spec-driven, alignment | doc04.05 | doc02.01, doc04.08.04 | — |

### Primary Sources

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc04.04.00 | `04-primary-sources/00-index.md` | Author's original writings, directional intent | inspiration, vision, primary-source | — | — | — |
| doc04.04.01 | `04-primary-sources/01-the-carta-experiment.md` | Artifact-driven development, code-minus-one abstraction layers | AI, coding, planning, category theory, morphisms, artifact-driven development | doc04.01 | doc04.04.02, doc04.04.03, doc04.08.03, doc04.08.04, doc04.08.07, doc04.08.08 | — |
| doc04.04.02 | `04-primary-sources/02-theoretical-foundations.md` | Why spec-driven development works with AI — primary sources from Alexander, Simon, and Shannon, plus the decreasing indirection thesis | spec-driven, AI, theory, patterns, complexity, information-theory, artifact-driven development | doc04.01, doc04.04.01, doc04.08.03 | doc04.04.03, doc04.08.07, doc04.08.09 | — |
| doc04.04.03 | `04-primary-sources/03-unfolding-as-development.md` | Embryonic development applied to software — start with a working end-to-end system, let forces cross thresholds before adding complexity, preserve structure at every step | unfolding, methodology, alexander, forces, structure-preserving, ai, development | doc04.01, doc04.04.01, doc04.04.02 | doc04.08.10, doc04.08.11 | — |

### Products

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc04.06.00 | `06-products/00-index.md` |  |  | — | — | — |
| doc04.06.01 | `06-products/01-cli-scripts.md` | Deterministic Python operations on .carta/ workspace documents — designed primarily for AI agents | docs-api, workspace, tools, scripts, ai | doc04.05 | doc03.01.01 | — |

### Research Sessions

| Ref | File | Summary | Tags | Deps | Refs | Attachments |
|-----|------|---------|------|------|------|-------------|

| doc04.08.00 | `08-research/00-index.md` | Research section index: session format, what belongs here | index, research | — | — | — |
| doc04.08.01 | `08-research/01-token-efficiency-in-skills-and-agents.md` | Token optimization patterns: lean extraction, subagent isolation, surgical reads | tokens, efficiency, skills, agents, context-engineering | — | doc04.08.02 | — |
| doc04.08.02 | `08-research/02-verifiability-and-testability.md` | Epistemology of verification, test value hierarchy, decomposition inventory, testability architecture | testing, verification, epistemology, agents, testability, oracles, properties | doc04.08.01 | — | — |
| doc04.08.03 | `08-research/03-decomposition-and-composition-theory.md` | Mathematical foundations for spec-driven development — what makes a good decomposition, and how pieces compose back | decomposition, composition, information-theory, modularity, spec-driven, category-theory, complexity | doc04.04.01 | doc04.04.02, doc04.08.07 | — |
| doc04.08.04 | `08-research/04-spec-code-reconciliation.md` | Two-source-of-truth model, filesystem data formats, deterministic scripts, LLM-assisted reconciliation between product specs and codebases | spec-driven, reconciliation, formats, scripts, decomposition, information-theory, llm, static-analysis | doc04.04.01, doc04.07 | doc04.08.05, doc04.08.06 | — |
| doc04.08.05 | `08-research/05-documentation-systems-and-retrieval.md` | Principles behind hierarchical docs systems, agentic search improvement, scientific comparison of docs structures, and what makes individual specs good enough for code generation | docs, retrieval, ai, specifications, elicitation, information-architecture, evaluation | doc01.04, doc04.08.04 | — | — |
| doc04.08.06 | `08-research/06-spec-format-vocabulary.md` | What parts of the spec format Carta has opinions on vs what's up to users — format concerns vs user concerns | specs, vocabulary, format, agnosticism, workspace, principles | doc04.05, doc04.08, doc04.08.04 | — | — |
| doc04.08.07 | `08-research/07-product-as-transition-system.md` | Modeling products as guarded transition systems — verifiable reachability, dead-end detection, and deductive architecture from product properties | product-modeling, transition-systems, verification, architecture, reachability, spec-driven, artifact-driven development | doc04.04.01, doc04.04.02, doc04.08.03 | doc04.08.08, doc04.08.09 | — |
| doc04.08.08 | `08-research/08-structured-product-modeling.md` | The set of formal structures needed to fully describe a business product — entity models, decision tables, state machines, and six more — plus how they compose | product-modeling, decision-tables, state-machines, entities, enumerations, constraints, spec-driven | doc04.08.07, doc04.04.01 | doc04.08.09 | — |
| doc04.08.09 | `08-research/09-action-based-api-design.md` | Why REST taxonomies are dead structures, how action-based APIs grow additively, and the connection between API shape and living systems | api, rest, rpc, trpc, concept-design, living-structure, additive-growth | doc04.04.02, doc04.08.07, doc04.08.08 | doc04.08.10, doc04.08.11 | — |
| doc04.08.10 | `08-research/10-contract-first-development.md` | The action contract is the skeleton, not the database — define contracts, build screens against mocks, defer persistence until the contract stabilizes | contract-first, mock-first, action-based, unfolding, persistence, methodology | doc04.04.03, doc04.08.09 | doc04.08.11 | — |
| doc04.08.11 | `08-research/11-concept-first-sequencing.md` | How concept-driven design composes with unfolding — concepts before code, contracts before backends, the ordering that makes AI-powered development coherent | concepts, jackson, unfolding, sequencing, methodology, ai | doc04.04.03, doc04.08.10, doc04.08.09 | — | — |

## Tag Index

Quick lookup for file-path→doc mapping:

| Tag | Relevant Docs |
|-----|---------------|
| `AI` | doc04.04.01, doc04.04.02 |
| `action-based` | doc04.08.10 |
| `action-catalog` | doc03.01.05.00, doc03.01.05.01, doc03.01.05.02, doc03.01.05.03, doc03.01.05.04, doc03.01.05.05, doc03.01.05.06, doc03.01.05.07, doc03.01.05.08, doc03.01.05.09, doc03.01.05.10 |
| `additive-growth` | doc04.08.09 |
| `adr` | doc03.04.00 |
| `agents` | doc04.08.01, doc04.08.02 |
| `agnosticism` | doc04.08.06 |
| `ai` | doc01.04, doc02.02.00, doc02.02.01, doc04.02, doc04.04.03, doc04.06.01, doc04.08.05, doc04.08.11 |
| `alexander` | doc04.04.03 |
| `alignment` | doc02.01, doc04.07 |
| `api` | doc04.08.09 |
| `architecture` | doc02.01, doc02.02.00, doc04.08.07 |
| `artifact-driven development` | doc04.04.01, doc04.04.02, doc04.08.07 |
| `attach` | doc03.01.05.06 |
| `attachment` | doc03.02.01 |
| `bundles` | doc03.01.05.06, doc03.02.01 |
| `category theory` | doc04.04.01 |
| `category-theory` | doc04.08.03 |
| `cli` | doc03.03 |
| `coding` | doc04.04.01 |
| `complexity` | doc04.04.02, doc04.08.03 |
| `composition` | doc04.08.03 |
| `concept-design` | doc04.08.09 |
| `concepts` | doc03.02.00, doc03.02.01, doc04.08.11 |
| `constraints` | doc04.08.08 |
| `context-engineering` | doc04.08.01 |
| `contract-first` | doc04.08.10 |
| `conventions` | doc01.03, doc02.02.00, doc02.02.01 |
| `copy` | doc03.01.05.07 |
| `create` | doc03.01.05.04 |
| `decision-tables` | doc04.08.08 |
| `decisions` | doc03.04.00 |
| `decomposition` | doc04.08.03, doc04.08.04 |
| `delete` | doc03.01.05.03 |
| `design` | doc03.02.00 |
| `development` | doc04.04.03 |
| `docs` | doc01.01, doc01.02, doc01.03, doc01.04, doc01.05, doc01.06, doc04.05, doc04.08.05 |
| `docs-api` | doc03.01.01, doc03.01.05.00, doc03.01.05.01, doc03.01.05.02, doc03.01.05.03, doc03.01.05.04, doc03.01.05.05, doc03.01.05.06, doc03.01.05.07, doc03.01.05.08, doc03.01.05.09, doc03.01.05.10, doc04.06.01 |
| `efficiency` | doc04.08.01 |
| `elicitation` | doc04.08.05 |
| `entities` | doc04.08.08 |
| `enumerations` | doc04.08.08 |
| `epistemology` | doc04.08.02 |
| `errors` | doc03.01.04 |
| `evaluation` | doc04.08.05 |
| `flatten` | doc03.01.05.05 |
| `forces` | doc04.04.03 |
| `format` | doc04.05, doc04.08.06 |
| `formats` | doc04.08.04 |
| `glossary` | doc04.03 |
| `grammar` | doc01.06 |
| `guards` | doc03.01.04 |
| `index` | doc01.00, doc03.04.00, doc04.08.00 |
| `information-architecture` | doc04.08.05 |
| `information-theory` | doc04.04.02, doc04.08.03, doc04.08.04 |
| `inspiration` | doc04.04.00 |
| `installation` | doc03.03 |
| `invariants` | doc03.01.02, doc03.01.03 |
| `jackson` | doc03.02.00, doc03.02.01, doc04.08.11 |
| `living-structure` | doc04.08.09 |
| `llm` | doc04.08.04 |
| `maintenance` | doc01.02 |
| `meta` | doc01.00, doc01.01 |
| `methodology` | doc04.04.03, doc04.08.10, doc04.08.11 |
| `mission` | doc04.01 |
| `mock-first` | doc04.08.10 |
| `modularity` | doc04.08.03 |
| `morphisms` | doc04.04.01 |
| `move` | doc03.01.05.02 |
| `oracles` | doc04.08.02 |
| `patterns` | doc02.02.00, doc02.02.01, doc04.04.02 |
| `persistence` | doc04.08.10 |
| `philosophy` | doc01.02 |
| `planning` | doc04.04.01 |
| `primary-source` | doc04.04.00 |
| `principles` | doc04.01, doc04.08.06 |
| `product-modeling` | doc04.08.07, doc04.08.08 |
| `properties` | doc03.01.02, doc03.01.03, doc04.08.02 |
| `punch` | doc03.01.05.01 |
| `python` | doc02.02.01 |
| `reachability` | doc04.08.07 |
| `reconciliation` | doc02.01, doc04.07, doc04.08.04 |
| `reference` | doc01.06 |
| `regenerate` | doc03.01.05.10 |
| `rename` | doc03.01.05.09 |
| `research` | doc04.08.00 |
| `rest` | doc04.08.09 |
| `retrieval` | doc01.04, doc04.08.05 |
| `rewrite` | doc03.01.05.08 |
| `rpc` | doc04.08.09 |
| `scripts` | doc03.01.01, doc04.06.01, doc04.08.04 |
| `sdlc` | doc04.02 |
| `sections` | doc01.06 |
| `sequencing` | doc04.08.11 |
| `sidecars` | doc03.02.01 |
| `skills` | doc04.08.01 |
| `spec-driven` | doc04.02, doc04.04.02, doc04.07, doc04.08.03, doc04.08.04, doc04.08.07, doc04.08.08 |
| `specifications` | doc04.08.05 |
| `specs` | doc02.01, doc03.01.02, doc03.01.03, doc03.01.04, doc03.01.05.00, doc03.01.05.01, doc03.01.05.02, doc03.01.05.03, doc03.01.05.04, doc03.01.05.05, doc03.01.05.06, doc03.01.05.07, doc03.01.05.08, doc03.01.05.09, doc03.01.05.10, doc04.07, doc04.08.06 |
| `state-machines` | doc04.08.08 |
| `static-analysis` | doc04.08.04 |
| `structure` | doc01.05 |
| `structure-preserving` | doc04.04.03 |
| `syntax` | doc01.06 |
| `terms` | doc04.03 |
| `testability` | doc04.08.02 |
| `testing` | doc02.02.01, doc03.01.03, doc04.08.02 |
| `theory` | doc01.01, doc04.04.02 |
| `tokens` | doc04.08.01 |
| `tools` | doc03.01.01, doc04.06.01 |
| `transition-systems` | doc04.08.07 |
| `transmission` | doc04.02 |
| `trpc` | doc04.08.09 |
| `typing` | doc02.02.01 |
| `unfolding` | doc04.04.03, doc04.08.10, doc04.08.11 |
| `use-case` | doc03.03 |
| `verification` | doc04.08.02, doc04.08.07 |
| `vision` | doc04.02, doc04.04.00 |
| `vocabulary` | doc04.08.06 |
| `workflow` | doc03.03 |
| `workspace` | doc03.01.01, doc03.01.02, doc04.05, doc04.06.01, doc04.08.06 |
