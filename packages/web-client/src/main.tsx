import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DocumentProvider } from './contexts/DocumentContext'
import { migrateCartaLocal } from './utils/migration'
import { getLastDocumentId, setLastDocumentId } from './utils/preferences'

async function boot() {
  const urlParams = new URLSearchParams(window.location.search);
  let documentId = urlParams.get('doc');

  if (!documentId) {
    // Try migration first, then fall back to last opened document
    const migratedId = await migrateCartaLocal();
    const lastDocId = getLastDocumentId();
    documentId = migratedId || lastDocId;

    if (documentId) {
      // Redirect so URL reflects the document
      window.location.replace(`${window.location.pathname}?doc=${documentId}`);
      return; // Stop — page will reload with ?doc= param
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
