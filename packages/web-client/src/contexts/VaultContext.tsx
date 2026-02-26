import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { VaultAdapter } from '@carta/domain';
import { createVaultAdapter } from '../stores/vault/createVaultAdapter';

interface VaultContextValue {
  adapter: VaultAdapter;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [adapter] = useState(() => createVaultAdapter());
  const [ready, setReady] = useState(!adapter.init);

  useEffect(() => {
    if (adapter.init) {
      performance.mark('carta:vault-init-start')
      adapter.init().then(() => {
        performance.mark('carta:vault-ready')
        performance.measure('carta:vault-init', 'carta:vault-init-start', 'carta:vault-ready')
        setReady(true)
      });
    }
  }, [adapter]);

  if (!ready) return null;

  return (
    <VaultContext.Provider value={{ adapter }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}
