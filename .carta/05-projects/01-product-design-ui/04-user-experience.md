---
title: User Experience
summary: How users interact with product design structures — nouns, verbs, and flows
tags: [project, user-experience, product-modeling, canvas]
deps: [doc05.01.03, doc01.02]
---

# User Experience

## Core model

- A **doc** is a file. Structure instances live inside docs as fenced code blocks (`carta` language tag) with YAML content and frontmatter (name, type, version). A doc can contain many instances (an enum and a decision table that references it).
- A **canvas** is a dashboard of design structures. It reads instances from docs and renders them as interactive editors. The canvas is a view and an editing surface — the doc is the source of truth. This is completely different from the legacy canvas (schemas, ports, constructs); in this project, "legacy canvas" refers to the existing system.
- An **instance** is a concrete structure (e.g., "Order Lifecycle" is a state machine instance, "Employee" is an entity instance). Every instance belongs to exactly one doc.
- A **file container** is the visual frame on the canvas that represents a source file. It renders as a rectangle with a tab protruding from the top showing the filename (e.g., `employee-types.md` or `doc02.03`). Structure instances sit inside the file container. A file container may hold multiple instances (matching how a doc can contain multiple code blocks). Every structure on the canvas lives inside a file container — it's the visual anchor that connects what you see to where it's stored.

## No docs system required

The canvas must work without a `.carta/` workspace or any docs system. A user could put everything in a flat directory with semantic filenames, and the canvas renders whatever structure instances it finds in those files. The docs system is an organizational layer on top — not a prerequisite.

## Storage format

Structures live inside markdown files as fenced code blocks:

````markdown
```carta
name: Order Lifecycle
type: state-machine
---
states:
  - pending
  - paid
  - shipped
  - delivered
transitions:
  - from: pending
    to: paid
    guard: payment-received
```
````

This is human-readable, git-diffable, AI-consumable, and doesn't require any special tooling to create or edit. The canvas reads these blocks and renders them.

## Canvas as editing surface

The canvas isn't just a viewer — it's where users add and modify information. Interaction should be direct and low-friction:

- In a **flowchart**, click an edge to insert a new node or branching decision
- In a **decision table**, add rows and columns inline
- In a **state machine**, drag to create transitions between states
- In an **entity model**, add fields by typing into the form

Edits on the canvas write back to the doc's code blocks.

## Relationship to legacy canvas

The legacy canvas (schemas, ports, constructs, organizers) is a separate system for now. It's over-engineered at the product level — it tries to be a generic typed-node editor. The structures described here are purpose-built tools. Eventually the legacy canvas may be reevaluated through this lens; it's closest to an ER diagramming tool.

## Dual mandate

The dual mandate (doc01.02) applies: structures must be useful for humans to author visually AND for AI to consume as structured data. The doc format (YAML in markdown) serves the AI. The canvas serves the human. Same data, two interfaces.

## Saved canvases

A canvas is saveable — it remembers which instances it shows and their layout positions. Users go back to saved canvases like dashboards. A canvas file stores references to instances plus layout state, not the instances themselves.

The primary way a user edits a design structure is through a canvas. The primary way an AI edits a design structure is through a script API (Python, sibling to the existing `carta` CLI for docs). Both interfaces read and write the same underlying `carta` code blocks in docs.

## Two editing interfaces

| Interface | User | Interaction |
|-----------|------|-------------|
| Canvas | Human | Visual — click, drag, type inline |
| Script API | AI | Programmatic — add row to decision table, create transition, rename entity field |

The script API is the AI's equivalent of the canvas. It operates on the same YAML structures in the same doc files. No separate data model.

## AI ↔ Canvas data flow

The AI and canvas interact through the filesystem, not through each other:

```
AI reads canvas file list → reads source files directly → writes changes via Python script API
                                                                      ↓
Canvas watches source files → re-parses carta code blocks → re-renders
```

| Operation | Direction | Mechanism |
|-----------|-----------|-----------|
| List files on canvas | Canvas → AI | Canvas file stores its source file references. AI reads the canvas file to know what's in scope. |
| Read structure instances | AI → files | Normal file I/O — parse markdown, extract `carta` code blocks, read YAML |
| Write structure changes | AI → files | Python script API (sibling to `carta` CLI) |
| Propagate changes to canvas | Files → Canvas | File watcher on source files triggers re-parse and re-render |

The AI gets context by reading the canvas file (list of source files + layout) and then reading the source files directly. No special canvas API needed for reads — the AI uses its normal file-reading abilities. The canvas file is the "table of contents" that tells the AI what's in scope.

### Concurrent editing

Last-write-wins for now. The primary use case is conversational turn-taking: user asks AI to make a change, AI does it, canvas updates. True simultaneous editing (user drags a node while AI adds a row) is a future concern — revisit if it becomes a real problem.

## Cross-references between instances

Instances can reference each other — an entity field references an enum, a state machine guard references a decision table. This creates staleness risk. Open questions:

- Are references by name or by ID?
- What happens when a referenced instance is renamed, moved, or deleted?
- How visible are incoming references? (Can I see who depends on my enum before I change it?)
- How do cross-doc references work when there's no docs system? (Relative paths? Global names?)
