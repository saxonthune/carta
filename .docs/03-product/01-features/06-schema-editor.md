---
title: Schema Editor
status: active
---

# Schema Editor

The Schema Creation Wizard is a multi-step modal for creating and editing construct schemas.

## Steps

1. **Basics**: Type identifier, display name, color, semantic description, display field, schema group assignment, background color policy (defaultOnly/tints/any), port display policy (inline/collapsed)
2. **Fields**: Add, edit, and remove field definitions. Each field has: label (auto-generates snake_case ID), type (string/number/boolean/enum/date), default value, required flag, placeholder, show-in-minimal-display flag. Enum fields additionally configure option lists.
3. **Ports**: Choose default ports or customize. Add, edit, and remove port definitions. Each port has: ID, label, port type (from available port schemas), position (left/right/top/bottom), offset percentage. Option to create a new port schema inline.
4. **Review**: Preview the schema before creation. Shows all configured properties.

## Edit Mode

Existing schemas can be edited by opening the wizard with pre-filled values. All steps are accessible and changes apply on completion.

## Access

The wizard opens from:
- Context menu on canvas: "New Construct Schema"
- Context menu on a schema node in Metamap
- Schema group context menu
