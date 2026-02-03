---
title: Product Index
status: active
---

# Product

This title documents what Carta does (features), who uses it (use cases), and how they use it (workflows).

## Feature Catalog (doc03.01)

| ID | Feature | Status | Description |
|----|---------|--------|-------------|
| doc03.01.01 | Canvas | active | Primary editing surface: pan, zoom, node manipulation |
| doc03.01.02 | Constructs | active | Typed nodes: schemas, fields, display, color |
| doc03.01.03 | Ports and Connections | active | Port model, polarity, validation, edge rendering |
| doc03.01.04 | Levels | active | Multi-level architectural views within a document |
| doc03.01.05 | Metamap | active | Schema-level visual editor |
| doc03.01.06 | Schema Editor | active | Wizard for creating and editing construct schemas |
| doc03.01.07 | Compilation | active | Transform canvas state to AI-readable output |
| doc03.01.08 | Import and Export | active | .carta file format, selective import/export with preview |
| doc03.01.09 | Collaboration | active | Server mode, real-time sync, document browser |
| doc03.01.10 | AI Assistant | draft | AI sidebar with chat and document manipulation tools |
| doc03.01.11 | Keyboard and Clipboard | active | Shortcuts, copy/paste, undo/redo |
| doc03.01.12 | Theming | active | Light/dark/warm themes |
| doc03.01.13 | New User Experience | active | First-load starter document, auto-create, no blank canvas |

## Use Cases (doc03.02)

| ID | Persona / Scenario | Description |
|----|---------------------|-------------|
| doc03.02.01 | Software Architect | Designs system architecture visually, compiles for AI |
| doc03.02.02 | Team Lead | Defines construct schemas for team standardization |
| doc03.02.03 | Enterprise Self-Hosted | Internal server, managed AI (Bedrock), desktop + web access |
| doc03.02.04 | Solo User | Static site or desktop app, local storage, own API key |
| doc03.02.05 | SaaS Provider | Multi-tenant hosted service with auth, billing, metered AI |

## Workflows (doc03.03)

| ID | Workflow | Features Used |
|----|----------|---------------|
| doc03.03.01 | Create a Construct | doc03.01.01, doc03.01.02 |
| doc03.03.02 | Connect Constructs | doc03.01.01, doc03.01.03 |
| doc03.03.03 | Define a Schema | doc03.01.05, doc03.01.06 |
| doc03.03.04 | Compile a Project | doc03.01.07 |
| doc03.03.05 | Import a Project | doc03.01.08 |
| doc03.03.06 | Iterative Modeling on the Map | doc03.01.01, doc03.01.02, doc03.01.03, doc03.01.04, doc03.01.11 |
| doc03.03.07 | Schema Design Patterns | doc03.01.03, doc03.01.05, doc03.01.06 |
| doc03.03.08 | Rough to Refined | doc03.01.01, doc03.01.02, doc03.01.05 |
