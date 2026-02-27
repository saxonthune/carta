---
title: UX Principles
status: active
---

# UX Principles

Laws and design principles that govern interaction design in Carta. These take precedence over aesthetic preference when evaluating UI/UX changes.

## Core Laws

### Fitts's Law

Acquisition time = f(distance, size). Larger targets closer to the cursor are faster to reach.

- Primary action buttons must be large and near the most recent interaction point.
- Screen edges and corners have effectively infinite target size (cursor stops there). Docked panels are easier to hit than floating palettes.
- In a canvas app, toolbar placement at viewport edges beats floating toolbars.

### Hick's Law

Decision time increases logarithmically with the number of equally-weighted options.

- Recommend default options to reduce decision load.
- Group and visually differentiate options — a menu of 12 items in 3 labeled groups is faster than 6 ungrouped items.
- Applies directly to construct type selection: schema groups reduce effective choice count.

### Miller's Law

Working memory holds ~7 +/- 2 items.

- Chunk wizard steps by cognitive load, not just logical grouping.
- Limit visible fields per step. Required fields first.
- Drawer tabs, context menus, and modal sections should each stay within this range.

### Jakob's Law

Users expect your app to work like the apps they already use.

- Follow React Flow conventions for canvas interaction (pan, zoom, select, connect).
- Standard keyboard shortcuts: Ctrl+Z undo, Ctrl+C copy, Delete removes selection.
- Modal, drawer, and menu patterns should match common IDE/productivity tool conventions.

**Reference apps**: Obsidian and Excalidraw are the closest comparable apps — both are canvas-oriented tools with document management, node/card manipulation, and creative workflows. When facing a UX decision, consider how these apps approach the same problem. They are reference points, not mandates — Carta may diverge where its domain demands it, but divergence should be deliberate, not accidental.

### Doherty Threshold

Responses under 400ms feel instantaneous. Above that, users lose flow state.

- Node creation, undo/redo, and canvas operations must feel instant.
- Compilation and export can show a spinner but should target sub-second.
- Hover states must be instant. Click feedback under 100ms.

### Postel's Law (Robustness Principle)

Be liberal in what you accept, conservative in what you produce.

- Accept multiple valid ways to accomplish the same task (keyboard, mouse, menu).
- Tolerate imprecise user input (approximate click targets, fuzzy search).
- Produce consistent, predictable output regardless of input path.

## Visual Design Principles

These govern how all visual elements — canvas content, editors, panels, modals — should look and feel. They apply universally, not just to one surface.

### Figure/Ground Separation

Every visual context has a **figure** (what the user is focused on) and a **ground** (the surface it sits on). The ground must always be quieter than the figure.

- **Canvas**: Nodes are the figure. The canvas background, organizer regions, and edges are ground. Nodes should have the highest contrast and most refined form; everything else exists to support them.
- **Editors/Modals**: Form fields and controls are the figure. Panel backgrounds, island containers, and section dividers are ground.
- **Practical test**: Squint at the screen. If background elements compete with foreground elements for attention, the figure/ground relationship is broken.

### Color Encodes Meaning, Not Decoration

Color should differentiate types at a glance through **hue**, not through **saturation**. Saturated colors are reserved for small interactive elements (accents, selection rings, badges). Large filled areas use desaturated tints.

- Default palettes should be curated sets of harmonious desaturated hues (see doc02.07 Schema Color Palette).
- Users can override with custom colors, but defaults must look cohesive together out of the box.
- Every theme defines its own tuned palette — not a mechanical transformation of one base palette.

### Depth Through Shadow, Not Borders

Elements that float above others communicate this through subtle `box-shadow`, not thick outlines or borders. Borders create visual noise; shadows create depth naturally.

- Node cards float above the canvas via shadow.
- Modals and popovers float above the page via shadow.
- Containers and islands use background color differences (the depth system), not border lines.
- Exception: form inputs and interactive controls may use subtle 1px borders for affordance.

### Typography Drives the Hierarchy

Within any component, the most important text should be the largest and boldest. Supporting text should recede through smaller size and muted color — never through competing visual treatments.

- In node cards: the display name (user's value) is the primary element. The schema type label is secondary. Field names are tertiary.
- In editors/modals: the title is primary. Section headers are secondary. Labels and metadata are tertiary.
- Avoid ALL CAPS for anything except small badges or tiny labels — it reduces readability at all sizes.

### Zoom Reveals, It Doesn't Transform

LOD transitions should feel like focusing a camera — elements fade, simplify, and recede rather than abruptly switching between completely different renderings.

- Transitions between LOD bands should use CSS animation (opacity, scale) so the shift feels continuous, not jarring.
- Each zoom level should answer a specific question: zoomed out = "what are the clusters?", mid = "what kinds of things?", zoomed in = "what are the details?"
- Elements should simplify progressively, not disappear and reappear in a different form.

### Theme-Native Colors

Each theme (light, dark, warm) should define its own palette that's tuned for its background, not a mechanical inversion of one base palette.

- On dark themes: node fills are moderately saturated, text is light, edges are muted cool tones.
- On light themes: node fills are lighter pastels with darker text, edges are medium gray, canvas is true neutral.
- The `text-halo` utility must use theme-appropriate shadow colors (dark shadows on light backgrounds create unwanted halos on light themes).



### Peak-End Rule

Users judge an experience by its peak moment and its end, not the average.

- Peak: The moment a user sees their architecture take shape (first nodes + connections). This must feel satisfying.
- End: Export/compile output. This is the last impression per session.
- Applies within flows too: the confirmation step of a wizard is its "end."

### Progressive Disclosure

Show only what's needed at each stage. Reveal complexity on demand.

Three user states to design for:
1. **First encounter** — discoverability matters most. Defaults, hints, empty states.
2. **Learned use** — efficiency matters most. Shortcuts, batch operations, spatial memory.
3. **Expert refinement** — power matters most. Keyboard-only workflows, advanced options.

The transitions between states matter as much as the states themselves. Don't create cliffs.

### Direct Manipulation

Objects on canvas should behave like physical objects. Drag, resize, group, connect — violations feel broken, not just inconvenient. Users build spatial memory of where they placed things. Never auto-rearrange without explicit opt-in.

### Mode Minimization

Every implicit mode where a click does something different is a source of user error. Minimize modes (select vs. connect vs. pan). When modes are necessary, make the current mode extremely visible.

### Aesthetic-Usability Effect

Users perceive aesthetically pleasing design as more usable. This cuts both ways: if Carta looks too simple, users may miss capabilities. Visual complexity should match actual complexity — just be well-organized. For a power tool, polish signals competence.

## UX Flow Taxonomy

Every interaction falls into one of these categories, each requiring distinct design treatment:

| Flow Type | User Intent | Design Priority |
|-----------|-------------|-----------------|
| Add new data | Multi-step creation (wizards) | Digestible chunks, required fields first, match mental model |
| Update existing data | Surgical edit of a specific value | Consistent data locations, intuitive paths to target field |
| Orient / comprehend | Understand an existing document | Navigation, zoom-to-fit, search, visual hierarchy |
| Destroy / bulk change | Delete or cascade-modify | Confirmation proportional to blast radius |

## Feedback Latency Hierarchy

| Interaction | Target Latency |
|-------------|---------------|
| Hover states | Instant (CSS-only, no JS) |
| Click feedback | < 100ms |
| Operation result | < 400ms |
| Background processing | Spinner + progress indication |
