# MCP mutation tools should accept an explicit pageId

> **Scope**: enhancement
> **Layers touched**: server (MCP tools), document adapter
> **Summary**: MCP mutation tools (create_construct, create_organizer, batch_mutate, etc.) should accept an optional `pageId` parameter so AI agents can target a specific page without relying on the shared active-page state.

## Motivation

The current MCP tools for creating constructs, organizers, and connections all operate on the "active page." This active page is shared Yjs state — when an AI agent calls `set_active_page`, it also changes which page the user sees in their browser. Conversely, if the user navigates to a different page in the UI while the agent is working, the agent's mutations land on the wrong page.

This creates a race condition: the agent calls `set_active_page("Capabilities 2")`, but by the time `create_organizer` executes, the user may have navigated elsewhere, and the organizer lands on the wrong page.

## Design direction

- Add an optional `pageId` parameter to all page-scoped mutation tools: `create_construct`, `create_constructs`, `create_organizer`, `batch_mutate`, `connect_constructs`, `connect_constructs_bulk`, `disconnect_constructs`, `move_construct`
- When `pageId` is provided, the operation targets that page directly without changing the active page
- When `pageId` is omitted, preserve current behavior (use active page) for backwards compatibility
- The `set_active_page` tool remains useful for reading context, but agents should not need to call it just to target mutations

## Out of scope

- Changing how the browser tracks active page
- Making active page per-client (that's a larger Yjs architecture change)
