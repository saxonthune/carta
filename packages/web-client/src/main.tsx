import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DocumentProvider } from './contexts/DocumentContext'
import { migrateCartaLocal } from './utils/migration'
import { getLastDocumentId, setLastDocumentId } from './utils/preferences'
import { createDocument } from './stores/documentRegistry'
import { config } from './config/featureFlags'

async function boot() {
  const urlParams = new URLSearchParams(window.location.search);
  let documentId = urlParams.get('doc');

  if (!documentId) {
    if (config.hasServer) {
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

  // Remember last-opened document (local mode only — server mode uses URL)
  if (documentId && !config.hasServer) {
    setLastDocumentId(documentId);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {documentId ? (
        <DocumentProvider documentId={documentId}>
          <App />
        </DocumentProvider>
      ) : (
        <App />
      )}
    </StrictMode>,
  );
}

boot();
