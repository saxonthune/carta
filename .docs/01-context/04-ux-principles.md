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

## Interaction Design Principles

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
