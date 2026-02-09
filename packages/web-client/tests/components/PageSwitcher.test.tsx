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

    it('should enter inline rename mode when clicking page name', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      const pageName = screen.getByText('Main');
      await user.click(pageName);

      // Should show input after clicking
      const input = screen.getByDisplayValue('Main');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
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
  });

  describe('dropdown', () => {
    it('should open dropdown when clicking toggle button', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Click the chevron button (last button in trigger bar)
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

    it('should render description panel outside dropdown', async () => {
      const user = userEvent.setup();
      render(<PageSwitcher {...defaultProps} />);

      // Find and click the description toggle button (has document icon)
      const buttons = screen.getAllByRole('button');
      const descriptionButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        // Look for the document icon path
        const paths = svg.querySelectorAll('path');
        return Array.from(paths).some(path => path.getAttribute('d')?.includes('14 2H6'));
      });

      expect(descriptionButton).toBeDefined();
      await user.click(descriptionButton!);

      // Textarea should appear
      const textarea = screen.getByPlaceholderText('Add a page description...');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');

      // Now open dropdown
      const chevronButton = buttons.find(button => {
        const svg = button.querySelector('svg');
        if (!svg) return false;
        const path = svg.querySelector('path');
        return path?.getAttribute('d')?.includes('6 9l6 6');
      });

      await user.click(chevronButton!);

      // Textarea should disappear when dropdown is open (guarded by isDescriptionOpen && !isOpen)
      expect(screen.queryByPlaceholderText('Add a page description...')).not.toBeInTheDocument();
    });
  });
});
