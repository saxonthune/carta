/**
 * Test: Clear Everything Should Clear Schema Groups and Packages
 *
 * Verifies that "Clear Everything" properly clears schema groups and packages
 * and that the Groups tab UI reflects the cleared state.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSchemaGroups } from '../../src/hooks/useSchemaGroups';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { builtInSchemaGroups, builtInSchemaPackages } from '@carta/domain';

describe('Clear Schema Groups', () => {
  it('should clear schema groups and packages when clearing everything', async () => {
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

    // Start with built-in schema groups and packages
    act(() => {
      adapter.setSchemaPackages(builtInSchemaPackages);
      adapter.setSchemaGroups(builtInSchemaGroups);
    });

    await waitFor(() => {
      expect(result.current.schemaGroups.schemaGroups.length).toBeGreaterThan(0);
    });

    // Verify we have a subgroup (top-level groups are now packages)
    const apiGroup = result.current.schemaGroups.schemaGroups.find(
      g => g.id === 'api'
    );
    expect(apiGroup).toBeDefined();

    // Clear everything (simulating onClear('all'))
    act(() => {
      adapter.transaction(() => {
        adapter.setNodes([]);
        adapter.setEdges([]);
        adapter.setSchemas([]);
        adapter.setPortSchemas([]);
        adapter.setSchemaGroups([]);
        adapter.setSchemaPackages([]);
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

    // Start with built-in schema groups and packages
    act(() => {
      adapter.setSchemaPackages(builtInSchemaPackages);
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

    // Verify a subgroup still exists (top-level groups are now packages)
    const apiGroup = result.current.schemaGroups.schemaGroups.find(
      g => g.id === 'api'
    );
    expect(apiGroup).toBeDefined();
  });
});
