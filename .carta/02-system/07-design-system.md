---
title: Design System
status: active
---

# Design System

Visual and interaction standards for the Carta application UI. Part 1 covers **application chrome** (headers, modals, panels). Part 2 covers **canvas content** (nodes, edges, organizers, LOD). Visual design principles that underpin both are in doc01.04.

## Depth System

Carta uses a three-level depth system to create visual hierarchy in multi-panel layouts.

### Levels

| Level | CSS Variable | Tailwind | Usage |
|-------|-------------|----------|-------|
| 1 (Outermost) | `--color-surface-depth-1` | `bg-surface-depth-1` | Tab bars, outermost navigation |
| 2 (Middle) | `--color-surface-depth-2` | `bg-surface-depth-2` | Island containers within sidebars |
| 3 (Innermost) | `--color-surface-depth-3` | `bg-surface-depth-3` | Main content areas, editor panels |
| Inset (Display wells) | `--color-surface-inset` | `bg-surface-inset` | Recessed display areas, showcasing content |
| Selected | `--color-surface-selected` | `bg-[var(--color-surface-selected)]` | Active item highlight in navigation |

### Theme Behavior

- **Dark themes** (dark, warm): Level 1 lightest, Level 3 darkest. Creates a "looking into a hole" effect — depth increases inward.
- **Light theme**: Level 3 is brightest (white). Creates a "hill" effect — content area is elevated.

### Island Pattern

Grouped content within panels uses Level 2 islands with `rounded-xl`. This creates clear visual boundaries without borders.

**Figure-Ground Pairing**: Each depth level needs a companion tone to create internal hierarchy. The `surface-inset` token provides a recessed tone that's always darker/deeper than the surface it sits on, creating "display wells" that draw the eye to their contents.

**Nested island example** (ConstructEditor modal):
```
┌─ Modal (depth-1) ────────────────────────────┐
│  Header Bar (depth-2)                        │
├──────────────────────────────────────────────┤
│ ┌─ Ground (depth-3) ────────────────────────┐│
│ │ ┌─ Left Island (depth-2) ───────────────┐ ││
│ │ │  [Slider Control (inset bg)]          │ ││
│ │ │  ┌─ Form Content (inset well) ───────┐ │ ││
│ │ │  │  Input fields, selects...          │ │ ││
│ │ │  └────────────────────────────────────┘ │ ││
│ │ └───────────────────────────────────────┘ ││
│ │ ┌─ Right Island (depth-2) ──────────────┐ ││
│ │ │  "Live Preview" label                 │ ││
│ │ │  ┌─ Preview Content (inset well) ────┐ │ ││
│ │ │  │  Preview cards...                  │ │ ││
│ │ │  └────────────────────────────────────┘ │ ││
│ │ └───────────────────────────────────────┘ ││
│ └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

**Depth nesting vocabulary:**
- `depth-1`: Outermost frame (modal shell, navigation)
- `depth-2`: Islands (grouped content within panels)
- `depth-3`: Content area ground (the "floor" between islands)
- `inset`: Display wells (recessed stages for showcasing content)

**Code example** (from ConstructEditor.tsx:161-210):
```tsx
{/* Ground layer */}
<div className="bg-surface-depth-3 p-4 gap-4 flex">
  {/* Left island */}
  <div className="bg-surface-depth-2 rounded-xl p-4 gap-3 flex flex-col">
    {/* Slider control on inset background */}
    <SegmentedControl className="bg-surface-inset" />

    {/* Form content in inset well */}
    <div className="bg-surface-inset rounded-xl p-6">
      <BasicsStep />
    </div>
  </div>

  {/* Right island */}
  <div className="bg-surface-depth-2 rounded-xl p-4 gap-3 flex flex-col">
    <span className="text-content-muted">Live Preview</span>

    {/* Preview content in inset well */}
    <div className="bg-surface-inset rounded-xl p-5">
      <EditorPreview />
    </div>
  </div>
</div>
```

## Spacing

4px-based scale. No arbitrary values.

| Token | Value | Usage |
|-------|-------|-------|
| `1` | 4px | Icon-to-text gaps, tight internal spacing |
| `2` | 8px | Related items, list item gaps |
| `3` | 12px | List item padding, small section gaps |
| `4` | 16px | Section/panel padding (compact) |
| `6` | 24px | Panel padding (normal), major section gaps |
| `8` | 32px | Large section separation |

Prefer `gap-*` over margin for flex/grid layouts. Avoid mixed spacing values in the same context.

## Button Hierarchy

Each view should have at most 1-2 primary actions. Other buttons recede visually.

| Level | Style | Usage |
|-------|-------|-------|
| Primary | Filled background, brand color | Main CTA (Compile, Save, Create) |
| Secondary | Muted/outline, less visual weight | Export, Import, Cancel |
| Tertiary | Icon-only or very subtle | Settings, Theme toggle, overflow |
| Destructive | Red/danger, often secondary until confirmed | Delete actions |

## Touch Targets

| Element | Minimum Size |
|---------|-------------|
| Icon buttons | 36x36px (`w-9 h-9`) |
| Text buttons | 36px height |
| List items | 40px height |
| Port handles | 21px with hover expansion |

## Semantic Colors

| Color | Meaning | Usage |
|-------|---------|-------|
| `accent` (indigo) | Interactive, selected | Links, selection, focus rings |
| `danger` (red) | Destructive | Delete, errors, validation |
| `content-muted` | De-emphasized | Secondary text, disabled |

## Typography

| Token | Size | Usage |
|-------|------|-------|
| `text-2xs` | 11px | Badges, tiny labels |
| `text-xs` | 12px | Secondary labels, metadata |
| `text-sm` | 14px | Body text, form labels |
| `text-base` | 15px | Primary content |
| `text-lg` | 18px | Section headers |
| `text-xl` | 20px | Page titles |

Weights: `font-normal` (400) for body, `font-medium` (500) for labels/buttons, `font-semibold` (600) for headings.

## Text Legibility

The `text-halo` utility provides readable text on any background color via theme-aware layered soft blur shadows. The `--text-halo-color` CSS variable adapts per theme (dark shadows for dark themes, light shadows for light themes):

```css
@utility text-halo {
  text-shadow:
    0 2px 12px var(--text-halo-color),
    0 4px 24px color-mix(in srgb, var(--text-halo-color) 75%, transparent),
    0 8px 48px color-mix(in srgb, var(--text-halo-color) 50%, transparent);
}
```

Used on node headers and any text overlaid on user-customizable background colors.

## Shared Icon Components

Carta uses shared icon components from `packages/web-client/src/components/ui/icons.tsx` for consistency:

| Icon | Purpose | Props |
|------|---------|-------|
| `PinIcon` | Pin/unpin action (e.g., keep window open, pin node details) | `filled`: boolean for filled state |
| `WindowIcon` | Open full view window (expand corners icon) | - |
| `CloseIcon` | Close modals/windows | - |
| `ExpandIcon` | Expand collapsed sections | - |
| `CollapseIcon` | Collapse expanded sections | - |

All icons accept `className` and `size` props. Use these instead of inline SVG for consistency.

**Example**:
```tsx
import { PinIcon, WindowIcon } from './ui/icons';

<button onClick={handlePin}>
  <PinIcon filled={isPinned} className={isPinned ? 'text-accent' : ''} />
</button>
```

## Modal Backdrop Variants

The `Modal` primitive (`ui/Modal.tsx`) supports a `blurBackdrop` prop that adds `backdrop-blur-sm` to the overlay. Use this for modals that benefit from a frosted-glass effect (e.g., HelpModal). Default modals use a semi-transparent dark overlay without blur.

## Design Principles (Chrome)

- **Clarity over decoration**: Use depth and spacing for hierarchy, not heavy borders
- **Backgrounds do the work**: Visual separation comes from surface depth, not lines
- **Consistency**: Same depth system, island pattern, and selection highlights everywhere
- **Accessibility**: Sufficient contrast between depth levels, visible focus states, minimum 4.5:1 body text contrast

---

# Part 2: Canvas Content

Visual specifications for user-created content on the canvas — nodes, edges, organizer backgrounds, and LOD rendering. Governed by the visual design principles in doc01.04.

## Schema Color Palette

Users select schema colors from a **curated palette of 8-12 desaturated hues** designed to look harmonious together across all themes. An "advanced" escape hatch allows arbitrary color selection for users who need it.

### Palette Design Rules

1. **Desaturated by default**: Palette colors are pastels / muted tones — high enough lightness and low enough saturation to fill large rectangular node bodies without visual vibration.
2. **Hue-differentiated**: Each palette color occupies a distinct region of the hue wheel so types are distinguishable at a glance.
3. **Theme-tuned**: The palette is defined per-theme. Dark theme uses moderately saturated fills with light text. Light theme uses lighter pastels with dark text. Warm theme uses warm-shifted muted tones.
4. **Header intensification**: The node header bar uses a slightly more saturated version of the same hue as the body fill, creating internal hierarchy within the card.

### Palette (Target — 10 hues)

| Name | Purpose (suggestion) | Dark Theme Fill | Light Theme Fill |
|------|---------------------|-----------------|------------------|
| Slate | Infrastructure, generic | `hsl(215, 20%, 35%)` | `hsl(215, 25%, 90%)` |
| Blue | Services, controllers | `hsl(215, 45%, 40%)` | `hsl(215, 60%, 88%)` |
| Cyan | Data stores, databases | `hsl(185, 40%, 35%)` | `hsl(185, 50%, 87%)` |
| Teal | Models, schemas | `hsl(165, 35%, 33%)` | `hsl(165, 45%, 87%)` |
| Green | Events, actions | `hsl(145, 35%, 33%)` | `hsl(145, 45%, 88%)` |
| Yellow | Warnings, constraints | `hsl(45, 50%, 40%)` | `hsl(45, 60%, 88%)` |
| Orange | UI elements, screens | `hsl(25, 50%, 38%)` | `hsl(25, 55%, 88%)` |
| Rose | User stories, requirements | `hsl(345, 40%, 38%)` | `hsl(345, 50%, 89%)` |
| Purple | Attributes, fields | `hsl(270, 35%, 40%)` | `hsl(270, 45%, 90%)` |
| Indigo | Relationships, connectors | `hsl(240, 35%, 42%)` | `hsl(240, 45%, 90%)` |

These values are starting points to be tuned visually. The key constraint is: **desaturated fills that work as large rectangular backgrounds.**

### Custom Colors

When a user selects "Custom color", show a color picker but encourage staying within the palette by making palette colors prominent and the custom option secondary (progressive disclosure).

## Node Card Design

Node cards are the primary visual elements on the canvas. Their design follows the figure/ground principle from doc01.04.

### Visual Structure

```
┌─────────────────────────────────┐
│  Schema Type        [controls]  │  ← Header: bg-surface-alt + left accent bar
├─────────────────────────────────┤
│                                 │
│  Display Name                   │  ← Body: desaturated fill
│  field: value                   │
│  field: value                   │
│                                 │
└─────────────────────────────────┘
```

### Card Rules

1. **Shadow, not outline**: Nodes float above the canvas via `box-shadow`. No white/colored border outlines. Selected state uses a subtle accent glow or ring, not a thick border.
2. **Header is secondary**: The schema type label is `text-xs uppercase tracking-wide text-content-muted`. The display name below it is the visually dominant element (`text-base font-semibold`).
3. **Left accent bar**: A 2px left border in the schema color (color-mixed at 70% with surface-alt for softness) identifies the node type at the card level. The accent bar is applied to the outer container so it respects rounded corners. The header uses `bg-surface-alt` — not a full-color fill. The body uses `bg-surface`.
4. **Internal padding**: Consistent `p-3` body padding with `gap-2` between fields. No cramped layouts.
5. **Rounded corners**: `rounded-lg` (8px) for the card. No sharp corners.

### Selected State

- Accent-colored `ring-2` or `box-shadow` glow — not a thick border that changes the card's geometry.

## Organizer Backgrounds

Organizer backgrounds are **ground**, not **figure**. They must be the quietest visual layer on the canvas.

### Rules

1. **Theme-adaptive fill**: 6% opacity of the organizer color across all themes, 12% stroke opacity. Labels use 16px font, 600 weight, 85% opacity at normal zoom. Visibility adapts per-theme via CSS custom properties.
2. **Interactive labels**: Organizer labels support click-to-select-all and drag-to-move-group interactions at normal zoom levels.
3. **No dashed borders**: Remove dashed stroke outlines. If a border is needed at all, use a 1px solid line at 10-15% opacity.
4. **Label placement**: Bottom-right corner, small text, muted color. Labels should fade in progressively with zoom — invisible at marker level, subtle at compact, readable at normal.
5. **No visual competition**: The organizer background should never draw the eye away from the nodes it contains.

## Metamap Visual Design

Schema nodes and schema group nodes use the same depth-based design as construct nodes but with metamodel-specific conventions.

### Schema Node Styling

- **Shadow depth**: Uses `var(--node-shadow)` (selected: `var(--node-shadow-selected)`) instead of dashed borders
- **Selection**: `ring-2 ring-accent/30` instead of colored border outlines
- **Accent bar**: 2px softened left border (color-mixed at 70%) on header, matching construct nodes
- **Header**: `bg-surface-alt rounded-t-lg` with `text-node-lg` display name and `text-node-xs` type label
- **Typography**: `text-node-xs` for field/port labels, consistent node font sizing
- **Ports**: Rounded square handles (`border-radius: 4px`) with white borders, matching canvas port style (not rotated diamonds)

### Schema Group Node Styling

- **Border**: Subtle solid border via `color-mix(in srgb, ${color} 25%, var(--color-canvas))` (hovered: 40%)
- **Shadow**: Gentle `0 1px 3px rgba(0,0,0,0.04)` (hovered: `0 0 0 4px ${color}15`)
- **Fully opaque backgrounds**: Group backgrounds use `color-mix(in srgb, ${color} N%, var(--color-canvas))` — mixing the group color into the canvas color rather than using transparency. This prevents the Metamap background pattern from bleeding through nested groups. Depth increases the mix percentage (10% base + 4% per nesting level).
- **Header**: `text-node-xs` label with color dot indicator

## Edge Rendering

Edges are secondary visual elements — they show relationships but should not dominate the canvas.

### Rules

1. **Muted colors**: Edge colors should be muted versions of their port type color, not fully saturated. On dark themes, use desaturated cool tones. On light themes, use medium grays with subtle hue tinting.
2. **Progressive simplification**: As zoom decreases, edge stroke width and opacity should decrease proportionally. At marker level, edges should be thin and semi-transparent.
3. **Bundled edges**: When multiple edges connect the same node pair, bundle them visually with a count badge rather than rendering parallel lines.
4. **Smoothstep routing**: Continue using curved (smoothstep) edge paths for visual softness.

## LOD Rendering Specs

LOD bands control visual complexity at different zoom levels. The philosophy is "zoom reveals, it doesn't transform" (doc01.04).

### Band Definitions

| Band | Zoom Range | Purpose | Visual Character |
|------|-----------|---------|-----------------|
| Pill | < 0.5 | Topology overview | Tinted surface chips with accent dot and name, shadow-elevated, thin edges |
| Compact | 0.5 – 1.0 | Identity and grouping | Header + display name + key fields, medium shadows |
| Normal | >= 1.0 | Full detail and editing | Complete card with all controls, full shadows |

### Transition Philosophy

- **Animate between bands**: Use CSS `transition` on opacity, transform, and box-shadow so crossing a threshold feels smooth, not jarring.
- **Overlap zone**: Consider a small hysteresis/overlap zone (e.g., 0.45-0.55) where elements cross-fade rather than hard-switching.
- **Progressive detail**: Elements should fade in/out rather than appear/disappear. Fields fade in as you zoom toward normal. Controls fade in last.
- **Crossfade on band change**: When crossing LOD band thresholds, nodes briefly fade to opacity 0 then transition back to 1 over 120ms, smoothing the visual restructuring.

### Text Halo (Theme-Aware)

The `text-halo` utility must adapt to the active theme:

- **Dark themes**: Use dark shadows (current behavior) — `rgba(0, 0, 0, opacity)`
- **Light themes**: Use light/white shadows — `rgba(255, 255, 255, opacity)` — so the halo doesn't create a dark smudge around text on light backgrounds
- **Implementation**: Define as a CSS custom property that changes per theme, not a hardcoded rgba value
