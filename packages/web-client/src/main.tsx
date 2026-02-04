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
    // Try migration first, then fall back to last opened document
    const migratedId = await migrateCartaLocal();
    const lastDocId = getLastDocumentId();
    documentId = migratedId || lastDocId;

    // In local mode with no existing document, auto-create one (NUX: no modal gate)
    if (!documentId && !config.hasServer) {
      documentId = await createDocument('Untitled Project');
    }

    // In server mode, put doc ID in URL so links are shareable.
    // In local mode, keep the URL clean — localStorage tracks the active document.
    if (documentId && config.hasServer) {
      const url = new URL(window.location.href);
      url.searchParams.set('doc', documentId);
      history.replaceState(null, '', url.toString());
    }
  }

  // Remember this document as last-opened
  if (documentId) {
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
