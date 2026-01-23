# Carta - Claude Code Context

## Quick Start

Carta is a visual software architecture editor using React Flow. Users create "Constructs" (typed nodes), connect them, and compile to AI-readable output.

## Cursor Rules

Detailed guidance lives in `.cursor/`:

| Rule | When to consult |
|------|-----------------|
| `.cursor/about.mdc` | Project overview, architecture, file structure |
| `.cursor/rules/react-flow.mdc` | React Flow patterns, handles, node types |
| `.cursor/rules/ports-and-connections.mdc` | Port model, connection semantics, relationship design |
| `.cursor/rules/metamodel-design.mdc` | Three-level metamodel (M2/M1/M0) |

## Key Design Principles

### Three-Layer Architecture
1. **Visual Editor** (`components/`) - React Flow canvas, UI interactions
2. **Construct Registry** (`constructs/`) - Schema definitions, types
3. **Compiler** (`constructs/compiler/`) - Output generation

Layers are decoupled. Changes to one shouldn't require changes to others.

### Port & Connection Model
**Consult:** `.cursor/rules/ports-and-connections.mdc`

- Edges have **no metadata**—all data lives on constructs
- **Port types** (`flow-in`, `flow-out`, `parent`, `child`, `symmetric`) determine connection meaning
- Compatibility-based validation via `portRegistry.canConnect()`
- Inverse relationships are **derivable**, never duplicated
- Port configuration is **per-schema**, not per-instance

### Construct Identity
- **No `name` field** on instances—titles come from schema's `displayField` or `semanticId`
- `semanticId` is required, auto-generated as `{type}-{timestamp}{random}`
- Use `getDisplayName(data, schema)` from `src/utils/displayUtils.ts`

### When Adding New Construct Types
1. Define schema in `src/constructs/schemas/`
2. Include `ports: PortConfig[]` with `portType` (not `direction`)
3. Set `displayField` to the field that should show as node title
4. Set appropriate `compilation` config
5. Register in `src/constructs/schemas/index.ts`

### When Modifying Connection Behavior
1. Read ports-and-connections.mdc first
2. Connection data stored in `ConstructNodeData.connections[]`
3. Edges sync bidirectionally with connection data
4. Use `portRegistry.canConnect()` for validation
5. Compiler reads connections to generate relationship metadata

## Common Tasks

### Add a built-in construct type
```
src/constructs/schemas/{name}.ts  → Define ConstructSchema
src/constructs/schemas/index.ts   → Register with registry
```

### Modify compilation output
```
src/constructs/compiler/index.ts           → Main compiler logic
src/constructs/compiler/formatters/*.ts    → Format-specific output
```

### Change node appearance
```
src/components/ConstructNode.tsx   → Node rendering
src/utils/displayUtils.ts          → Node title derivation
src/index.css                      → Styling (handles, colors)
```

### Update port/connection behavior
```
src/constructs/types.ts            → PortConfig, PortDefinition types
src/constructs/portRegistry.ts     → Port definitions, canConnect()
src/constructs/ports.ts            → Built-in port configurations
src/components/ConstructNode.tsx   → Handle rendering
src/components/Map.tsx             → onConnect handler
```

## Testing Checklist

When modifying constructs or connections:
- [ ] Can create construct with custom ports in Schema Editor
- [ ] Handles appear at correct positions on canvas
- [ ] Connections store on source construct's `connections[]`
- [ ] Compilation output includes ports and relationships
- [ ] Import/export preserves port configurations
- [ ] Node titles display from displayField or semanticId
