---
title: Constructs
status: active
---

# Constructs

Constructs are the primary modeling element — typed nodes on the canvas representing software components.

## Schema and Instance

Every construct is an instance of a construct schema (doc03.01.01.06). The schema defines:
- Type identifier, display name, color
- Fields (named data slots with types)
- Ports (connection attachment points)
- Display behavior (which field is the title, background color policy, port display policy)
- Semantic description (included in compiled output for AI context)

## Identity

Each construct has a **semantic ID**, auto-generated as `{type}-{timestamp}{random}`. This is the primary identifier used in connections, compiled output, and cross-references. There is no separate "name" field — the display title comes from the schema's `displayField` value, falling back to semantic ID.

## Display Tiers

Fields are assigned to display tiers that control visibility:

- **Pill**: Node title field (max 1 per schema), shown in pill LOD mode
- **Summary**: Key attributes shown on the canvas
- **Inspector-only**: Fields without displayTier, only visible in inspector panel

## Fields

Field types: string, number, boolean, enum, date. Fields are edited inline on the node or in the inspector panel (side panel that appears when selecting a node). Each field has optional: default value, placeholder, required flag. Fields are assigned to display tiers (pill, summary, or omitted for inspector-only) that control when they appear.

## Background Color

Controlled by the schema's `backgroundColorPolicy`:
- **defaultOnly**: Node uses schema color, no user customization
- **tints**: User picks from 7 generated tint swatches based on schema color
- **any**: Full color picker for arbitrary instance colors

Instance color overrides are stored per-instance and can be reset to default.

## Visual Organization

Constructs can be grouped into organizers (doc02.09) for spatial organization on the canvas. Organizers are visual-only — they are never compiled. See doc01.03 for the distinction between organizers (spatial) and connections (semantic).
