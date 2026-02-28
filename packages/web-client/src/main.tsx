import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DocumentProvider } from './contexts/DocumentContext'
import { VaultProvider } from './contexts/VaultContext'
import { GuideTooltipProvider } from './contexts/GuideTooltipContext'
import { migrateCartaLocal } from './utils/migration'
import { getLastDocumentId, setLastDocumentId } from './utils/preferences'
import { createDocument } from './stores/documentRegistry'
import { config } from './config/featureFlags'

// Default example for first-time single-document visitors
const DEFAULT_EXAMPLE = 'software-architecture';

performance.mark('carta:module-eval')

// Suppress the benign ResizeObserver loop error.
// This fires when a ResizeObserver callback triggers layout changes that produce
// more resize observations than can be delivered in a single frame. The browser
// delivers them in the next frame automatically — it's not a real error.
// React Flow's internal node measurement is the primary source during fast drag.
window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

const root = createRoot(document.getElementById('root')!);

async function boot() {
  performance.mark('carta:boot-start')
  const urlParams = new URLSearchParams(window.location.search);
  const documentId = urlParams.get('doc');

  await bootWithDocumentId(documentId);
}

async function bootWithDocumentId(documentId: string | null) {
  if (!documentId) {
    if (config.hasSync) {
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
        // First visit: inject default example so useExampleLoader imports it
        const url = new URL(window.location.href);
        if (!url.searchParams.has('example')) {
          url.searchParams.set('example', DEFAULT_EXAMPLE);
          history.replaceState(null, '', url.toString());
        }
      }
    }
  }

  // Remember last-opened document (local mode)
  if (documentId && !config.hasSync) {
    setLastDocumentId(documentId);
  }

  performance.mark('carta:render-start')
  performance.measure('carta:boot-resolve', 'carta:boot-start', 'carta:render-start')
  root.render(
    <StrictMode>
      <GuideTooltipProvider>
        <VaultProvider>
          {documentId ? (
            <DocumentProvider documentId={documentId}>
              <App />
            </DocumentProvider>
          ) : (
            <App />
          )}
        </VaultProvider>
      </GuideTooltipProvider>
    </StrictMode>,
  );
}

boot();
