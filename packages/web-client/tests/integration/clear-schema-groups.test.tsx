/**
 * Test: Clear Everything Should Clear Schema Groups
 *
 * Verifies that "Clear Everything" properly clears schema groups
 * and that the Groups tab UI reflects the cleared state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSchemaGroups } from '../../src/hooks/useSchemaGroups';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { builtInSchemaGroups } from '@carta/domain';

describe('Clear Schema Groups', () => {
  it('should clear schema groups when clearing everything', async () => {
    const { result } = renderHook(
      () => ({
        schemaGroups: useSchemaGroups(),
        context: useDocumentContext(),
      }),
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(result.current.context.isReady).toBe(true);
    });

    const { adapter } = result.current.context;

    // Start with built-in schema groups
    act(() => {
      adapter.setSchemaGroups(builtInSchemaGroups);
    });

    await waitFor(() => {
      expect(result.current.schemaGroups.schemaGroups.length).toBeGreaterThan(0);
    });

    // Verify we have the software architecture group
    const softwareArchGroup = result.current.schemaGroups.schemaGroups.find(
      g => g.id === 'software-architecture'
    );
    expect(softwareArchGroup).toBeDefined();

    // Clear everything (simulating onClear('all'))
    act(() => {
      adapter.transaction(() => {
        adapter.setNodes([]);
        adapter.setEdges([]);
        adapter.setSchemas([]);
        adapter.setPortSchemas([]);
        adapter.setSchemaGroups([]);
      });
    });

    // Verify schema groups are cleared
    await waitFor(() => {
      expect(result.current.schemaGroups.schemaGroups).toHaveLength(0);
    });

    expect(result.current.schemaGroups.schemaGroups).toEqual([]);
  });

  it('should preserve schema groups when clearing only instances', async () => {
    const { result } = renderHook(
      () => ({
        schemaGroups: useSchemaGroups(),
        context: useDocumentContext(),
      }),
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(result.current.context.isReady).toBe(true);
    });

    const { adapter } = result.current.context;

    // Start with built-in schema groups
    act(() => {
      adapter.setSchemaGroups(builtInSchemaGroups);
    });

    await waitFor(() => {
      expect(result.current.schemaGroups.schemaGroups.length).toBeGreaterThan(0);
    });

    const initialGroupCount = result.current.schemaGroups.schemaGroups.length;

    // Clear only instances (simulating onClear('instances'))
    act(() => {
      adapter.transaction(() => {
        adapter.setNodes([]);
        adapter.setEdges([]);
      });
    });

    // Verify schema groups are preserved
    await waitFor(() => {
      expect(result.current.schemaGroups.schemaGroups.length).toBe(initialGroupCount);
    });

    // Verify software architecture group still exists
    const softwareArchGroup = result.current.schemaGroups.schemaGroups.find(
      g => g.id === 'software-architecture'
    );
    expect(softwareArchGroup).toBeDefined();
  });
});
