import { ReactNode } from 'react';
import { DocumentProvider } from '../../src/contexts/DocumentContext';

interface TestProvidersProps {
  children: ReactNode;
}

/**
 * Wraps components with all required providers for testing.
 * Uses a fixed test document ID and skips persistence to avoid IndexedDB.
 */
export function TestProviders({ children }: TestProvidersProps) {
  return (
    <DocumentProvider documentId="test-document" skipPersistence={true}>
      {children}
    </DocumentProvider>
  );
}

/**
 * Minimal provider for testing hooks that only need document context.
 * Does not include ReactFlowProvider (use for non-canvas tests).
 */
export function DocumentTestProvider({ children }: TestProvidersProps) {
  return (
    <DocumentProvider documentId="test-document" skipPersistence={true}>
      {children}
    </DocumentProvider>
  );
}
