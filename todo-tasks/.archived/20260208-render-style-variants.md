# Shape Differentiation via renderStyle Variants

> **Scope**: enhancement
> **Layers touched**: types (renderStyle union), presentation (dispatch table + 3 new variant components)
> **Summary**: Add `'circle'`, `'diamond'`, and `'document'` renderStyle values with corresponding variant components for visual category differentiation.

## Motivation

All construct types render as rectangular cards. Shape differentiation is the highest-bandwidth visual variable — adding circle, diamond, and document shapes lets schema authors opt into visual category encoding (events, gateways, data objects) without domain model changes.

## Design Constraint

**All three new variants show only a centered display name. No inline field editing.** Users open the full-view modal for field editing. This keeps shapes clean and iconic.

## Do NOT

- **Do NOT add field editing to circle/diamond/document variants.** They show display name only. No textarea, no field grid, no inline editing.
- **Do NOT modify ConstructNodeDefault or ConstructNodeSimple.** These are unchanged.
- **Do NOT modify ConstructNodePill.** The pill component is already shared across all renderStyles — it works as-is.
- **Do NOT add new fields to ConstructNodeVariantProps.** The existing interface is sufficient.
- **Do NOT touch the domain model, compiler, or adapter layer.** This is purely types + presentation.
- **Do NOT add custom edge routing or port handle positioning on shape perimeters.** Port drawer renders below the bounding box as a horizontal strip.
- **Do NOT create seed schemas for the new renderStyles.** That's a follow-up task.
- **Do NOT add any React hooks inside variant components.** They must be pure — no useState, no useEffect, no useRef.

## Files to Modify

### 1. `packages/domain/src/types/index.ts`
- Extend the `renderStyle` union from `'default' | 'simple'` to `'default' | 'simple' | 'circle' | 'diamond' | 'document'`
- Location: line ~159, in the `ConstructSchema` interface

### 2. `packages/web-client/src/components/canvas/ConstructNode/index.tsx`
- Add imports for the three new variant components
- Extend the dispatch chain (lines 102-111) with three new branches

### 3. NEW: `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeCircle.tsx`
- Circular node variant component

### 4. NEW: `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDiamond.tsx`
- Diamond (rotated square) node variant component

### 5. NEW: `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDocument.tsx`
- Document (wavy bottom) node variant component

## Implementation Steps

### Step 1: Extend renderStyle type

In `packages/domain/src/types/index.ts`, find:
```typescript
renderStyle?: 'default' | 'simple';
```
Change to:
```typescript
renderStyle?: 'default' | 'simple' | 'circle' | 'diamond' | 'document';
```

### Step 2: Create ConstructNodeCircle.tsx

Create `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeCircle.tsx`.

Structure (follow ConstructNodeSimple pattern for imports and infrastructure):

```tsx
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { getDisplayName, resolveNodeColor } from '@carta/domain';
import IndexBasedDropZones from '../IndexBasedDropZones';
import PortDrawer from '../PortDrawer';
import type { ConstructNodeVariantProps } from './shared';

export function ConstructNodeCircle({
  data, selected, schema, ports,
  isConnectionTarget, isDragActive, sourcePortType, lodTransitionStyle,
}: ConstructNodeVariantProps) {
  const color = resolveNodeColor(schema, data);
  const displayName = getDisplayName(data, schema);

  return (
    <div className="relative flex flex-col items-center" style={lodTransitionStyle}>
      {/* NodeResizer for user resizing — maintain aspect ratio */}
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={80}
        keepAspectRatio={true}
        lineClassName="!border-accent !border-2"
        handleClassName="!w-2 !h-2 !bg-accent !border-accent"
      />

      {/* Circle shape */}
      <div
        className={`node-drag-handle rounded-full flex items-center justify-center cursor-move select-none overflow-hidden ${selected ? 'ring-2 ring-accent/30' : ''}`}
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
          border: `2px solid ${color}`,
          boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        }}
      >
        {/* Selection indicator */}
        {selected && (
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)]" />
        )}

        {/* Connection drop zones */}
        {isConnectionTarget && (
          <IndexBasedDropZones ports={ports} sourcePortType={sourcePortType} />
        )}

        {/* Centered display name */}
        <span className="text-content text-node-base font-medium text-center px-2 truncate max-w-full">
          {displayName}
        </span>
      </div>

      {/* Anchor handles (invisible) */}
      {ports.map((port) => (
        <span key={`anchor-${port.id}`}>
          <Handle id={port.id} type="source" position={Position.Bottom}
            className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
            style={{ bottom: 0, left: '50%', pointerEvents: 'none' }} />
          <Handle id={port.id} type="target" position={Position.Top}
            className={isDragActive
              ? '!absolute !opacity-0 !border-none !p-0'
              : '!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0'}
            style={isDragActive
              ? { top: 0, left: '50%', width: 20, height: 20, minWidth: 20, minHeight: 20, pointerEvents: 'auto' }
              : { top: 0, left: '50%', pointerEvents: 'none' }} />
        </span>
      ))}

      {/* Port drawer below circle */}
      <PortDrawer
        ports={ports}
        colorPickerPolicy={schema.colorMode === 'enum' ? 'defaultOnly' : schema.backgroundColorPolicy}
        baseColor={schema.color}
        instanceColor={data.instanceColor}
        onColorChange={data.onInstanceColorChange}
      />
    </div>
  );
}
```

**Key details:**
- `rounded-full` + `aspectRatio: '1 / 1'` makes a circle
- `NodeResizer` with `keepAspectRatio={true}` and `minWidth/minHeight: 80`
- Default size: set via React Flow node data `style: { width: 120, height: 120 }` — but the variant itself uses `width: '100%'` and `aspectRatio: '1 / 1'` to fill its container
- The outer `div` has `flex flex-col items-center` so port drawer centers below the circle
- Display name centered with truncation

### Step 3: Create ConstructNodeDiamond.tsx

Create `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDiamond.tsx`.

Same import pattern. The diamond is a square container with a rotated inner div:

```tsx
export function ConstructNodeDiamond({ ... }: ConstructNodeVariantProps) {
  const color = resolveNodeColor(schema, data);
  const displayName = getDisplayName(data, schema);

  return (
    <div className="relative flex flex-col items-center" style={lodTransitionStyle}>
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={80}
        keepAspectRatio={true}
        lineClassName="!border-accent !border-2"
        handleClassName="!w-2 !h-2 !bg-accent !border-accent"
      />

      {/* Diamond shape: square container with rotated inner */}
      <div
        className="node-drag-handle cursor-move select-none relative"
        style={{ width: '100%', aspectRatio: '1 / 1' }}
      >
        {/* Rotated square */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${selected ? 'ring-2 ring-accent/30' : ''}`}
          style={{
            transform: 'rotate(45deg)',
            backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
            border: `2px solid ${color}`,
            borderRadius: '4px',
            boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
          }}
        />

        {/* Content overlay (NOT rotated) — centered on top of diamond */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {selected && (
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)] pointer-events-none" />
          )}
          <span className="text-content text-node-base font-medium text-center px-2 truncate max-w-[70%]">
            {displayName}
          </span>
        </div>

        {/* Connection drop zones */}
        {isConnectionTarget && (
          <IndexBasedDropZones ports={ports} sourcePortType={sourcePortType} />
        )}
      </div>

      {/* Anchor handles */}
      {ports.map((port) => (
        <span key={`anchor-${port.id}`}>
          <Handle id={port.id} type="source" position={Position.Bottom}
            className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
            style={{ bottom: 0, left: '50%', pointerEvents: 'none' }} />
          <Handle id={port.id} type="target" position={Position.Top}
            className={isDragActive
              ? '!absolute !opacity-0 !border-none !p-0'
              : '!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0'}
            style={isDragActive
              ? { top: 0, left: '50%', width: 20, height: 20, minWidth: 20, minHeight: 20, pointerEvents: 'auto' }
              : { top: 0, left: '50%', pointerEvents: 'none' }} />
        </span>
      ))}

      {/* Port drawer below diamond */}
      <PortDrawer
        ports={ports}
        colorPickerPolicy={schema.colorMode === 'enum' ? 'defaultOnly' : schema.backgroundColorPolicy}
        baseColor={schema.color}
        instanceColor={data.instanceColor}
        onColorChange={data.onInstanceColorChange}
      />
    </div>
  );
}
```

**Key details:**
- Outer `div` is the bounding box; inner rotated div is the visible diamond
- Text is NOT rotated (separate overlay positioned absolutely on top)
- `max-w-[70%]` on text because diamond corners reduce usable area
- `borderRadius: '4px'` on the rotated square for slightly rounded corners

### Step 4: Create ConstructNodeDocument.tsx

Create `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDocument.tsx`.

The document shape is a rectangle with a wavy/curled bottom edge, achieved via an SVG clip path or a bottom border effect:

```tsx
export function ConstructNodeDocument({ ... }: ConstructNodeVariantProps) {
  const color = resolveNodeColor(schema, data);
  const displayName = getDisplayName(data, schema);

  return (
    <div className="relative flex flex-col items-center" style={lodTransitionStyle}>
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={80}
        lineClassName="!border-accent !border-2"
        handleClassName="!w-2 !h-2 !bg-accent !border-accent"
      />

      {/* Document shape with wavy bottom */}
      <div
        className={`node-drag-handle cursor-move select-none relative overflow-visible ${selected ? 'ring-2 ring-accent/30' : ''}`}
        style={{
          width: '100%',
          minHeight: '80px',
          boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        }}
      >
        {/* Main body */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
            border: `2px solid ${color}`,
            borderBottom: 'none',
            borderRadius: '4px 4px 0 0',
            minHeight: '60px',
            padding: '8px',
          }}
        >
          {selected && (
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)]" />
          )}
          <span className="text-content text-node-base font-medium text-center px-2 truncate max-w-full">
            {displayName}
          </span>
        </div>

        {/* Wavy bottom edge (SVG) */}
        <svg
          className="w-full"
          viewBox="0 0 200 20"
          preserveAspectRatio="none"
          style={{ display: 'block', height: '12px' }}
        >
          <path
            d="M0,0 L0,10 Q50,20 100,10 Q150,0 200,10 L200,0 Z"
            fill={`color-mix(in srgb, ${color} 25%, var(--color-surface))`}
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Connection drop zones */}
        {isConnectionTarget && (
          <IndexBasedDropZones ports={ports} sourcePortType={sourcePortType} />
        )}
      </div>

      {/* Anchor handles */}
      {ports.map((port) => (
        <span key={`anchor-${port.id}`}>
          <Handle id={port.id} type="source" position={Position.Bottom}
            className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
            style={{ bottom: 0, left: '50%', pointerEvents: 'none' }} />
          <Handle id={port.id} type="target" position={Position.Top}
            className={isDragActive
              ? '!absolute !opacity-0 !border-none !p-0'
              : '!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0'}
            style={isDragActive
              ? { top: 0, left: '50%', width: 20, height: 20, minWidth: 20, minHeight: 20, pointerEvents: 'auto' }
              : { top: 0, left: '50%', pointerEvents: 'none' }} />
        </span>
      ))}

      {/* Port drawer below document */}
      <PortDrawer
        ports={ports}
        colorPickerPolicy={schema.colorMode === 'enum' ? 'defaultOnly' : schema.backgroundColorPolicy}
        baseColor={schema.color}
        instanceColor={data.instanceColor}
        onColorChange={data.onInstanceColorChange}
      />
    </div>
  );
}
```

**Key details:**
- Rectangle body with `borderRadius: '4px 4px 0 0'` (rounded top only)
- SVG path at bottom creates the wavy/curled edge effect
- `preserveAspectRatio="none"` stretches the wave to fill width
- `vectorEffect="non-scaling-stroke"` keeps border consistent when scaled
- No `keepAspectRatio` on NodeResizer (documents can be any rectangle)

### Step 5: Update dispatch in ConstructNode/index.tsx

Add imports at top:
```typescript
import { ConstructNodeCircle } from './ConstructNodeCircle';
import { ConstructNodeDiamond } from './ConstructNodeDiamond';
import { ConstructNodeDocument } from './ConstructNodeDocument';
```

Replace the dispatch block (lines 102-111):
```typescript
// Dispatch to variant based on LOD band and render style
const dimmed = (data as Record<string, unknown>).dimmed as boolean | undefined;
let variant: React.ReactNode;
if (lod.band === 'pill') {
  variant = <ConstructNodePill {...variantProps} />;
} else if (schema.renderStyle === 'simple') {
  variant = <ConstructNodeSimple {...variantProps} />;
} else if (schema.renderStyle === 'circle') {
  variant = <ConstructNodeCircle {...variantProps} />;
} else if (schema.renderStyle === 'diamond') {
  variant = <ConstructNodeDiamond {...variantProps} />;
} else if (schema.renderStyle === 'document') {
  variant = <ConstructNodeDocument {...variantProps} />;
} else {
  variant = <ConstructNodeDefault {...variantProps} />;
}
```

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand
- **Barrel exports**: Use `.js` extensions in barrel re-exports (though new variant files are imported directly from within the same package, so this mainly applies if they're added to a barrel)
- **No hooks in variants**: Variant components are pure — they receive all data via props
- **ConstructNodeVariantProps**: All variants must accept the same interface from `./shared.ts`
- **Port infrastructure**: Must include anchor handles (invisible, all ports, top+bottom), IndexBasedDropZones (when `isConnectionTarget`), and PortDrawer (below shape, with same color logic)
- **Selection ring**: All variants show visual selection feedback
- **LOD transition**: All variants apply `lodTransitionStyle` for crossfade

## Verification

1. `pnpm build` passes — TypeScript compilation succeeds with new renderStyle values
2. `pnpm test` passes — all existing integration tests still pass (no regressions)
3. No new test files needed — these are presentational components; verification is visual + build

### Plan-specific checks

```bash
# New files exist
test -f packages/web-client/src/components/canvas/ConstructNode/ConstructNodeCircle.tsx
test -f packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDiamond.tsx
test -f packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDocument.tsx

# renderStyle type extended
grep -q "'circle'" packages/domain/src/types/index.ts
grep -q "'diamond'" packages/domain/src/types/index.ts
grep -q "'document'" packages/domain/src/types/index.ts

# Dispatch updated
grep -q "ConstructNodeCircle" packages/web-client/src/components/canvas/ConstructNode/index.tsx
grep -q "ConstructNodeDiamond" packages/web-client/src/components/canvas/ConstructNode/index.tsx
grep -q "ConstructNodeDocument" packages/web-client/src/components/canvas/ConstructNode/index.tsx

# No hooks in variants (no useState, useEffect, useRef)
! grep -q 'useState\|useEffect\|useRef\|useCallback\|useMemo' packages/web-client/src/components/canvas/ConstructNode/ConstructNodeCircle.tsx
! grep -q 'useState\|useEffect\|useRef\|useCallback\|useMemo' packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDiamond.tsx
! grep -q 'useState\|useEffect\|useRef\|useCallback\|useMemo' packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDocument.tsx

# Existing variants untouched
! git diff --name-only | grep -q 'ConstructNodeDefault\|ConstructNodeSimple\|ConstructNodePill'
```
