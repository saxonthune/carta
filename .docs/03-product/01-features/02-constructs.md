---
title: Constructs
status: active
---

# Constructs

Constructs are the primary modeling element — typed nodes on the canvas representing software components.

## Schema and Instance

Every construct is an instance of a construct schema (doc03.01.06). The schema defines:
- Type identifier, display name, color
- Fields (named data slots with types)
- Ports (connection attachment points)
- Display behavior (which field is the title, background color policy, port display policy)
- Semantic description (included in compiled output for AI context)

## Identity

Each construct has a **semantic ID**, auto-generated as `{type}-{timestamp}{random}`. This is the primary identifier used in connections, compiled output, and cross-references. There is no separate "name" field — the display title comes from the schema's `displayField` value, falling back to semantic ID.

## Display Tiers

Fields are assigned to display tiers that control visibility at different levels of detail:

- **Pill**: Node title field (max 1), shown in pill LOD mode
- **Minimal**: Key attributes shown in collapsed/summary view
- **Details**: Additional fields shown in expanded details view
- **Full**: All remaining fields, only visible in full view modal

## Fields

Field types: string, number, boolean, enum, date. Fields are edited inline on the node (details view) or in the full view modal. Each field has optional: default value, placeholder, required flag. Fields are assigned to display tiers (pill, minimal, details, full) that control when they appear at different levels of detail.

## Background Color

Controlled by the schema's `backgroundColorPolicy`:
- **defaultOnly**: Node uses schema color, no user customization
- **tints**: User picks from 7 generated tint swatches based on schema color
- **any**: Full color picker for arbitrary instance colors

Instance color overrides are stored per-instance and can be reset to default.

## Deployable Assignment

Each construct can be assigned to a deployable (doc01.03) via a dropdown in the details view. Deployable assignment affects compilation grouping and visual background highlighting on the canvas.

## Virtual Parents

Virtual parent nodes are container constructs that visually group child constructs. Three collapse states:
- **Expanded**: Shows children inside a resizable container
- **No-edges**: Shows children but hides connecting edges
- **Collapsed**: Pill display with child count badge
