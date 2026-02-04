import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DocumentProvider } from './contexts/DocumentContext'
import { migrateCartaLocal } from './utils/migration'
import { getLastDocumentId, setLastDocumentId } from './utils/preferences'
import { createDocument } from './stores/documentRegistry'
import { config } from './config/featureFlags'
import WelcomeScreen from './components/WelcomeScreen'

const root = createRoot(document.getElementById('root')!);

async function boot() {
  const urlParams = new URLSearchParams(window.location.search);
  let documentId = urlParams.get('doc');

  // Desktop first-run check
  if (config.isDesktop && window.electronAPI) {
    const isFirstRun = await window.electronAPI.isFirstRun();
    if (isFirstRun) {
      // Show welcome screen for vault selection
      root.render(
        <StrictMode>
          <WelcomeScreen onVaultSelected={handleVaultSelected} />
        </StrictMode>,
      );
      return;
    }
  }

  await bootWithDocumentId(documentId);
}

async function handleVaultSelected(serverInfo: { url: string; wsUrl: string; port: number; documentId?: string }) {
  // Update config with new server info
  // The config module reads from URL params, so we need to reload or update
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('desktopServer', serverInfo.url);
  currentUrl.searchParams.set('desktopWs', serverInfo.wsUrl);
  if (serverInfo.documentId) {
    currentUrl.searchParams.set('doc', serverInfo.documentId);
  }

  // Reload the page with the new server info
  window.location.href = currentUrl.toString();
}

async function bootWithDocumentId(documentId: string | null) {
  if (!documentId) {
    if (config.isDesktop) {
      // Desktop mode: has server but should auto-create like local mode (NUX)
      const lastDocId = getLastDocumentId();
      documentId = lastDocId;

      // Auto-create via server API if no existing document
      if (!documentId && config.serverUrl) {
        try {
          const resp = await fetch(`${config.serverUrl}/api/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Untitled Project', folder: '/' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            documentId = data.document?.id;
          }
        } catch (err) {
          console.error('Failed to auto-create document:', err);
        }
      }
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
