import { ReactNode } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { DocumentProvider } from '../../src/contexts/DocumentContext';

interface TestProvidersProps {
  children: ReactNode;
}

/**
 * Wraps components with all required providers for testing.
 * Uses local mode and skips persistence to avoid WebSocket/IndexedDB.
 */
export function TestProviders({ children }: TestProvidersProps) {
  return (
    <ReactFlowProvider>
      <DocumentProvider localMode={true} skipPersistence={true}>
        {children}
      </DocumentProvider>
    </ReactFlowProvider>
  );
}

/**
 * Minimal provider for testing hooks that only need document context.
 * Does not include ReactFlowProvider (use for non-canvas tests).
 */
export function DocumentTestProvider({ children }: TestProvidersProps) {
  return (
    <DocumentProvider localMode={true} skipPersistence={true}>
      {children}
    </DocumentProvider>
  );
}
