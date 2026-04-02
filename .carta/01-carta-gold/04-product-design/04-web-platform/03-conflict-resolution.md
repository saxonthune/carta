---
title: Conflict Resolution
status: draft
summary: Server-side conflict handling for simultaneous nontechnical users
tags: [web, collaboration, conflicts, server]
deps: [doc01.04.04.00, doc01.03.09]
---

# Conflict Resolution

When multiple nontechnical users edit specs simultaneously, conflicts must be handled by the server — not by git merge conflicts that users would need to resolve manually.

## Principle

Nontechnical users should never see a git conflict. The server resolves concurrent edits before they reach git. This is different from the developer workflow where git conflicts are expected and manually resolved.

## Layers

1. **Real-time sync** (Yjs/WebSocket): Concurrent edits to the same document are merged automatically via CRDT. This handles the common case — two users typing in the same spec.
2. **Structural conflicts** (server-side): Operations like moving or renaming specs while another user is editing them. The server must detect and resolve these before committing to git.
3. **Cross-session conflicts**: User A edits offline, User B edits the same spec. When A reconnects, the server must merge or present a choice — but never a raw git diff.

## Open Questions

1. What's the merge strategy for structural conflicts? Last-write-wins, or does the server present a simplified choice to the user?
2. Should users see other users' cursors/presence (Figma-style), or is it sufficient to merge silently?
3. How do conflicts between AI-generated edits (from conversational flow) and simultaneous human edits resolve?
