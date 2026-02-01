import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DocumentProvider } from './contexts/DocumentContext'

// Check for document ID in URL params for server mode
const urlParams = new URLSearchParams(window.location.search);
const documentId = urlParams.get('doc') || undefined;

// Static mode: single document in IndexedDB, no server required (like Excalidraw)
// Server mode: documents stored on server with collaboration features
const staticMode = import.meta.env.VITE_STATIC_MODE === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocumentProvider
      documentId={documentId}
      staticMode={staticMode}
    >
      <App />
    </DocumentProvider>
  </StrictMode>,
)
