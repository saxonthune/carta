---
title: Simple Mode
status: draft
---

# Simple Mode

Simple mode is the experience of starting an idea. It applies to anyone at the beginning of a modeling session—not just new users (doc03.01.13), but anyone sketching a new concept, exploring a problem space, or brainstorming. The goal is to make the first minutes of work feel like writing on index cards, not filling out forms.

## Problem

Carta's construct system is powerful but front-loaded. Even with sketching schemas (Note, Box), the user sees field labels, port drawers, summary/detail toggles, deployable assignments—UI that implies a level of rigor the user isn't ready for. When starting an idea:

- **Adding is slow**: Right-click → menu → choose type → fill fields. Each node costs attention.
- **Removing is costly**: Deleting a richly connected node feels wasteful if you spent time on fields.
- **Rewiring is friction-heavy**: Breaking connections means understanding port compatibility and re-establishing links.
- **The render communicates "structured document"** when the user is still in "whiteboard" mode.

This gap between the user's mental model (loose ideas, quick associations) and the tool's visual language (typed nodes with structured fields) creates hesitation. The user should never hesitate to throw a node on the canvas.

## Principle

**Constructs in simple mode should feel disposable.** They should be cheap to create, cheap to destroy, and cheap to reconnect. The UI should communicate "this is a sketch" visually, so the user doesn't feel obligated to fill in details. This aligns with the Rough-to-Refined workflow (doc03.03.08)—simple mode is the tool's expression of the rough sketch phase.

Simple mode is not a global application toggle. It is a per-construct rendering concern driven by the schema. A canvas can have simple constructs alongside richly detailed ones.

## Schema

**Note is the simple mode schema.** It already has the right shape: a single multiline `content` field and a single `symmetric` port. No new schema is needed.

Note gets `renderStyle: 'simple'` to opt into the simple render variation. This is a schema-level property—all Note instances render simply.

### Why Note works

- **Single field**: One multiline text field (`content`) is the only data. No type selection, no field grid, no decisions.
- **Symmetric port**: Bidirectional polarity bypasses `compatibleWith` checks, meaning a Note can connect to any other construct regardless of port types. This gives near-zero rewiring cost.
- **backgroundColorPolicy: 'tints'**: Users can color individual Notes from curated tint swatches for visual grouping without schema changes.

## Requirements

### UX Requirements

1. **Near-zero creation cost**: Context menu "Add Note" on the canvas creates a Note at click position. No type selection dialog. The user can immediately start typing.
2. **Near-zero deletion cost**: Simple constructs look light enough that deleting one doesn't feel like losing work.
3. **Near-zero rewiring cost**: Connections between Notes use the symmetric port. Connections are made via standard port drawer UI on hover.
4. **Visual distinction**: Notes render in a lighter style that communicates "sketch" rather than "specification." They look like index cards or sticky notes, not data entry forms.
5. **Minimal chrome**: Simple render suppresses most UI elements—no header bar, no field grid, no detail toggles, no deployable selectors. Port drawer appears on hover for connections and color picking.

### Technical Requirements

1. **Schema-driven**: Simple rendering is controlled by `renderStyle: 'simple'` on the schema. No global mode, no per-instance flag.
2. **Separate primitive, not variant**: Simple rendering is a fundamentally different interaction model. It's dispatched alongside 'default' and 'card' variants but shares no UI complexity with them. It's a clean-slate implementation that composes only the components it needs.
3. **No special data model carveouts**: A Note is a regular construct with a schema, semanticId, values, and connections. What makes it render simply is its schema's `renderStyle`.
4. **No view modes**: Simple nodes have no summary/details toggle, no double-click behavior. There is only one mode: direct inline editing.
5. **Composable architecture**: Render modes choose which components to include (port drawer, controls, field grids). Simple mode includes only the port drawer, excluding all other chrome. Future render modes should be equally easy to implement by mixing and matching components.

## Render Variation

### Visual Character

- **No header bar**: No schema type label, no controls row (expand/collapse, pin, window icons).
- **Content only**: The multiline `content` field renders as editable text directly on the surface—no field label, no field container chrome.
- **Color identity**: Background tint from instance color (or schema color fallback with 30% mix). Types remain distinguishable by color.
- **Port drawer on hover**: Appears at bottom on hover, includes connection ports and color dropper icon for changing instance color.
- **Minimal footprint**: Smaller than default-rendered constructs. Compact padding, no wasted space.
- **Soft edges**: `rounded-lg`, gentle shadow (`var(--node-shadow)`). Feels like a card sitting on a desk.
- **Text halo**: Content text uses `text-halo` utility for legibility on any background tint.

### LOD interaction

- **Pill band** (zoom < 0.5): No change—pills are already maximally compact. Note pills show `Note: {content preview}`.
- **Normal band** (zoom >= 0.5): Notes render in their simple form—content on a tinted card, no chrome.

### Comparison with other renderStyles

| Aspect | `'default'` | `'card'` | `'simple'` |
|--------|-------------|----------|------------|
| Header bar | Yes (schema type, controls) | No | No |
| Field grid | Yes (by displayTier) | Yes (minimal tier) | No |
| Display name | From pill-tier field | From pill-tier field | N/A—content IS the display |
| Background | `bg-surface` | Schema/instance color tint | Schema/instance color tint (30% mix) |
| Port drawer | On hover | On hover | On hover (includes color dropper) |
| View modes | Summary ↔ Details toggle | Summary ↔ Details toggle | None—single mode only |
| Controls | Expand, pin, window, color | Expand, color | Color via port drawer dropper |
| Double-click | Enter details mode | Enter details mode | No-op |
| Architecture | Full-featured component | Simplified variant of default | Separate primitive, no shared UI complexity |

## Creation Flow

1. Right-click on empty canvas → context menu includes "Add Note"
2. Note appears at click position with empty content, cursor auto-focused in the text area
3. User types content directly—no modal, no field selection
4. User can connect Notes via standard port drawer (opens on hover) or drag from existing connections
5. User can change Note color via color dropper icon in port drawer

## Transition to Structured Modeling

Notes are not retyped into richer schemas through a mechanical "change type" action. Instead, the path from rough sketch to structured model is:

1. **AI-assisted conversion**: The AI assistant (doc03.01.10) can analyze a canvas of Notes and suggest typed schemas, converting notes into structured constructs with appropriate fields and connections. This is the primary path.
2. **Manual replacement**: The user creates a new typed construct, copies relevant information from the Note, and deletes the Note. This is the manual fallback.

The tool should guide users toward AI-assisted conversion as the natural next step after sketching—this is where the "rough to refined" transition happens.

## Relationship to Existing Concepts

### vs. NUX (doc03.01.13)
NUX seeds the first document with Notes. Simple mode is the ongoing experience of sketching. NUX demonstrates simple mode; simple mode persists beyond first load.

### vs. Rough-to-Refined (doc03.03.08)
Rough-to-Refined is the conceptual workflow. Simple mode is its technical realization. The workflow doc describes what the user does; this doc describes what the tool shows.

### vs. Card renderStyle
`renderStyle: 'card'` renders a label-dominant colored card with minimal-tier fields. `'simple'` goes further: no fields at all, content rendered directly as body text, no controls chrome. Card is for schemas that are lightweight but structured (Box); simple is for schemas that are pure freeform text (Note).

### vs. LOD bands
LOD controls information density by zoom level. Simple mode controls information density by schema intent. They're orthogonal—a simple construct at pill zoom is a pill; at normal zoom it's a compact card.

## Architecture: Composable Render Modes

Simple mode demonstrates a key architectural principle: **render modes are separate primitives, not variations of a base component**. This makes it easy to add new render modes in the future.

### Component Structure

```
ConstructNode/
├── index.tsx                    # Dispatcher: LOD + renderStyle routing
├── ConstructNodePill.tsx        # Pill LOD for all types (shared)
├── ConstructNodeDefault.tsx     # Full-featured nodes (includes all chrome)
├── ConstructNodeSimple.tsx      # Minimal nodes (no chrome, separate primitive)
└── shared.ts                    # Shared types and utilities only
```

### Dispatching Logic

```tsx
// index.tsx
if (lod.band === 'pill') {
  return <ConstructNodePill {...variantProps} />;  // Shared pill for all types
}

if (schema.renderStyle === 'simple') {
  return <ConstructNodeSimple {...variantProps} />;  // Separate primitive
}

return <ConstructNodeDefault {...variantProps} />;  // Default includes 'card' as a sub-variant
```

### Adding New Render Modes

To add a new render mode (e.g., `renderStyle: 'kanban'`):

1. Create `ConstructNodeKanban.tsx` as a separate component
2. Choose which components to include:
   - Port drawer? Include `<PortDrawer ports={ports} />` or omit it
   - View modes? Support `data.viewLevel` or ignore it
   - Controls? Include header bar or render minimally
3. Add dispatch case in `index.tsx`:
   ```tsx
   if (schema.renderStyle === 'kanban') {
     return <ConstructNodeKanban {...variantProps} />;
   }
   ```

**Key insight**: Each render mode is independent. They share only:
- Data model (`ConstructNodeData`)
- Connection infrastructure (handles, drop zones)
- Shared utilities (color resolution, display name logic)

They do NOT share UI components or interaction patterns. This prevents complexity from accumulating—each mode implements exactly what it needs.
