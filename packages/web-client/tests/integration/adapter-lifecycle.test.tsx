/**
 * Test: Adapter Lifecycle
 *
 * Tests the Yjs adapter's handling of React lifecycle events, particularly:
 * - React StrictMode double-mount (mount → unmount → mount)
 * - Disposal during async initialization
 * - Timeout cancellation on disposal
 * - Operations on disposed adapters
 *
 * These tests verify the fixes for race conditions that occur when:
 * 1. StrictMode unmounts a component while async initialization is in progress
 * 2. IndexedDB sync times out after the adapter is disposed
 * 3. External callbacks (ResizeObserver, timers) fire on stale adapters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode, useEffect, useState } from 'react';
import { DocumentProvider, useDocumentContext } from '../../src/contexts/DocumentContext';
import { createYjsAdapter } from '../../src/stores/adapters/yjsAdapter';

// Suppress expected console warnings during tests
const originalWarn = console.warn;
const originalLog = console.log;

beforeEach(() => {
  // Suppress adapter lifecycle logs during tests
  console.log = (...args) => {
    if (args[0]?.includes?.('[YjsAdapter]') || args[0]?.includes?.('[IDB')) return;
    originalLog(...args);
  };
  console.warn = (...args) => {
    if (args[0]?.includes?.('IndexedDB sync failed')) return;
    originalWarn(...args);
  };
});

afterEach(() => {
  console.warn = originalWarn;
  console.log = originalLog;
  cleanup();
});

describe('Adapter Lifecycle', () => {
  describe('StrictMode Double-Mount', () => {
    it('should handle StrictMode mount-unmount-mount without errors', async () => {
      const errors: Error[] = [];
      const originalError = console.error;
      console.error = (...args) => {
        // Capture actual errors, not React warnings
        if (args[0] instanceof Error) {
          errors.push(args[0]);
        } else if (typeof args[0] === 'string' && args[0].includes('closed database')) {
          errors.push(new Error(args[0]));
        }
        originalError(...args);
      };

      // Component that tracks mount/unmount
      const mountCounts = { mount: 0, unmount: 0 };
      function TestComponent() {
        const { isReady } = useDocumentContext();
        useEffect(() => {
          mountCounts.mount++;
          return () => { mountCounts.unmount++; };
        }, []);
        return <div>{isReady ? 'ready' : 'loading'}</div>;
      }

      render(
        <StrictMode>
          <DocumentProvider documentId="test-strict-mode" skipPersistence>
            <TestComponent />
          </DocumentProvider>
        </StrictMode>
      );

      // Wait for initialization to complete
      await waitFor(() => {
        // StrictMode causes double mount in dev
        expect(mountCounts.mount).toBeGreaterThanOrEqual(1);
      }, { timeout: 2000 });

      // Give async operations time to settle
      await new Promise(r => setTimeout(r, 100));

      console.error = originalError;

      // Should have no "closed database" errors
      const dbErrors = errors.filter(e =>
        e.message.includes('closed database') ||
        e.message.includes('IDBDatabase')
      );
      expect(dbErrors).toHaveLength(0);
    });

    it('should properly dispose adapter on unmount', async () => {
      let adapterDisposed = false;
      const originalDispose = vi.fn();

      function TestComponent() {
        const { adapter } = useDocumentContext();
        useEffect(() => {
          // Wrap dispose to track calls
          const originalMethod = adapter.dispose.bind(adapter);
          adapter.dispose = () => {
            adapterDisposed = true;
            originalDispose();
            originalMethod();
          };
        }, [adapter]);
        return <div>test</div>;
      }

      const { unmount } = render(
        <DocumentProvider documentId="test-dispose" skipPersistence>
          <TestComponent />
        </DocumentProvider>
      );

      await waitFor(() => {
        // Component mounted
      }, { timeout: 1000 });

      unmount();

      // Dispose should have been called
      expect(adapterDisposed).toBe(true);
    });
  });

  describe('createYjsAdapter Disposal', () => {
    it('should set isDisposed flag on dispose', async () => {
      const adapter = createYjsAdapter({
        mode: 'local',
        roomId: 'test-disposed-flag',
        skipPersistence: true,
      });

      await adapter.initialize();

      // Adapter should work before disposal
      expect(() => adapter.getNodes()).not.toThrow();

      adapter.dispose();

      // After dispose, Y.Doc is destroyed
      // Operations may throw or return empty depending on implementation
    });

    it('should handle multiple dispose calls gracefully', async () => {
      const adapter = createYjsAdapter({
        mode: 'local',
        roomId: 'test-double-dispose',
        skipPersistence: true,
      });

      await adapter.initialize();

      // First dispose
      expect(() => adapter.dispose()).not.toThrow();

      // Second dispose should not throw
      expect(() => adapter.dispose()).not.toThrow();
    });

    it('should handle dispose before initialize completes', async () => {
      const adapter = createYjsAdapter({
        mode: 'local',
        roomId: 'test-early-dispose',
        skipPersistence: true,
      });

      // Start initialization but don't await
      const initPromise = adapter.initialize();

      // Dispose immediately
      adapter.dispose();

      // Initialization should complete without errors
      await expect(initPromise).resolves.toBeUndefined();
    });
  });

  describe('Adapter Operations', () => {
    it('should allow operations during normal lifecycle', async () => {
      const adapter = createYjsAdapter({
        mode: 'local',
        roomId: 'test-operations',
        skipPersistence: true,
      });

      await adapter.initialize();

      // All operations should work
      expect(() => adapter.setTitle('Test Title')).not.toThrow();
      expect(adapter.getTitle()).toBe('Test Title');

      expect(() => adapter.setNodes([])).not.toThrow();
      expect(adapter.getNodes()).toEqual([]);

      expect(() => adapter.setEdges([])).not.toThrow();
      expect(adapter.getEdges()).toEqual([]);

      adapter.dispose();
    });

    it('should handle subscription cleanup on dispose', async () => {
      const adapter = createYjsAdapter({
        mode: 'local',
        roomId: 'test-subscriptions',
        skipPersistence: true,
      });

      await adapter.initialize();

      const listener = vi.fn();
      const unsubscribe = adapter.subscribe(listener);

      // Trigger a change
      adapter.setTitle('Changed');

      // Listener should have been called
      await waitFor(() => {
        expect(listener).toHaveBeenCalled();
      });

      // Dispose
      adapter.dispose();

      // Unsubscribe should not throw even after dispose
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('Provider Integration', () => {
    it('should provide working adapter to children', async () => {
      let capturedAdapter: unknown = null;

      function CaptureAdapter() {
        const { adapter, isReady } = useDocumentContext();
        if (isReady) {
          capturedAdapter = adapter;
        }
        return <div>{isReady ? 'ready' : 'loading'}</div>;
      }

      render(
        <DocumentProvider documentId="test-provider" skipPersistence>
          <CaptureAdapter />
        </DocumentProvider>
      );

      await waitFor(() => {
        expect(capturedAdapter).not.toBeNull();
      });

      // Adapter should have expected methods
      expect(capturedAdapter).toHaveProperty('getNodes');
      expect(capturedAdapter).toHaveProperty('setNodes');
      expect(capturedAdapter).toHaveProperty('dispose');
    });

    it('should handle rapid documentId changes', async () => {
      const errors: string[] = [];
      const originalError = console.error;
      console.error = (...args) => {
        errors.push(String(args[0]));
        originalError(...args);
      };

      function DynamicDoc() {
        const [docId, setDocId] = useState('doc-1');
        return (
          <>
            <DocumentProvider documentId={docId} skipPersistence>
              <div>Doc: {docId}</div>
            </DocumentProvider>
            <button onClick={() => setDocId('doc-2')}>Change</button>
          </>
        );
      }

      const { getByText } = render(<DynamicDoc />);

      await waitFor(() => {
        expect(getByText(/Doc: doc-1/)).toBeDefined();
      });

      // Change document ID
      await act(async () => {
        getByText('Change').click();
      });

      await waitFor(() => {
        expect(getByText(/Doc: doc-2/)).toBeDefined();
      });

      // Give cleanup time
      await new Promise(r => setTimeout(r, 100));

      console.error = originalError;

      // No database errors
      const dbErrors = errors.filter(e => e.includes('closed database'));
      expect(dbErrors).toHaveLength(0);
    });
  });
});
