/**
 * Component Smoke Tests: PageSwitcher
 *
 * Verifies PageSwitcher DOM structure to prevent agent drift (e.g., description editing in wrong location).
 * Tests what appears in the DOM, not internal state.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PageSwitcher from '../../src/components/PageSwitcher';
import type { Page } from '@carta/domain';

// Mock dnd-kit to avoid jsdom issues with drag-and-drop
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => children,
  pointerWithin: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => children,
  verticalListSortingStrategy: {},
  arrayMove: (arr: any[], oldIndex: number, newIndex: number) => {
    const newArr = [...arr];
    const [removed] = newArr.splice(oldIndex, 1);
    newArr.splice(newIndex, 0, removed);
    return newArr;
  },
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

function createTestPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    name: 'Main',
    order: 0,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

const defaultProps = {
  pages: [createTestPage()],
  activePage: 'page-1',
  onSetActivePage: vi.fn(),
  onCreatePage: vi.fn(),
  onDeletePage: vi.fn(() => true),
  onUpdatePage: vi.fn(),
  onDuplicatePage: vi.fn(),
};

describe('PageSwitcher', () => {
  describe('trigger bar', () => {
    it('should render current page name', () => {
      render(<PageSwitcher {...defaultProps} />);

      expect(screen.getByText('Main')).toBeInTheDocument();
    });

    it('should show description subtitle', () => {
      render(<PageSwitcher {...defaultProps} />);

      // Default placeholder when no description
      expect(screen.getByText('Add description...')).toBeInTheDocument();
    });

    it('should show description text as subtitle when page has description', () => {
      const pages = [createTestPage({ description: 'This is a test description\nSecond line' })];
      render(<PageSwitcher {...defaultProps} pages={pages} />);

      // Should show first line only
      expect(screen.getByText('This is a test description')).toBeInTheDocument();
      expect(screen.queryByText('Second line')).not.toBeInTheDocument();
    });

    it('should not show textarea by default', () => {
      render(<PageSwitcher {...defaultProps} />);

      // No textarea should be visible initially
      expect(screen.queryByPlaceholderText('Add a page description...')).not.toBeInTheDocument();
    });

    it('should have a dropdown toggle button', () => {
      render(<PageSwitcher {...defaultProps} />);

      // Find the chevron button (has SVG with chevron path)
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      expect(chevronButton).toBeDefined();
    });

    it('should toggle description textarea when clicking page info area', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Click on the page info area (the button containing page name and subtitle)
      const pageInfoButton = screen.getByText('Main').closest('button');
      await user.click(pageInfoButton!);

      // Textarea should appear
      const textarea = screen.getByPlaceholderText('Add a page description...');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('dropdown', () => {
    it('should open dropdown when clicking toggle button', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Click the chevron button
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Dropdown should show page name
      const pageRows = screen.getAllByText('Main');
      expect(pageRows.length).toBeGreaterThan(1); // One in trigger, one in dropdown
    });

    it('should show page names in dropdown rows', async () => {
      const user = userEvent.setup();
      const pages = [
        createTestPage({ id: 'page-1', name: 'Page 1', order: 0 }),
        createTestPage({ id: 'page-2', name: 'Page 2', order: 1 }),
        createTestPage({ id: 'page-3', name: 'Page 3', order: 2 }),
      ];

      render(<PageSwitcher {...defaultProps} pages={pages} activePage="page-1" />);

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // All page names should appear
      expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.getByText('Page 3')).toBeInTheDocument();
    });

    it('should call onSetActivePage when clicking a page row', async () => {
      const user = userEvent.setup();
      const onSetActivePage = vi.fn();
      const pages = [
        createTestPage({ id: 'page-1', name: 'Page 1', order: 0 }),
        createTestPage({ id: 'page-2', name: 'Page 2', order: 1 }),
      ];

      render(<PageSwitcher {...defaultProps} pages={pages} activePage="page-1" onSetActivePage={onSetActivePage} />);

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Click on Page 2 row (not the trigger bar Page 1)
      const page2Elements = screen.getAllByText('Page 2');
      await user.click(page2Elements[0]);

      expect(onSetActivePage).toHaveBeenCalledWith('page-2');
    });

    it('should show New Page button', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      expect(screen.getByText('+ New Page')).toBeInTheDocument();
    });

    it('should show rearrange toggle button in bottom bar', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Find the rearrange button (has drag handle icon - 6 circles)
      const rearrangeButton = screen.getAllByRole('button').find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const circles = svg.querySelectorAll('circle');
        return circles.length === 6; // Drag handle has 6 circles
      });

      expect(rearrangeButton).toBeDefined();
    });

    it('should close dropdown when clicking toggle again', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Verify dropdown is open
      expect(screen.getByText('+ New Page')).toBeInTheDocument();

      // Close dropdown
      await user.click(chevronButton!);

      // New Page button should not be visible
      expect(screen.queryByText('+ New Page')).not.toBeInTheDocument();
    });

    it('should not show inline action icons on rows', async () => {
      const user = userEvent.setup();
      const pages = [
        createTestPage({ id: 'page-1', name: 'Page 1', order: 0 }),
        createTestPage({ id: 'page-2', name: 'Page 2', order: 1 }),
      ];

      render(<PageSwitcher {...defaultProps} pages={pages} activePage="page-1" />);

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Should not have buttons with "Rename page", "Duplicate page", or "Delete page" titles
      expect(screen.queryByTitle('Rename page')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Duplicate page')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Delete page')).not.toBeInTheDocument();
    });
  });

  describe('structural assertions', () => {
    it('should not render textarea in dropdown rows', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Query for textarea elements - should not exist in dropdown
      const textareas = screen.queryAllByRole('textbox', { name: /description/i });
      expect(textareas).toHaveLength(0);
    });

    it('should hide description textarea when dropdown is opened', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // First, open description by clicking page info area
      const pageInfoButton = screen.getByText('Main').closest('button');
      await user.click(pageInfoButton!);

      // Verify textarea is visible
      expect(screen.getByPlaceholderText('Add a page description...')).toBeInTheDocument();

      // Now open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Textarea should disappear (mutual exclusion)
      expect(screen.queryByPlaceholderText('Add a page description...')).not.toBeInTheDocument();
    });

    it('should hide description subtitle when dropdown is open', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Verify subtitle is visible initially
      expect(screen.getByText('Add description...')).toBeInTheDocument();

      // Open dropdown
      const buttons = screen.getAllByRole('button');
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Subtitle should not be visible when dropdown is open
      expect(screen.queryByText('Add description...')).not.toBeInTheDocument();
    });
  });
});
