---
title: Storage Navigation
status: draft
---

# Storage Navigation

Storage Navigation is how users find, organize, and manage their documents. The design follows Jakob's Law: users spend most of their time in other apps, so Carta's navigation should feel like the filesystem browsers they already know.

## Core Concept: The Vault

A **vault** is the complete collection of documents accessible to a user from a single storage location. The vault is always singular — a user has one active vault at a time.

| Storage Backend | Vault Location | Persistence |
|-----------------|---------------|-------------|
| Local browser (no server) | IndexedDB | Per-browser, single document |
| Document server | Server database | Multi-document, shared |
| Desktop standalone | Local filesystem (`{userData}/documents/`) | Multi-document, private |
| Desktop + remote | Remote server | Multi-document, shared |

The vault abstraction means the navigation UI doesn't care where documents live. It presents the same filesystem-like experience regardless of backend.

## User Model

All documents in a vault belong to a **primary user**. Even in collaboration scenarios, the vault is personal — it shows what *this user* can access, not a global listing. Shared documents appear in the user's vault alongside their own.

This is consistent with how desktop file managers, Notion, and Figma work: you see your workspace, which may include things others have shared with you.

## Navigation UX

### Filesystem Metaphor

Navigation uses a hierarchical folder structure. Folders are **virtual** — derived from document path metadata, not stored as separate entities. A document with path `/projects/webapp` appears inside a `projects` folder containing a `webapp` folder.

Key interactions:
- **Breadcrumb navigation**: Click any path segment to jump directly to that level
- **Folder listing**: Child folders derived from documents under the current path
- **Back navigation**: Navigate up one level when not at root
- **Implicit folder creation**: Folders exist when documents exist inside them — saving a document to `/new-folder/doc` creates the folder
- **Sorting**: Folders alphabetically, documents by most recent

The folder structure is a UI presentation layer. The storage backend stores documents with a flat `folder` metadata field, and the client derives the tree view dynamically using `deriveFolderView()`.

### Search and Filtering

(Not yet implemented.) The vault should support search by document title, with results shown inline in the current view.

## Presentation

Storage Navigation has two presentation modes, both available depending on context:

### Modal (Current)

A large modal (DocumentBrowserModal) that overlays the canvas. Used when:
- **Required mode**: No document is open (no `?doc=` parameter with server present). The modal cannot be dismissed — the user must select or create a document before proceeding.
- **Optional mode**: User opens the document browser from the header to switch documents.

### Sidebar (Planned)

A persistent sidebar that coexists with the canvas. Allows browsing while keeping the current document visible. Useful for power users managing many documents.

## Document Lifecycle

| Action | Behavior |
|--------|----------|
| **Create** | New document with default title ("Untitled Project"). In required mode, created immediately and opened. |
| **Open** | Navigate to `?doc={documentId}`. Yjs adapter connects to the new document. |
| **Rename** | Editable from both the document browser and the header title. |
| **Move** | Change the document's folder path. The old folder disappears if empty. |
| **Delete** | (Not yet implemented in UI.) Server-side only. |

## Mode-Specific Behavior

### No Server (Local-Only)

Storage navigation is minimal. The first visit auto-creates a single document (doc03.01.03.05). The document browser is available but not surfaced prominently because local mode is designed for single-document use.

### Server Present

Storage navigation is central to the experience. Without a `?doc=` parameter, the DocumentBrowserModal appears in required mode — the user cannot bypass it. This ensures every session starts with an explicit document choice.

### Desktop

The desktop app auto-detects its embedded server and enables full vault navigation. The vault maps to `{userData}/documents/` on disk, with binary Y.Doc snapshots as the storage format.

## Implementation

| File | Purpose |
|------|---------|
| `packages/web-client/src/components/modals/DocumentBrowserModal.tsx` | Modal presentation with required/optional modes |
| `packages/web-client/src/stores/documentRegistry.ts` | IndexedDB registry for local documents |
| `packages/web-client/src/utils/randomNames.ts` | Random document name generator (Adjective-Noun-Number) |
| `packages/web-client/src/main.tsx` | Boot logic: document resolution, URL routing |
| `packages/web-client/src/components/ui/Breadcrumb.tsx` | Breadcrumb navigation component |
| `packages/web-client/src/components/ui/DocumentRow.tsx` | Document list item |
| `packages/web-client/src/components/ui/FolderRow.tsx` | Folder list item |
