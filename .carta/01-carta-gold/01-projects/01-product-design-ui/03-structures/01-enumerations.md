---
title: Enumerations
summary: Enumeration structure — data model, YAML format, UI design, and interaction vocabulary
tags: [project, enumerations, ui, structures]
deps: [doc01.01.01.03, doc01.05.08.10]
---

# Enumerations

A flat, finite set of named values. Referenced by entity fields and decision table columns. Simplest structure — first to build.

## Data model

Each value has two fields:

- **key** — string identifier. Stable across renames is not a goal; renaming a key is a meaningful product decision that should propagate. Keys are the reference target.
- **remark** — optional description.

An enumeration can be **nominal** (order is cosmetic, default) or **ordinal** (list position carries meaning — e.g., low < medium < high).

## YAML format

```carta
name: Priority
type: enumeration
---
kind: ordinal
values:
  - key: low
    remark: Triaged but not urgent
  - key: medium
  - key: high
    remark: Needs attention this sprint
```

```carta
name: Employment Type
type: enumeration
---
kind: nominal
values:
  - key: full-time
  - key: part-time
  - key: contractor
  - key: seasonal
```

## UI

Rendered as a table. Columns: key, remark. Header shows the enumeration name and kind badge (ordinal/nominal).

### UI actions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Add value | Click `+` button below table | Appends new row, focuses key field for inline editing |
| Edit key | Click key cell | Inline edit. On confirm, value updates in YAML |
| Edit remark | Click remark cell | Inline edit |
| Delete value | Row action (hover or context menu) | Removes row. Warn if referenced by other structures |
| Reorder (ordinal) | Drag handle on row | Drag-and-drop reorder. Only available when kind = ordinal |
| Reorder (nominal) | Drag handle on row | Cosmetic reorder, no semantic effect |
| Toggle kind | Click kind badge in header | Switch between ordinal and nominal. Warn if switching from ordinal (dependents may rely on ordering) |

### Open questions

- What does the delete warning look like? Inline banner? Modal? How much detail about referencing structures?
- Should there be a "duplicate value" action, or is add + edit sufficient?
- Keyboard navigation: tab through cells? Enter to confirm and move to next row?
