# Note color picker: use tint swatches instead of full color wheel

> **Scope**: enhancement
> **Layers touched**: domain (schema seed), docs
> **Summary**: Change Note and Box `backgroundColorPolicy` from `'any'` to `'tints'` for curated swatches instead of a full color wheel.

## Motivation

The Note and Box constructs currently show a full color picker (`backgroundColorPolicy: 'any'`), which is overkill for quick-sketch sticky-note style elements. Curated tint swatches are faster to use, produce more visually consistent results, and fit the low-friction spirit of the sketching group.

## Design constraint

Use `'tints'` (7 preset swatches), NOT `'defaultOnly'` — users still want color variety for notes, just not unlimited choice.

## Do NOT

- Change any base colors, display names, or other schema properties
- Touch any UI components — the color picker already supports `'tints'` natively
- Change the tint generation algorithm or number of swatches
- Modify any files outside the ones listed below

## Files to Modify

1. **`packages/domain/src/schemas/seeds/sketching.ts`** — Change `backgroundColorPolicy` from `'any'` to `'tints'` on both Note (line 18) and Box (line 44)
2. **`packages/domain/src/guides/metamodel.ts`** — Update line 256: change the example text from `backgroundColorPolicy: 'any'` to `backgroundColorPolicy: 'tints'`
3. **`.docs/03-product/01-features/14-simple-mode.md`** — Update line 37: change `backgroundColorPolicy: 'any'` to `backgroundColorPolicy: 'tints'` and adjust the description accordingly

## Implementation Steps

### Step 1: Update schema seeds

In `packages/domain/src/schemas/seeds/sketching.ts`:
- Line 18: change `backgroundColorPolicy: 'any'` → `backgroundColorPolicy: 'tints'`
- Line 44: change `backgroundColorPolicy: 'any'` → `backgroundColorPolicy: 'tints'`

### Step 2: Update metamodel guide

In `packages/domain/src/guides/metamodel.ts`, line 256:
```
// Before:
**Example**: The built-in "Note" schema uses `backgroundColorPolicy: 'any'` to allow fully customizable note colors.
// After:
**Example**: The built-in "Note" schema uses `backgroundColorPolicy: 'tints'` to offer curated color swatches instead of a full picker.
```

### Step 3: Update simple-mode doc

In `.docs/03-product/01-features/14-simple-mode.md`, line 37:
```
// Before:
- **backgroundColorPolicy: 'any'**: Users can color individual Notes for visual grouping without schema changes.
// After:
- **backgroundColorPolicy: 'tints'**: Users can color individual Notes from curated tint swatches for visual grouping without schema changes.
```

## Constraints

- `erasableSyntaxOnly` — no constructor shorthand (not relevant here but listed for completeness)
- Barrel exports use `.js` extensions

## Verification

1. `pnpm build` — must pass (TypeScript compilation)
2. `pnpm test` — must pass (integration tests)
3. Grep check: `! grep -q "backgroundColorPolicy: 'any'" packages/domain/src/schemas/seeds/sketching.ts` — confirms no `'any'` policies remain in sketching seeds
