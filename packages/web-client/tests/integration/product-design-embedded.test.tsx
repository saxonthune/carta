/**
 * Test: ProductDesignEmbedded component
 *
 * Verifies message handling between VS Code extension and the WebView.
 * Mocks acquireVsCodeApi and fires MessageEvents directly.
 * Canvas internals (drag, viewport) are not tested here.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ProductDesignEmbedded } from '../../src/product-design/ProductDesignEmbedded';
import type { CanvasSourceFile, FileContainerLayout, CartaCodeBlock } from '../../src/product-design/types';

// Mock ProductDesignCanvas to avoid d3-zoom / canvas setup
vi.mock('../../src/product-design/ProductDesignCanvas.tsx', () => ({
  ProductDesignCanvas: ({
    files,
    layout,
    onBlockChange,
    onLayoutChange,
    className,
  }: {
    files: CanvasSourceFile[];
    layout: FileContainerLayout[];
    onBlockChange: (filename: string, blockIndex: number, newBody: Record<string, unknown>) => void;
    onLayoutChange: (layout: FileContainerLayout[]) => void;
    className?: string;
  }) => (
    <div data-testid="product-design-canvas" className={className}>
      {files.map(f => (
        <div key={f.filename}>
          <span data-testid={`file-${f.filename}`}>{f.filename}</span>
          {f.blocks.map((b, i) => (
            <div key={b.name}>
              <span data-testid={`block-${f.filename}-${i}-name`}>{b.name}</span>
              <button
                data-testid={`block-change-${f.filename}-${i}`}
                onClick={() => onBlockChange(f.filename, i, { kind: 'nominal', values: [] })}
              >
                change
              </button>
            </div>
          ))}
        </div>
      ))}
      <button
        data-testid="layout-change"
        onClick={() => onLayoutChange([{ filename: 'test.md', x: 100, y: 200 }])}
      >
        move
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVscodeApi() {
  return { postMessage: vi.fn() };
}

function makeInitMessage(
  files: CanvasSourceFile[],
  layout: FileContainerLayout[],
): MessageEvent {
  return new MessageEvent('message', {
    data: { type: 'carta:pd:init', files, layout },
  });
}

function makeFileChangedMessage(filename: string, blocks: CartaCodeBlock[]): MessageEvent {
  return new MessageEvent('message', {
    data: { type: 'carta:pd:file-changed', filename, blocks },
  });
}

const MOCK_FILES: CanvasSourceFile[] = [
  {
    filename: 'employee-types.md',
    blocks: [
      {
        name: 'Employment Type',
        type: 'enumeration',
        body: { kind: 'nominal', values: [{ key: 'full-time' }] },
        startOffset: 0,
        endOffset: 100,
      },
    ],
  },
];

const MOCK_LAYOUT: FileContainerLayout[] = [{ filename: 'employee-types.md', x: 0, y: 0 }];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductDesignEmbedded', () => {
  let vscodeApi: ReturnType<typeof makeVscodeApi>;

  beforeEach(() => {
    vscodeApi = makeVscodeApi();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).acquireVsCodeApi = () => vscodeApi;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).acquireVsCodeApi;
  });

  it('shows loading state before init message', () => {
    render(<ProductDesignEmbedded />);
    expect(screen.getByText('Loading design canvas…')).toBeDefined();
  });

  it('posts carta:pd:ready on mount', () => {
    render(<ProductDesignEmbedded />);
    expect(vscodeApi.postMessage).toHaveBeenCalledWith({ type: 'carta:pd:ready' });
  });

  it('renders canvas after init message', async () => {
    render(<ProductDesignEmbedded />);

    await act(async () => {
      window.dispatchEvent(makeInitMessage(MOCK_FILES, MOCK_LAYOUT));
    });

    expect(screen.getByTestId('product-design-canvas')).toBeDefined();
    expect(screen.getByTestId('file-employee-types.md')).toBeDefined();
  });

  it('updates file blocks on carta:pd:file-changed', async () => {
    render(<ProductDesignEmbedded />);

    await act(async () => {
      window.dispatchEvent(makeInitMessage(MOCK_FILES, MOCK_LAYOUT));
    });

    const updatedBlocks: CartaCodeBlock[] = [
      {
        name: 'Employment Type',
        type: 'enumeration',
        body: { kind: 'ordinal', values: [{ key: 'contractor' }] },
        startOffset: 0,
        endOffset: 120,
      },
    ];

    await act(async () => {
      window.dispatchEvent(makeFileChangedMessage('employee-types.md', updatedBlocks));
    });

    expect(screen.getByTestId('block-employee-types.md-0-name').textContent).toBe('Employment Type');
  });

  it('posts carta:pd:block-change when block changes', async () => {
    render(<ProductDesignEmbedded />);

    await act(async () => {
      window.dispatchEvent(makeInitMessage(MOCK_FILES, MOCK_LAYOUT));
    });

    const btn = screen.getByTestId('block-change-employee-types.md-0');
    await act(async () => {
      btn.click();
    });

    expect(vscodeApi.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'carta:pd:block-change',
        filename: 'employee-types.md',
        blockIndex: 0,
      })
    );
  });

  it('posts carta:pd:layout-change when layout changes', async () => {
    render(<ProductDesignEmbedded />);

    await act(async () => {
      window.dispatchEvent(makeInitMessage(MOCK_FILES, MOCK_LAYOUT));
    });

    const btn = screen.getByTestId('layout-change');
    await act(async () => {
      btn.click();
    });

    expect(vscodeApi.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'carta:pd:layout-change',
        layout: [{ filename: 'test.md', x: 100, y: 200 }],
      })
    );
  });
});
