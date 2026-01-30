---
name: carta-codebase
description: Carta project context - architecture, patterns, and design rules
---

# Carta Codebase Context

Before working on any bug or feature in this codebase, you MUST read the project documentation to understand the architecture, patterns, and conventions.

## Required Reading

**Always read these files first:**

1. **CLAUDE.md** - Project overview, architecture, key files, design principles, and common tasks
2. **.cursor/rules/about.mdc** - Detailed project overview, UI layout, data flow, file structure

**Read based on the area you're working in:**

| Working On | Read These Rules |
|------------|------------------|
| React Flow canvas, nodes, edges | `.cursor/rules/react-flow.mdc` |
| Ports, connections, edges | `.cursor/rules/ports-and-connections.mdc` |
| Construct schemas, field types, port schemas | `.cursor/rules/metamodel-design.mdc` |
| Hooks, state management, component patterns | `.claude/skills/frontend-architecture/SKILL.md` |
| Yjs, collaboration, persistence | `.cursor/rules/yjs-collaboration.mdc` |
| UI styling, themes, visual hierarchy | `.cursor/rules/look-and-feel.mdc` |

## Key Architecture Points

### State Management
- **Document state** lives in Yjs Y.Doc via DocumentAdapter interface
- **UI state** (selection, menus, modals) stays in component useState
- Yjs auto-syncs to IndexedDB via y-indexeddb provider
- Undo/redo uses Y.UndoManager (local per-user)

### Port & Connection Model
- Edges have **no metadata** - all data lives on constructs
- Port schemas define port types with polarity (`source`, `sink`, `bidirectional`)
- Polarity-based validation via `portRegistry.canConnect()`
- Connection storage is on the source construct's `connections[]` array

### Key Files
| File | Purpose |
|------|---------|
| `src/contexts/DocumentContext.tsx` | Document provider lifecycle |
| `src/stores/adapters/yjsAdapter.ts` | Yjs implementation |
| `src/hooks/useGraphOperations.ts` | Node CRUD |
| `src/hooks/useConnections.ts` | Connection logic |
| `src/components/Map.tsx` | React Flow canvas |
| `src/constructs/portRegistry.ts` | Port validation |

### Development Philosophy
**Backwards compatibility is NOT a concern.** When fixing bugs:
- Remove old patterns completely
- Update all references to use the new approach
- Don't preserve deprecated code paths
