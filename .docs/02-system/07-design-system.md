---
title: Design System
status: active
---

# Design System

Visual and interaction standards for the Carta application UI. These rules govern the **application chrome** — user-created content (node colors, schema definitions) is styled however users prefer.

## Depth System

Carta uses a three-level depth system to create visual hierarchy in multi-panel layouts.

### Levels

| Level | CSS Variable | Tailwind | Usage |
|-------|-------------|----------|-------|
| 1 (Outermost) | `--color-surface-depth-1` | `bg-surface-depth-1` | Tab bars, outermost navigation |
| 2 (Middle) | `--color-surface-depth-2` | `bg-surface-depth-2` | Island containers within sidebars |
| 3 (Innermost) | `--color-surface-depth-3` | `bg-surface-depth-3` | Main content areas, editor panels |

### Theme Behavior

- **Dark themes** (dark, warm): Level 1 lightest, Level 3 darkest. Creates a "looking into a hole" effect — depth increases inward.
- **Light theme**: Level 3 is brightest (white). Creates a "hill" effect — content area is elevated.

### Island Pattern

Grouped content within sidebars uses Level 2 islands with `rounded-xl`. This creates clear visual boundaries without borders.

```
┌──────┬──────────────────┬───────────────────┐
│ Tabs │  Sidebar (L1)    │  Main Content     │
│ (L1) │  ┌────────────┐  │  (L3)             │
│      │  │ Island (L2)│  │                   │
│      │  └────────────┘  │                   │
│      │  ┌────────────┐  │                   │
│      │  │ Island (L2)│  │                   │
│      │  └────────────┘  │                   │
└──────┴──────────────────┴───────────────────┘
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
| `emerald/green` | Success, positive | Compile, Save, success states |
| `amber/yellow` | Warning | Warnings, pending states |
| `danger/red` | Destructive | Delete, errors, validation |
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

The `text-halo` utility provides readable white text on any background color via layered soft blur shadows:

```css
@utility text-halo {
  text-shadow:
    0 2px 12px rgba(0, 0, 0, 0.8),
    0 4px 24px rgba(0, 0, 0, 0.6),
    0 8px 48px rgba(0, 0, 0, 0.4);
}
```

Used on node headers and any text overlaid on user-customizable background colors.

## Design Principles

- **Clarity over decoration**: Use depth and spacing for hierarchy, not heavy borders
- **Backgrounds do the work**: Visual separation comes from surface depth, not lines
- **Consistency**: Same depth system, island pattern, and selection highlights everywhere
- **Accessibility**: Sufficient contrast between depth levels, visible focus states, minimum 4.5:1 body text contrast
