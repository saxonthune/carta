import { useState, useEffect } from 'react';
import ChoiceCard from './ui/ChoiceCard';

interface WelcomeScreenProps {
  onVaultSelected: (serverInfo: { url: string; wsUrl: string; port: number; documentId?: string }) => void;
}

type Status = 'idle' | 'loading' | 'error';

export default function WelcomeScreen({ onVaultSelected }: WelcomeScreenProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [defaultPath, setDefaultPath] = useState<string | null>(null);

  // Load default path on mount
  useEffect(() => {
    window.electronAPI?.getDefaultVaultPath().then(setDefaultPath);
  }, []);

  async function handleSelectDefault() {
    if (!window.electronAPI) return;

    setStatus('loading');
    setError(null);

    try {
      const path = await window.electronAPI.getDefaultVaultPath();
      await window.electronAPI.setVaultPath(path);
      const serverInfo = await window.electronAPI.startServerWithVault(path);
      onVaultSelected(serverInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up vault');
      setStatus('error');
    }
  }

  async function handleChooseFolder() {
    if (!window.electronAPI) return;

    setStatus('loading');
    setError(null);

    try {
      const path = await window.electronAPI.chooseVaultFolder();
      if (!path) {
        // User cancelled
        setStatus('idle');
        return;
      }
      await window.electronAPI.setVaultPath(path);
      const serverInfo = await window.electronAPI.startServerWithVault(path);
      onVaultSelected(serverInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up vault');
      setStatus('error');
    }
  }

  const isLoading = status === 'loading';

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-content mb-2">Welcome to Carta</h1>
          <p className="text-content-muted">
            Choose where to store your projects. This folder will contain human-readable
            JSON files you can version control.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <ChoiceCard
            icon={<FolderIcon />}
            title="Use default location"
            description={defaultPath || '~/Documents/Carta/'}
            recommended
            onClick={handleSelectDefault}
            disabled={isLoading}
          />
          <ChoiceCard
            icon={<FolderOpenIcon />}
            title="Choose folder..."
            description="Select a custom location for your vault"
            onClick={handleChooseFolder}
            disabled={isLoading}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="mt-6 text-center text-content-muted">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent mr-2" />
            Setting up your vault...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mt-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
