import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DocumentProvider } from './contexts/DocumentContext'

// Check for room ID in URL params for shared mode
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || undefined;

// Local mode hides collaboration features (Share button, connection status)
const localMode = import.meta.env.VITE_LOCAL_MODE === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocumentProvider
      roomId={roomId}
      localMode={localMode}
    >
      <App />
    </DocumentProvider>
  </StrictMode>,
)
