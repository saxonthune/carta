import React, { useRef, useState } from 'react';
import { Canvas, useNodeDrag, useCanvasContext, type CanvasRef } from '../cactus/index.js';
import { FileContainer } from './FileContainer.js';
import { EnumerationEditor } from './EnumerationEditor.js';
import { asEnumeration } from './parser.js';
import type { CanvasSourceFile, FileContainerLayout } from './types.js';

export interface ProductDesignCanvasProps {
  /** Source files with their parsed code blocks */
  files: CanvasSourceFile[];
  /** Layout positions for file containers */
  layout: FileContainerLayout[];
  /** Called when a code block's data changes */
  onBlockChange: (filename: string, blockIndex: number, newBody: Record<string, unknown>) => void;
  /** Called when file container positions change (after drag) */
  onLayoutChange: (layout: FileContainerLayout[]) => void;
  /** CSS class for the outer container */
  className?: string;
}

function ProductDesignCanvasInner({
  files,
  layout,
  onBlockChange,
  onLayoutChange,
}: Omit<ProductDesignCanvasProps, 'className'>) {
  const { transform } = useCanvasContext();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const dragOriginRef = useRef<{ filename: string; x: number; y: number } | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const { onPointerDown: handleNodePointerDown } = useNodeDrag({
    zoomScale: transform.k,
    callbacks: {
      onDragStart: (nodeId) => {
        const pos = layoutRef.current.find(l => l.filename === nodeId);
        if (pos) dragOriginRef.current = { filename: nodeId, x: pos.x, y: pos.y };
      },
      onDrag: (nodeId, deltaX, deltaY) => {
        const origin = dragOriginRef.current;
        if (!origin || origin.filename !== nodeId) return;
        onLayoutChange(
          layoutRef.current.map(l =>
            l.filename === nodeId ? { ...l, x: origin.x + deltaX, y: origin.y + deltaY } : l
          )
        );
      },
      onDragEnd: () => { dragOriginRef.current = null; },
    },
  });

  return (
    <>
      {files.map(file => {
        const pos = layout.find(l => l.filename === file.filename) ?? { x: 0, y: 0 };
        return (
          <div
            key={file.filename}
            data-node-id={file.filename}
            style={{ position: 'absolute', left: pos.x, top: pos.y }}
            onPointerDown={(e) => {
              setSelectedFile(file.filename);
              handleNodePointerDown(file.filename, e);
            }}
          >
            <FileContainer
              filename={file.filename}
              selected={selectedFile === file.filename}
            >
              {file.blocks.map((block, blockIndex) => {
                if (block.type === 'enumeration') {
                  const data = asEnumeration(block);
                  return (
                    <EnumerationEditor
                      key={block.name}
                      name={block.name}
                      value={data}
                      onChange={(newData) => {
                        onBlockChange(file.filename, blockIndex, newData as unknown as Record<string, unknown>);
                      }}
                    />
                  );
                }
                // Unknown structure types render as a placeholder
                return (
                  <div key={block.name} className="px-3 py-2 text-sm text-content-muted">
                    {block.name} ({block.type})
                  </div>
                );
              })}
            </FileContainer>
          </div>
        );
      })}
    </>
  );
}

export function ProductDesignCanvas({
  files,
  layout,
  onBlockChange,
  onLayoutChange,
  className,
}: ProductDesignCanvasProps): React.ReactElement {
  const canvasRef = useRef<CanvasRef>(null);

  return (
    <div className={className ?? 'w-full h-full relative'}>
      <Canvas
        ref={canvasRef}
        viewportOptions={{ minZoom: 0.15, maxZoom: 2 }}
        className="w-full h-full"
        onBackgroundPointerDown={() => {}}
      >
        <ProductDesignCanvasInner
          files={files}
          layout={layout}
          onBlockChange={onBlockChange}
          onLayoutChange={onLayoutChange}
        />
      </Canvas>
    </div>
  );
}
