---
title: New User Experience
status: active
---

# New User Experience

The new-document experience prioritizes **user control over convenience**. Schema packages are loaded explicitly via a package picker — no auto-seeding, no starter content. A new document starts with built-in port schemas only (flow, parent/child, relay, intercept, symmetric) and an empty canvas.

This approach replaced the old auto-seeding system (removed 2026-02). See doc02.04.07 for the package loading architecture.

## Principle

This is a deliberate departure from the "plop into a working document" philosophy. The old approach caused fragile initialization bugs (duplicate schemas on reload) and gave users schemas they didn't ask for. The new approach treats the user as intentional: they choose their vocabulary.

## Static Mode (Local-Only)

### First Visit

When a user visits Carta for the first time (no existing documents in IndexedDB):

1. **Auto-create a document** — no DocumentBrowserModal
2. **Show package picker** — standard library packages available to load
3. **Canvas is empty** until the user creates constructs (after optionally loading packages)
4. **Built-in port schemas** are present from document creation (document template)

### Returning Visit

When a user returns (existing documents in IndexedDB):

1. **Reopen the last document** — use `carta-last-document-id` from localStorage
2. **No modal** — go straight to canvas
3. **Document browser** available via header menu for switching documents

### Multiple Documents

The DocumentBrowserModal is still available for managing multiple documents, but it is never forced on the user. It is accessed through the header as a deliberate navigation action, not as a gate.

## Server Mode

Server mode retains the DocumentBrowserModal for first-time visitors because the user must choose between existing shared documents or create a new one.

## Package Picker

The package picker is the primary way users add schema vocabulary to their documents. Available from:

- New document flow (shown on first visit)
- Toolbar or menu action (available any time)
- Metamap (add packages to an existing document)

Each package shows:
- Name, description, color
- Schema count / preview
- Load status: available, loaded, loaded (modified)

Loaded packages (by UUID) are greyed out / blocked from re-loading. See doc03.01.01.07 for full library architecture.

## Future: Guided NUX

After the package loading system stabilizes, a guided first-time experience can be designed on top of it — potentially including starter content that uses the user's chosen packages. This is deliberately deferred until the lower-level design is solid.

## E2E Testability

The NUX must be testable with a clean browser state (cleared IndexedDB). The e2e test should verify:

- First visit renders canvas (not DocumentBrowserModal)
- Package picker is accessible
- Loading a package adds schemas to the document
- User can create constructs using loaded schemas
- Built-in port schemas are present without loading any packages
