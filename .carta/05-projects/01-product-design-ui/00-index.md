---
title: Product Design UI
summary: Rework the canvas engine to support structured product modeling tools for nontechnical users
tags: [project, canvas, product-modeling, editors]
deps: [doc01.08.10, doc03.07, doc01.06.02]
---

# Product Design UI

Rework the canvas engine to support visual editors for all structured product modeling types (doc01.08.10). The goal is tools that product owners and domain experts are happy to use — not developer tools with a friendlier skin.

## Scope

The canvas engine (doc03.07) is already domain-agnostic. This project extends it to support the full range of product design structures: entity models, ER diagrams, decision tables, state machines, flowcharts, enumerations, and more. Each structure type gets a visual editor built on shared canvas primitives.

## Success

Nontechnical users can model a business domain — entities, relationships, rules, lifecycles — without writing prose or code. The tools are specific enough to be useful (not a generic diagramming tool) but composable enough that structures reference each other naturally.

## Decisions

- **Naming**: the editor types are called "structures" (not metaphors, instruments, surfaces). Matches doc01.08.10 vocabulary.
- **Doc lifecycle**: sparse docs are intentional. A one-liner is valid until the work demands more (doc00.04). Don't elaborate proactively.
- **Project as staging ground**: insights developed here land in doc01–04 when ready. The project tracks the work, not the canonical product descriptions.
- **Engine changes doc is a seed**: intentionally sparse until gap analysis and structure designs clarify what the engine actually needs.
- **Doc → canvas relationship**: docs are files containing structure instances. A canvas is a materialization (view/dashboard) that pulls in docs and renders their instances. The doc is the source of truth, the canvas is the view.
- **Every instance lives in a doc**: many instances can share one doc. No free-floating structures.
- **Existing canvas is separate**: the schema/port/construct system is the "legacy canvas" in this project's vocabulary. Over-engineered at the product level — closest to an ER tool. Will be reevaluated later through this project's lens.
- **Storage format**: structure instances live in markdown files as fenced `carta` code blocks with YAML content and frontmatter (name, type).
- **No docs system required**: the canvas must work without `.carta/` or any organizational layer. Flat dir with semantic filenames is a valid setup.
- **Canvas = dashboard + editor**: not just a viewer. Users add and modify structures directly on the canvas, which writes back to docs. Canvases are saveable (references + layout).
- **Two interfaces, same data**: humans edit via canvas, AI edits via script API (Python, sibling to existing carta CLI). Both read/write the same `carta` code blocks in docs.
- **Structure-specific interactions**: each structure type brings its own interaction vocabulary. Canvas engine provides shared primitives (viewport, selection, layout); structures compose them. No shared interaction protocol yet — add when patterns emerge.
- **Canvas shows code blocks only**: prose around code blocks is not rendered on the canvas (for now).
- **Fenced code blocks**: triple backticks with `carta` language tag. YAML content won't realistically contain triple backticks. Revisit if it actually breaks.
- **Build order**: enumerations → entity model → decision table → relationships (ER) → state machine → process flow. First three are form/list/grid editors (no canvas engine needed). Last three require node-and-edge canvas. Order balances ease of implementation with value to product designers.
- **Enumerations are flat**: no hierarchy. If a domain needs hierarchical taxonomies, that's a separate structure type. Different groups of values should be different enumerations. Keeps the enumeration editor simple and the semantics clean.
- **File container**: every structure instance on the canvas sits inside a file container — a visual rectangle with a filename tab. The file container represents the source file. Multiple instances can share one file container (matching how a doc can hold multiple code blocks).
- **Structure editors are React components inside canvas nodes**: file containers are canvas node types. The canvas engine handles dragging, positioning, viewport transform. Phase 1 editors (enumerations, entity models, decision tables) are plain React components rendered inside file container nodes. Phase 2 editors (ER, state machine, flowchart) need deeper canvas integration — their internal nodes and edges participate in the canvas coordinate system.
- **UI action surfaces**: users perform UI actions from the union of on-screen buttons and right-click context menus. Some actions appear in both, some in only one. Each structure defines which actions use which surface. On-screen buttons for common/discoverable actions; context menus for contextual actions (e.g., right-click a node, right-click an edge).
- **Edge interaction**: the canvas engine needs edge hit-testing for right-click (and potentially click) on edges. Required for flowcharts (insert node on edge), state machines (edit transition), ER diagrams (edit cardinality). Not currently in the engine.
- **AI editing via Python script API**: sibling to existing `carta` CLI. AI reads the canvas file for context (list of source files), reads source files directly, writes changes via scripts. No MCP needed for writes.
- **Live file watching**: canvas watches source files and re-renders on change. AI and canvas interact through the filesystem, not through each other.
- **Last-write-wins**: concurrent editing uses last-write-wins for now. Primary use case is conversational turn-taking. Revisit if true simultaneous editing becomes a requirement.

## Open questions

- What shared interaction patterns do the structure editors need? (e.g., inline editing, drag-to-reorder, cross-structure references)
- How do non-canvas editors (decision tables, enumerations) share chrome and data model with canvas editors?
- What does "nontechnical UX" concretely mean for each structure type? Guided creation flows? Domain-specific vocabulary? Defaults?

## Contents

| Ref | Item | Summary |
|-----|------|---------|
| doc05.01.01 | Gap Analysis | What exists today vs what's needed |
| doc05.01.02 | Engine Changes | Canvas engine rework required to support the editor types |
| doc05.01.03 | Structures | The product design structures and their editors (section) |
| doc05.01.03.01 | Enumerations | Data model, YAML format, UI design, interaction vocabulary |
| doc05.01.03.02 | Process Flow | Flowchart structure — data model, canvas interactions, engine requirements |
| doc05.01.04 | User Experience | How users interact with structures — nouns, verbs, flows |
