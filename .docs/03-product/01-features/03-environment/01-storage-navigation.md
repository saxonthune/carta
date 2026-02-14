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

## Vault Adapter Architecture

The vault abstraction is implemented via the **VaultAdapter** interface, which provides a uniform API for document operations regardless of storage backend.

### VaultAdapter Interface

```typescript
interface VaultAdapter {
  displayAddress: string;              // Human-readable vault location
  init?(): Promise<void>;              // Optional async initialization
  listDocuments(): Promise<DocumentSummary[]>;
  createDocument(title: string, folder?: string): Promise<string>;
  deleteDocument(id: string): Promise<boolean>;
  canChangeVault: boolean;             // Desktop only
  changeVault?(): Promise<void>;       // Desktop only
}
```

### Adapter Implementations

| Adapter | When Used | Capabilities |
|---------|-----------|--------------|
| **LocalVaultAdapter** | No server present (`!VITE_SYNC_URL`) | Single-document mode. Uses IndexedDB via `documentRegistry.ts`. Simple list/create/delete operations. |
| **ServerVaultAdapter** | Server present, non-desktop | Multi-document mode. Fetches document list from server API (`/api/documents`). Creates/deletes via server HTTP endpoints. |
| **DesktopVaultAdapter** | Desktop app (`window.electronAPI.isDesktop`) | Multi-document mode. Uses embedded server with filesystem persistence. Supports `changeVault()` to switch vault location. |

### Adapter Selection

The `createVaultAdapter()` factory function in `packages/web-client/src/stores/vault/createVaultAdapter.ts` detects the environment and returns the appropriate adapter:

1. Desktop detection: Checks `window.electronAPI?.isDesktop`
2. Server detection: Checks `config.syncUrl`
3. Fallback: Local adapter for browser-only mode

### Context Integration

The **VaultContext** (`packages/web-client/src/contexts/VaultContext.tsx`) wraps the adapter in a React context. The `VaultProvider` initializes the adapter asynchronously and provides it to the component tree via the `useVault()` hook.

In `main.tsx`, the `VaultProvider` wraps the entire app **outside** the `DocumentProvider`. This separation is intentional: vault operations (listing/creating documents) are distinct from document state (nodes/edges/schemas managed by the Yjs adapter).

## Implementation

| File | Purpose |
|------|---------|
| `packages/domain/src/types/index.ts` | VaultAdapter interface definition |
| `packages/web-client/src/stores/vault/LocalVaultAdapter.ts` | IndexedDB-backed adapter for single-document mode |
| `packages/web-client/src/stores/vault/ServerVaultAdapter.ts` | HTTP-based adapter for server mode |
| `packages/web-client/src/stores/vault/DesktopVaultAdapter.ts` | Desktop adapter with filesystem persistence |
| `packages/web-client/src/stores/vault/createVaultAdapter.ts` | Factory function for adapter selection |
| `packages/web-client/src/contexts/VaultContext.tsx` | React context wrapping VaultAdapter |
| `packages/web-client/src/components/modals/DocumentBrowserModal.tsx` | Modal presentation with required/optional modes |
| `packages/web-client/src/stores/vault/createVaultAdapter.ts` | Factory for creating deployment-specific vault adapters |
| `packages/web-client/src/stores/vault/LocalVaultAdapter.ts` | IndexedDB vault for browser-only mode (single document) |
| `packages/web-client/src/stores/vault/ServerVaultAdapter.ts` | Server-backed vault via HTTP API |
| `packages/web-client/src/stores/vault/DesktopVaultAdapter.ts` | Desktop vault via Electron IPC to embedded server |
| `packages/web-client/src/contexts/VaultContext.tsx` | React context for vault adapter access |
| `packages/web-client/src/stores/documentRegistry.ts` | IndexedDB registry for local documents |
| `packages/web-client/src/utils/randomNames.ts` | Random document name generator (Adjective-Noun-Number) |
| `packages/web-client/src/main.tsx` | Boot logic: document resolution, URL routing |
| `packages/web-client/src/components/ui/Breadcrumb.tsx` | Breadcrumb navigation component |
| `packages/web-client/src/components/ui/DocumentRow.tsx` | Document list item |
| `packages/web-client/src/components/ui/FolderRow.tsx` | Folder list item |
