# Enum-Driven Icon Markers on Nodes

> **Scope**: enhancement
> **Layers touched**: domain types, domain utils, all 6 node variant components, schema editor (BasicsStep + FieldsStep), MCP tools, HTTP handler

## Motivation

Subtypes within a construct type (e.g., BPMN Gateway variants) are only distinguishable by reading enum field text. This adds a second enum-driven visual channel — Unicode character markers rendered as badges on nodes — so subtypes are instantly recognizable. Mirrors the proven `enumColorField`/`enumColorMap` pattern.

## Design Constraint

**No `iconMode` toggle.** Unlike `colorMode` which has three modes (default/instance/enum), icon markers are simply present when `enumIconField` is set and absent otherwise. Check `schema.enumIconField` truthiness — no extra mode property.

## Do NOT

- **Do NOT add an `iconMode` property** to ConstructSchema. Just use `enumIconField` presence as the signal.
- **Do NOT add icon library integration** (Lucide, Heroicons, etc.) — text/Unicode only.
- **Do NOT add per-instance icon overrides** — this is schema-level only.
- **Do NOT modify `resolveNodeColor()`** — add a separate `resolveNodeIcon()` function.
- **Do NOT create a separate "Icon Marker" section in BasicsStep** — integrate the icon mapping UI into the existing enum color section (show both color and icon mapping when colorMode is 'enum', and show icon mapping standalone when colorMode is NOT 'enum' but an enum field exists).
- **Do NOT change the `ConstructNodeVariantProps` interface** — the icon is derived from `schema` + `data` which are already passed.
- **Do NOT break existing schemas** — `enumIconField` is optional, absence = no icon.

## Files to Modify

### 1. `packages/domain/src/types/index.ts`

Add two optional properties to `ConstructSchema` (after line 162, near `enumColorMap`):

```typescript
enumIconField?: string;                                        // Field name (type 'enum') that drives icon marker
enumIconMap?: Record<string, string>;                          // Enum value → Unicode character/text for icon marker
```

### 2. `packages/domain/src/utils/color.ts`

Add `resolveNodeIcon()` function after `resolveNodeColor()` (after line 91):

```typescript
/**
 * Resolves the icon marker character for a construct node based on schema enum icon mapping.
 * Returns undefined if no icon is configured or the current value has no mapping.
 */
export function resolveNodeIcon(
  schema: { enumIconField?: string; enumIconMap?: Record<string, string> },
  data: { values?: Record<string, unknown> },
): string | undefined {
  if (!schema.enumIconField || !schema.enumIconMap) return undefined;
  const fieldValue = String(data.values?.[schema.enumIconField] ?? '');
  if (fieldValue && schema.enumIconMap[fieldValue]) {
    return schema.enumIconMap[fieldValue];
  }
  return undefined;
}
```

### 3. `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDefault.tsx`

Add icon badge in the header bar. Import `resolveNodeIcon` from `@carta/domain` (line 3, add to existing import).

After the header `<span>` (line 55), before the button group div (line 56), add the icon badge:

```tsx
{(() => {
  const icon = resolveNodeIcon(schema, data);
  return icon ? (
    <span className="text-node-base font-bold text-content leading-none" title="Type marker">
      {icon}
    </span>
  ) : null;
})()}
```

This places the icon between the schema displayName and the control buttons in the header row.

### 4. `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeCircle.tsx`

Add icon badge centered inside the circle, below the display name. Import `resolveNodeIcon`.

After the display name `<span>` (line 58-60), add:

```tsx
{(() => {
  const icon = resolveNodeIcon(schema, data);
  return icon ? (
    <span className="text-content text-[1.5em] font-bold leading-none" title="Type marker">
      {icon}
    </span>
  ) : null;
})()}
```

The circle's flex container already centers children, so this stacks below the name.

### 5. `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDiamond.tsx`

Add icon badge centered inside the diamond, below the display name. Import `resolveNodeIcon`.

Inside the content overlay div (line 53-60), after the display name `<span>` (line 57-59), add the same pattern as circle but inside the `flex items-center justify-center` container. Wrap name + icon in a `flex flex-col items-center` container:

```tsx
{/* Content overlay (NOT rotated) — centered on top of diamond */}
<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
  {selected && (
    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)] pointer-events-none" />
  )}
  <span className="text-content text-node-base font-medium text-center px-2 truncate max-w-[70%]">
    {displayName}
  </span>
  {(() => {
    const icon = resolveNodeIcon(schema, data);
    return icon ? (
      <span className="text-content text-[1.2em] font-bold leading-none" title="Type marker">
        {icon}
      </span>
    ) : null;
  })()}
</div>
```

Note: the existing content overlay div already has `flex items-center justify-center`. Change to `flex flex-col items-center justify-center` to stack vertically.

### 6. `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeSimple.tsx`

Add icon badge in the top-right corner as an absolute-positioned overlay. Import `resolveNodeIcon`.

After the selection indicator div (line 59-61), add:

```tsx
{(() => {
  const icon = resolveNodeIcon(schema, data);
  return icon ? (
    <span className="absolute top-1 right-2 text-node-base font-bold text-content/60 leading-none" title="Type marker">
      {icon}
    </span>
  ) : null;
})()}
```

### 7. `packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDocument.tsx`

Add icon badge centered below the display name, same pattern as circle. Import `resolveNodeIcon`.

After the display name `<span>` (line 58-60), add:

```tsx
{(() => {
  const icon = resolveNodeIcon(schema, data);
  return icon ? (
    <span className="text-content text-[1.2em] font-bold leading-none" title="Type marker">
      {icon}
    </span>
  ) : null;
})()}
```

### 8. `packages/web-client/src/components/canvas/ConstructNode/ConstructNodePill.tsx`

Add icon character after the color dot, before the text. Import `resolveNodeIcon`.

After the color dot `<span>` (line 33-36), before the text span (line 37), add:

```tsx
{(() => {
  const icon = resolveNodeIcon(schema, data);
  return icon ? (
    <span className="text-[1.1em] font-bold leading-none flex-shrink-0" title="Type marker">
      {icon}
    </span>
  ) : null;
})()}
```

This appears as: `[color dot] [icon] [Type: Name]` in pill mode.

### 9. `packages/web-client/src/components/schema-wizard/BasicsStep.tsx`

Integrate icon marker configuration into the existing enum color section. The UI shows:

**When `colorMode === 'enum'`**: Existing enum field selector + color map, PLUS an "Icon Marker" toggle + icon map (sharing the same or different enum field).

**When `colorMode !== 'enum'`**: A standalone "Icon Marker" section that lets you pick any enum field and map values to characters.

Implementation:

a) Add state derivations at the top of the component (after line 33):

```typescript
const selectedIconEnumField = enumFields.find(f => f.name === formData.enumIconField);
```

b) Add handlers (after the existing `handleEnumColorChange` handler, after line 58):

```typescript
const handleIconFieldSelect = (fieldName: string) => {
  updateField('enumIconField', fieldName);
  if (!fieldName) {
    updateField('enumIconMap', undefined);
    return;
  }
  const field = enumFields.find(f => f.name === fieldName);
  if (field?.options) {
    const map: Record<string, string> = {};
    // Don't pre-populate icons — user should choose them
    field.options.forEach(opt => { map[opt.value] = ''; });
    updateField('enumIconMap', map);
  }
};

const handleIconChange = (optionValue: string, icon: string) => {
  const current = formData.enumIconMap || {};
  updateField('enumIconMap', { ...current, [optionValue]: icon });
};
```

c) Add icon marker UI. Two placement cases:

**Case 1: Inside the `colorMode === 'enum'` block** (after the colors-per-value section, after line 216): Add icon mapping for the same enum field, or a separate field selector if they want a different field:

```tsx
{/* Icon Marker (shown when colorMode is enum) */}
<div className="mt-2 pt-2 border-t border-content-muted/10">
  <label className="block mb-1 text-[11px] text-content-muted">Icon Marker</label>
  <div className="flex items-center gap-2 mb-1">
    <Select
      value={formData.enumIconField || ''}
      onChange={(e) => handleIconFieldSelect(e.target.value)}
    >
      <option value="">None</option>
      {enumFields.map(f => (
        <option key={f.name} value={f.name}>{f.label || f.name}</option>
      ))}
    </Select>
  </div>
  {selectedIconEnumField?.options && formData.enumIconMap && (
    <div className="flex flex-col gap-1">
      {selectedIconEnumField.options.map(opt => (
        <div key={opt.value} className="flex items-center gap-2">
          <input
            type="text"
            className="w-8 h-6 p-0 text-center bg-surface border border-content-muted/20 rounded text-sm"
            maxLength={2}
            value={formData.enumIconMap![opt.value] || ''}
            onChange={(e) => handleIconChange(opt.value, e.target.value)}
            placeholder="·"
          />
          <span className="text-xs text-content">{opt.value}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

**Case 2: After the Appearance section entirely** (after line 218, outside the `colorMode === 'enum'` conditional). Show a standalone icon marker section when colorMode is NOT enum but enum fields exist:

```tsx
{colorMode !== 'enum' && enumFields.length > 0 && (
  <div className="mt-2">
    <label className="block mb-1 text-[11px] text-content-muted">Icon Marker</label>
    <Select
      value={formData.enumIconField || ''}
      onChange={(e) => handleIconFieldSelect(e.target.value)}
    >
      <option value="">None</option>
      {enumFields.map(f => (
        <option key={f.name} value={f.name}>{f.label || f.name}</option>
      ))}
    </Select>
    {selectedIconEnumField?.options && formData.enumIconMap && (
      <div className="flex flex-col gap-1 mt-1">
        {selectedIconEnumField.options.map(opt => (
          <div key={opt.value} className="flex items-center gap-2">
            <input
              type="text"
              className="w-8 h-6 p-0 text-center bg-surface border border-content-muted/20 rounded text-sm"
              maxLength={2}
              value={formData.enumIconMap![opt.value] || ''}
              onChange={(e) => handleIconChange(opt.value, e.target.value)}
              placeholder="·"
            />
            <span className="text-xs text-content">{opt.value}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

### 10. `packages/web-client/src/components/construct-editor/FieldsStep.tsx`

Add cleanup logic parallel to the `enumColorField` cleanup.

a) In `updateFieldAt` (around line 173-185), after the `isEnumColorField` block, add:

```typescript
const isEnumIconField = prev.enumIconField === oldField.name;
if (isEnumIconField) {
  const typeChanged = updates.type !== undefined && updates.type !== 'enum';
  const nameChanged = updates.name !== undefined && updates.name !== oldField.name;
  if (typeChanged) {
    updated.enumIconField = undefined;
    updated.enumIconMap = undefined;
  } else if (nameChanged) {
    updated.enumIconField = updates.name;
  }
}
```

b) In `removeField` (around line 202-212), after the `enumColorField` cleanup, add:

```typescript
if (prev.enumIconField === field.name) {
  updated.enumIconField = undefined;
  updated.enumIconMap = undefined;
}
```

### 11. `packages/server/src/mcp/tools.ts`

Add `enumIconField` and `enumIconMap` to `CreateSchemaInputSchema` (after line 302, near `backgroundColorPolicy`):

```typescript
enumIconField: z.string().optional().describe('Field name (type enum) that drives icon marker on nodes'),
enumIconMap: z.record(z.string()).optional().describe('Enum value → Unicode character mapping for icon markers'),
```

Also pass them through in the handler (lines 768-776), add to the request body:

```typescript
enumIconField: input.enumIconField,
enumIconMap: input.enumIconMap,
```

### 12. `packages/server/src/document-server-core.ts`

The HTTP handler at line 981 uses `as any` when calling `createSchema()`, so extra properties on the body object pass through. However, for correctness, add the fields to the body type (around line 945) and to the object passed to `createSchema()` (around line 982-989):

In the body type, add:
```typescript
enumIconField?: string;
enumIconMap?: Record<string, string>;
```

In the `createSchema()` call, add:
```typescript
enumIconField: body.enumIconField,
enumIconMap: body.enumIconMap,
```

## Implementation Steps

1. **Add type properties** (file 1) — add `enumIconField` and `enumIconMap` to `ConstructSchema`
2. **Add resolver function** (file 2) — add `resolveNodeIcon()` to `color.ts`
3. **Update all 6 node variants** (files 3-8) — import `resolveNodeIcon`, add icon badge rendering
4. **Update schema editor** (files 9-10) — add icon mapping UI and cleanup logic
5. **Update MCP + HTTP** (files 11-12) — add fields to schema creation API

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand
- **Barrel exports**: `resolveNodeIcon` is exported from `color.ts` which is already re-exported via `utils/index.ts` → `domain/index.ts`. No new barrel exports needed.
- **No new dependencies**: text/Unicode only, no icon library

## Verification

1. `pnpm build` — must pass (TypeScript compilation validates type additions)
2. `pnpm test` — must pass (existing tests, no new tests required for this plan)
3. Manual: Create a schema with an enum field, set enumIconField + enumIconMap, verify icons render on nodes

## Plan-Specific Checks

```bash
# Verify resolveNodeIcon is exported and available
grep -q 'resolveNodeIcon' packages/domain/src/utils/color.ts

# Verify no iconMode property was added
! grep -q 'iconMode' packages/domain/src/types/index.ts

# Verify all 6 node variants import resolveNodeIcon
grep -l 'resolveNodeIcon' packages/web-client/src/components/canvas/ConstructNode/ConstructNode*.tsx | wc -l
# Expected: 6

# Verify enumIconField added to ConstructSchema
grep -q 'enumIconField' packages/domain/src/types/index.ts

# Verify MCP schema includes enumIconField
grep -q 'enumIconField' packages/server/src/mcp/tools.ts

# Verify FieldsStep has cleanup logic for enumIconField
grep -q 'enumIconField' packages/web-client/src/components/construct-editor/FieldsStep.tsx
```
