/**
 * Dev-only: renders ProductDesignCanvas with hardcoded demo data.
 * Load via: http://localhost:5173?mode=pd-demo
 */
import { useState } from 'react';
import { ProductDesignCanvas } from './ProductDesignCanvas.js';
import type { CanvasSourceFile, FileContainerLayout } from './types.js';

const DEMO_FILES: CanvasSourceFile[] = [
  {
    filename: 'employee-types.md',
    blocks: [
      {
        name: 'Employment Type',
        type: 'enumeration',
        body: {
          kind: 'nominal',
          values: [
            { key: 'full-time' },
            { key: 'part-time' },
            { key: 'contractor', remark: 'External workers on fixed-term agreements' },
            { key: 'seasonal', remark: 'Hired for peak periods only' },
          ],
        },
        startOffset: 0,
        endOffset: 0,
      },
      {
        name: 'Department',
        type: 'enumeration',
        body: {
          kind: 'nominal',
          values: [
            { key: 'engineering' },
            { key: 'sales' },
            { key: 'marketing' },
            { key: 'operations' },
            { key: 'hr', remark: 'Human Resources' },
          ],
        },
        startOffset: 0,
        endOffset: 0,
      },
    ],
  },
  {
    filename: 'priorities.md',
    blocks: [
      {
        name: 'Priority',
        type: 'enumeration',
        body: {
          kind: 'ordinal',
          values: [
            { key: 'low', remark: 'Triaged but not urgent' },
            { key: 'medium' },
            { key: 'high', remark: 'Needs attention this sprint' },
            { key: 'critical', remark: 'Drop everything' },
          ],
        },
        startOffset: 0,
        endOffset: 0,
      },
    ],
  },
];

const INITIAL_LAYOUT: FileContainerLayout[] = [
  { filename: 'employee-types.md', x: 100, y: 100 },
  { filename: 'priorities.md', x: 600, y: 100 },
];

export function ProductDesignDemo(): React.ReactElement {
  const [files, setFiles] = useState(DEMO_FILES);
  const [layout, setLayout] = useState(INITIAL_LAYOUT);

  const handleBlockChange = (filename: string, blockIndex: number, newBody: Record<string, unknown>) => {
    setFiles(prev => prev.map(f => {
      if (f.filename !== filename) return f;
      const newBlocks = [...f.blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], body: newBody };
      return { ...f, blocks: newBlocks };
    }));
  };

  return (
    <ProductDesignCanvas
      files={files}
      layout={layout}
      onBlockChange={handleBlockChange}
      onLayoutChange={setLayout}
      className="h-screen w-full"
    />
  );
}
