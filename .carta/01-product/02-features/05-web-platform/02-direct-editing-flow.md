---
title: Direct Editing Flow
status: draft
summary: Editor-heavy interaction flavor — user writes, AI transforms into well-formed specs
tags: [web, ai, specs, workflow, editor]
deps: [doc01.02.05.00]
---

# Direct Editing Flow

The user writes their thoughts directly into spec files using an editor pane. The AI assists on request rather than driving the interaction.

## AI Assistance Modes

- **Advice**: "Is this the right level of detail?" or "What am I missing?"
- **Cleanup**: Transform rough prose into structured spec format (frontmatter, typed properties, cross-references)
- **Filing**: Move content into the right `.carta/` location with proper numbering and references

The AI transforms the user's writing into well-formed specs — both in content (prose, frontmatter, references) and location (correct spec group, proper numbering).

## The Transform

The key operation is: user writes rough thoughts → AI produces a spec. This means:

1. **Content transform**: Prose becomes structured frontmatter, typed properties, and properly formatted markdown sections
2. **Location transform**: Content gets filed into the correct spec group with proper numbering, and cross-references to related specs are added
3. **The user's meaning is preserved** — the AI reformats and relocates, it does not reinterpret or editorialize

## Open Questions

1. How does the user invoke a transform? Explicit button, slash command, or does the AI suggest when it notices unstructured content?
2. Should transforms be previewed (diff view) before applying, or applied directly with undo?
3. When the AI files content into a different location, how is this communicated? Toast notification, sidebar highlight, or navigation prompt?
