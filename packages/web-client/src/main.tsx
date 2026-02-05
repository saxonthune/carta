import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DocumentProvider } from './contexts/DocumentContext'
import { VaultProvider } from './contexts/VaultContext'
import { migrateCartaLocal } from './utils/migration'
import { getLastDocumentId, setLastDocumentId } from './utils/preferences'
import { createDocument } from './stores/documentRegistry'
import { config } from './config/featureFlags'

const root = createRoot(document.getElementById('root')!);

async function boot() {
  const urlParams = new URLSearchParams(window.location.search);
  let documentId = urlParams.get('doc');

  await bootWithDocumentId(documentId);
}

async function bootWithDocumentId(documentId: string | null) {
  if (!documentId) {
    if (config.isDesktop) {
      // Desktop mode: try last-opened document, otherwise show DocumentBrowserModal
      // (On first run the server isn't running yet — vault picker handles setup)
      const lastDocId = getLastDocumentId();
      documentId = lastDocId;
    } else if (config.hasServer) {
      // Server mode: URL is source of truth. No ?doc= means show DocumentBrowserModal.
      // Don't use localStorage — that's for local mode only.
      documentId = null;
    } else {
      // Local mode: try migration, then fall back to last opened document
      const migratedId = await migrateCartaLocal();
      const lastDocId = getLastDocumentId();
      documentId = migratedId || lastDocId;

      // Auto-create if no existing document (NUX: no modal gate)
      if (!documentId) {
        documentId = await createDocument('Untitled Project');
      }
    }
  }

  // Remember last-opened document (local and desktop modes)
  if (documentId && (config.isDesktop || !config.hasServer)) {
    setLastDocumentId(documentId);
  }

  root.render(
    <StrictMode>
      <VaultProvider>
        {documentId ? (
          <DocumentProvider documentId={documentId}>
            <App />
          </DocumentProvider>
        ) : (
          <App />
        )}
      </VaultProvider>
    </StrictMode>,
  );
}

boot();
