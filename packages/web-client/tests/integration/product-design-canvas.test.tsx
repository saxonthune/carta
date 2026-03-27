/**
 * Test: ProductDesignCanvas component
 *
 * Verifies rendering, callback wiring, and placeholder behavior.
 * Viewport interactions (pan, zoom, drag) are not tested here — those are
 * covered by cactus's own tests. Canvas is mocked to avoid d3-zoom.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasContext } from '../../src/cactus/CanvasContext';
import type { CanvasContextValue } from '../../src/cactus/CanvasContext';
import { ProductDesignCanvas } from '../../src/product-design/ProductDesignCanvas';
import type { CanvasSourceFile, FileContainerLayout } from '../../src/product-design/types';

// Mock Canvas to avoid d3-zoom / useViewport initialization in jsdom
vi.mock('../../src/cactus/Canvas.tsx', () => ({
  Canvas: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="canvas" className={className}>{children}</div>
  ),
}));

// Mock useCanvasContext — inner component reads transform.k for drag scale
vi.mock('../../src/cactus/CanvasContext.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/cactus/CanvasContext')>();
  return {
    ...actual,
    useCanvasContext: () => ({
      transform: { x: 0, y: 0, k: 1 },
      screenToCanvas: (x: number, y: number) => ({ x, y }),
      startConnection: () => {},
      connectionDrag: null,
      selectedIds: [],
      clearSelection: () => {},
      isSelected: () => false,
      onNodePointerDown: () => {},
      setSelectedIds: () => {},
      ctrlHeld: false,
    }),
  };
});

const MOCK_FILES: CanvasSourceFile[] = [
  {
    filename: 'employee-types.md',
    blocks: [
      {
        name: 'Employment Type',
        type: 'enumeration',
        body: { kind: 'nominal', values: [{ key: 'full-time' }, { key: 'part-time' }] },
        startOffset: 0,
        endOffset: 100,
      },
    ],
  },
  {
    filename: 'priorities.md',
    blocks: [
      {
        name: 'Priority',
        type: 'enumeration',
        body: { kind: 'ordinal', values: [{ key: 'low' }, { key: 'medium' }, { key: 'high' }] },
        startOffset: 0,
        endOffset: 100,
      },
    ],
  },
];

const MOCK_LAYOUT: FileContainerLayout[] = [
  { filename: 'employee-types.md', x: 0, y: 0 },
  { filename: 'priorities.md', x: 400, y: 0 },
];

function renderCanvas(
  overrides: {
    files?: CanvasSourceFile[];
    layout?: FileContainerLayout[];
    onBlockChange?: ReturnType<typeof vi.fn>;
    onLayoutChange?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const props = {
    files: overrides.files ?? MOCK_FILES,
    layout: overrides.layout ?? MOCK_LAYOUT,
    onBlockChange: overrides.onBlockChange ?? vi.fn(),
    onLayoutChange: overrides.onLayoutChange ?? vi.fn(),
  };
  return { ...render(<ProductDesignCanvas {...props} />), props };
}

describe('ProductDesignCanvas', () => {
  it('renders file containers with filenames', () => {
    renderCanvas();
    expect(screen.getByText('employee-types.md')).toBeDefined();
    expect(screen.getByText('priorities.md')).toBeDefined();
  });

  it('renders enumeration editor values', () => {
    renderCanvas();
    expect(screen.getByText('full-time')).toBeDefined();
    expect(screen.getByText('part-time')).toBeDefined();
    expect(screen.getByText('low')).toBeDefined();
    expect(screen.getByText('medium')).toBeDefined();
    expect(screen.getByText('high')).toBeDefined();
  });

  it('renders enumeration editor names as headers', () => {
    renderCanvas();
    expect(screen.getByText('Employment Type')).toBeDefined();
    expect(screen.getByText('Priority')).toBeDefined();
  });

  it('renders placeholder for unknown block types', () => {
    const files: CanvasSourceFile[] = [
      {
        filename: 'flows.md',
        blocks: [
          {
            name: 'Onboarding Flow',
            type: 'state-machine',
            body: {},
            startOffset: 0,
            endOffset: 50,
          },
        ],
      },
    ];
    const layout: FileContainerLayout[] = [{ filename: 'flows.md', x: 0, y: 0 }];
    renderCanvas({ files, layout });
    expect(screen.getByText('Onboarding Flow (state-machine)')).toBeDefined();
  });

  it('renders canvas with no containers when files is empty', () => {
    renderCanvas({ files: [], layout: [] });
    expect(screen.getByTestId('canvas')).toBeDefined();
    expect(screen.queryByText('employee-types.md')).toBeNull();
    expect(screen.queryByText('priorities.md')).toBeNull();
  });

  it('calls onBlockChange with filename and blockIndex when enum value changes', () => {
    const onBlockChange = vi.fn();
    renderCanvas({ onBlockChange });

    // Click the 'full-time' key cell to start editing
    fireEvent.click(screen.getByText('full-time'));

    // Find the input that appeared
    const input = screen.getByDisplayValue('full-time');
    fireEvent.change(input, { target: { value: 'contractor' } });
    fireEvent.blur(input);

    expect(onBlockChange).toHaveBeenCalledOnce();
    const [filename, blockIndex] = onBlockChange.mock.calls[0];
    expect(filename).toBe('employee-types.md');
    expect(blockIndex).toBe(0);
  });

  it('renders multiple blocks from one file inside a single FileContainer', () => {
    const files: CanvasSourceFile[] = [
      {
        filename: 'combined.md',
        blocks: [
          {
            name: 'Status',
            type: 'enumeration',
            body: { kind: 'nominal', values: [{ key: 'active' }] },
            startOffset: 0,
            endOffset: 100,
          },
          {
            name: 'Role',
            type: 'enumeration',
            body: { kind: 'nominal', values: [{ key: 'admin' }] },
            startOffset: 101,
            endOffset: 200,
          },
        ],
      },
    ];
    const layout: FileContainerLayout[] = [{ filename: 'combined.md', x: 0, y: 0 }];
    renderCanvas({ files, layout });

    // One filename tab
    expect(screen.getByText('combined.md')).toBeDefined();
    // Both editors rendered
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Role')).toBeDefined();
    expect(screen.getByText('active')).toBeDefined();
    expect(screen.getByText('admin')).toBeDefined();
  });
});
