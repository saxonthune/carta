/**
 * Test: Context Menu - Add Related functionality
 *
 * Verifies that the "Add Related" submenu in the node context menu:
 * - Shows/hides submenus correctly
 * - Groups related constructs by schema group
 * - Calls the correct callback with proper parameters
 * - Has delayed close to allow diagonal mouse movement
 *
 * This is an integration test that exercises:
 * - ContextMenu component
 * - Submenu state management
 * - Hover delay logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import ContextMenu, { type RelatedConstructOption } from '../../src/ContextMenu';
import type { SchemaGroup } from '../../src/constructs/types';

// Mock timers for testing delayed close
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('ContextMenu - Add Related', () => {
  const defaultProps = {
    x: 100,
    y: 100,
    type: 'node' as const,
    nodeId: 'test-node-1',
    selectedCount: 1,
    canPaste: false,
    onAddNode: vi.fn(),
    onDeleteNode: vi.fn(),
    onDeleteSelected: vi.fn(),
    onCopyNodes: vi.fn(),
    onPasteNodes: vi.fn(),
    onClose: vi.fn(),
  };

  describe('basic submenu display', () => {
    it('should show "Add Related" button when relatedConstructs are provided', () => {
      const relatedConstructs: RelatedConstructOption[] = [
        {
          constructType: 'SubTask',
          displayName: 'Sub Task',
          color: '#ff0000',
        },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      expect(screen.getByText(/Add Related/)).toBeInTheDocument();
    });

    it('should NOT show "Add Related" button when relatedConstructs is empty', () => {
      render(<ContextMenu {...defaultProps} relatedConstructs={[]} />);

      expect(screen.queryByText(/Add Related/)).not.toBeInTheDocument();
    });

    it('should NOT show "Add Related" button when multiple nodes selected', () => {
      const relatedConstructs: RelatedConstructOption[] = [
        { constructType: 'SubTask', displayName: 'Sub Task', color: '#ff0000' },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          selectedCount={3}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      expect(screen.queryByText(/Add Related/)).not.toBeInTheDocument();
    });
  });

  describe('flat list (no groups)', () => {
    it('should show flat list of related constructs on hover', async () => {
      const relatedConstructs: RelatedConstructOption[] = [
        { constructType: 'SubTask', displayName: 'Sub Task', color: '#ff0000' },
        { constructType: 'Milestone', displayName: 'Milestone', color: '#00ff00' },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      // Hover over "Add Related" to show submenu
      const addRelatedButton = screen.getByText(/Add Related/);
      fireEvent.mouseEnter(addRelatedButton.closest('div')!);

      // Should show both options
      expect(screen.getByText('Sub Task')).toBeInTheDocument();
      expect(screen.getByText('Milestone')).toBeInTheDocument();
    });

    it('should call onAddRelatedConstruct with correct params when clicking item', async () => {
      const onAddRelatedConstruct = vi.fn();
      const relatedConstructs: RelatedConstructOption[] = [
        {
          constructType: 'SubTask',
          displayName: 'Sub Task',
          color: '#ff0000',
          fromPortId: 'children',
          toPortId: 'parent',
        },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={onAddRelatedConstruct}
        />
      );

      // Hover to show submenu
      const addRelatedButton = screen.getByText(/Add Related/);
      fireEvent.mouseEnter(addRelatedButton.closest('div')!);

      // Click the item
      fireEvent.click(screen.getByText('Sub Task'));

      expect(onAddRelatedConstruct).toHaveBeenCalledWith('SubTask', 'children', 'parent');
    });

    it('should use label if provided instead of displayName', () => {
      const relatedConstructs: RelatedConstructOption[] = [
        {
          constructType: 'SubTask',
          displayName: 'Sub Task',
          color: '#ff0000',
          label: 'Add Subtask Here',
        },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      const addRelatedButton = screen.getByText(/Add Related/);
      fireEvent.mouseEnter(addRelatedButton.closest('div')!);

      expect(screen.getByText('Add Subtask Here')).toBeInTheDocument();
      expect(screen.queryByText('Sub Task')).not.toBeInTheDocument();
    });
  });

  describe('grouped submenus', () => {
    const schemaGroups: SchemaGroup[] = [
      { id: 'group-1', name: 'Task Types', color: '#0000ff' },
      { id: 'group-2', name: 'Service Types', color: '#00ff00' },
    ];

    const groupedRelatedConstructs: RelatedConstructOption[] = [
      { constructType: 'SubTask', displayName: 'Sub Task', color: '#ff0000', groupId: 'group-1' },
      { constructType: 'Epic', displayName: 'Epic', color: '#ff00ff', groupId: 'group-1' },
      { constructType: 'API', displayName: 'API Service', color: '#00ffff', groupId: 'group-2' },
      { constructType: 'Database', displayName: 'Database', color: '#ffff00' }, // No group
    ];

    it('should show group names in submenu when items have groupIds', () => {
      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={groupedRelatedConstructs}
          schemaGroups={schemaGroups}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      // Hover to show first submenu
      const addRelatedButton = screen.getByText(/Add Related/);
      fireEvent.mouseEnter(addRelatedButton.closest('div')!);

      // Should show group names, not individual items
      expect(screen.getByText(/Task Types/)).toBeInTheDocument();
      expect(screen.getByText(/Service Types/)).toBeInTheDocument();
      expect(screen.getByText(/Other/)).toBeInTheDocument(); // Ungrouped items
    });

    it('should show nested items when hovering over a group', async () => {
      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={groupedRelatedConstructs}
          schemaGroups={schemaGroups}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      // Hover to show first submenu
      const addRelatedButton = screen.getByText(/Add Related/);
      fireEvent.mouseEnter(addRelatedButton.closest('div')!);

      // Find and hover over "Task Types" group
      const taskTypesGroup = screen.getByText(/Task Types/).closest('div.relative');
      fireEvent.mouseEnter(taskTypesGroup!);

      // Should show the items in that group
      expect(screen.getByText('Sub Task')).toBeInTheDocument();
      expect(screen.getByText('Epic')).toBeInTheDocument();
    });

    it('should call onAddRelatedConstruct when clicking nested item', () => {
      const onAddRelatedConstruct = vi.fn();

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={groupedRelatedConstructs}
          schemaGroups={schemaGroups}
          onAddRelatedConstruct={onAddRelatedConstruct}
        />
      );

      // Navigate to nested item
      const addRelatedButton = screen.getByText(/Add Related/);
      fireEvent.mouseEnter(addRelatedButton.closest('div')!);

      const taskTypesGroup = screen.getByText(/Task Types/).closest('div.relative');
      fireEvent.mouseEnter(taskTypesGroup!);

      // Click on Sub Task
      fireEvent.click(screen.getByText('Sub Task'));

      expect(onAddRelatedConstruct).toHaveBeenCalledWith('SubTask', undefined, undefined);
    });
  });

  describe('delayed close behavior', () => {
    it('should NOT immediately close submenu on mouse leave', async () => {
      const relatedConstructs: RelatedConstructOption[] = [
        { constructType: 'SubTask', displayName: 'Sub Task', color: '#ff0000' },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      // Open submenu
      const addRelatedButton = screen.getByText(/Add Related/);
      const addRelatedContainer = addRelatedButton.closest('div')!;
      fireEvent.mouseEnter(addRelatedContainer);

      expect(screen.getByText('Sub Task')).toBeInTheDocument();

      // Mouse leave - submenu should still be visible immediately
      fireEvent.mouseLeave(addRelatedContainer);

      // Submenu should still be visible (within the delay window)
      expect(screen.getByText('Sub Task')).toBeInTheDocument();
    });

    it('should close submenu after delay expires', async () => {
      const relatedConstructs: RelatedConstructOption[] = [
        { constructType: 'SubTask', displayName: 'Sub Task', color: '#ff0000' },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      // Open submenu
      const addRelatedButton = screen.getByText(/Add Related/);
      const addRelatedContainer = addRelatedButton.closest('div')!;
      fireEvent.mouseEnter(addRelatedContainer);

      expect(screen.getByText('Sub Task')).toBeInTheDocument();

      // Mouse leave
      fireEvent.mouseLeave(addRelatedContainer);

      // Advance past the delay
      act(() => {
        vi.advanceTimersByTime(150); // SUBMENU_CLOSE_DELAY is 100ms
      });

      // Now submenu should be gone
      expect(screen.queryByText('Sub Task')).not.toBeInTheDocument();
    });

    it('should cancel close timeout if mouse re-enters', async () => {
      const relatedConstructs: RelatedConstructOption[] = [
        { constructType: 'SubTask', displayName: 'Sub Task', color: '#ff0000' },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
        />
      );

      // Open submenu
      const addRelatedButton = screen.getByText(/Add Related/);
      const addRelatedContainer = addRelatedButton.closest('div')!;
      fireEvent.mouseEnter(addRelatedContainer);

      // Mouse leave
      fireEvent.mouseLeave(addRelatedContainer);

      // Advance partway through delay
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Re-enter before timeout completes
      fireEvent.mouseEnter(addRelatedContainer);

      // Advance past what would have been the close time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Submenu should still be visible (timeout was cancelled)
      expect(screen.getByText('Sub Task')).toBeInTheDocument();
    });
  });

  describe('menu close behavior', () => {
    it('should call onClose after clicking a related construct item', () => {
      const onClose = vi.fn();
      const relatedConstructs: RelatedConstructOption[] = [
        { constructType: 'SubTask', displayName: 'Sub Task', color: '#ff0000' },
      ];

      render(
        <ContextMenu
          {...defaultProps}
          relatedConstructs={relatedConstructs}
          onAddRelatedConstruct={vi.fn()}
          onClose={onClose}
        />
      );

      // Navigate to item and click
      const addRelatedButton = screen.getByText(/Add Related/);
      fireEvent.mouseEnter(addRelatedButton.closest('div')!);
      fireEvent.click(screen.getByText('Sub Task'));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
