import { ReactNode } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { DocumentProvider } from '../../src/contexts/DocumentContext';

interface TestProvidersProps {
  children: ReactNode;
}

/**
 * Wraps components with all required providers for testing.
 * Uses a fixed test document ID and skips persistence and starter content.
 */
export function TestProviders({ children }: TestProvidersProps) {
  return (
    <ReactFlowProvider>
      <DocumentProvider documentId="test-document" skipPersistence={true} skipStarterContent={true}>
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
    <DocumentProvider documentId="test-document" skipPersistence={true} skipStarterContent={true}>
      {children}
    </DocumentProvider>
  );
}
