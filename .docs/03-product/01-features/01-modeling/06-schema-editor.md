---
title: Schema Editor
status: active
---

# Schema Editor

The Construct Editor is a full-screen panel for creating and editing construct schemas. It sits between the header and footer bars, with a tabbed editing panel on the left and a live preview on the right.

## Layout

- **Header bar**: Cancel button, centered "Edit Schema" / "New Schema" label, Save button
- **Left panel** (flex-[3]): Tab bar + step content (max-width centered)
- **Right panel** (flex-[2]): Live preview showing all 4 display tier representations

## Tabs

1. **Basics**: Display name (auto-generates type ID), color, semantic description, schema group, background color policy (defaultOnly/tints/any), port display policy (inline/collapsed)
2. **Fields**: Drag-and-drop tier assignment. Fields are organized into display tiers (marker, minimal, details, full) via draggable chips in tier zones. "+ Add Field" button opens a modal with the field sub-wizard. Edit/delete actions appear on each draggable field chip.
3. **Ports**: Choose default ports or customize. Port editing opens in a modal with the port sub-wizard.

## Display Tiers

Fields are assigned to display tiers that control when they appear at different levels of detail:

| Tier | Purpose | Visibility |
|------|---------|------------|
| **marker** | Node title | Shown in marker LOD mode (max 1 field) |
| **minimal** | Key attributes | Shown in minimal LOD mode and above |
| **details** | Descriptive fields | Shown in details view |
| **full** | All remaining fields | Only visible in full view modal |

## Live Preview

The right panel shows live previews of all 4 display tiers (marker, minimal, details, full) with port indicators. Updates instantly as the user edits basics (color, name), fields (tier assignments), and ports.

## Edit Mode

Existing schemas can be edited by opening the editor with pre-filled values. All tabs are accessible and changes apply on save.

## Access

The editor opens from:
- Context menu on Metamap canvas: "New Construct Schema"
- Context menu on a schema node in Metamap: "Edit Schema"

## Key Files

| File | Purpose |
|------|---------|
| `packages/web-client/src/components/ConstructEditor.tsx` | Main editor: layout, state, tab bar, header |
| `packages/web-client/src/components/construct-editor/EditorPreview.tsx` | Live preview panel with 4 tier representations |
| `packages/web-client/src/components/construct-editor/FieldsStep.tsx` | Drag-and-drop tier assignment with field CRUD |
| `packages/web-client/src/components/construct-editor/PortsStep.tsx` | Port configuration with modal sub-wizard |
| `packages/web-client/src/components/field-display/DraggableField.tsx` | Draggable field chip with edit/delete actions |
| `packages/web-client/src/components/field-display/TierZone.tsx` | Droppable tier zone for field assignment |
