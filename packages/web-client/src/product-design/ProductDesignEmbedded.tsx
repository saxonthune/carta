import React, { useState, useEffect, useRef } from 'react';
import { ProductDesignCanvas } from './ProductDesignCanvas.js';
import type { CanvasSourceFile, FileContainerLayout, CartaCodeBlock } from './types.js';

interface InitMessage {
  type: 'carta:pd:init';
  files: CanvasSourceFile[];
  layout: FileContainerLayout[];
}

interface FileChangedMessage {
  type: 'carta:pd:file-changed';
  filename: string;
  blocks: CartaCodeBlock[];
}

type ExtMessage = InitMessage | FileChangedMessage;

export function ProductDesignEmbedded(): React.ReactElement {
  const [files, setFiles] = useState<CanvasSourceFile[]>([]);
  const [layout, setLayout] = useState<FileContainerLayout[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vscodeApiRef = useRef<any>(null);

  useEffect(() => {
    // acquireVsCodeApi() can only be called once per WebView lifecycle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vscodeApi = (window as any).acquireVsCodeApi?.();
    if (!vscodeApi) return;
    vscodeApiRef.current = vscodeApi;

    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtMessage;
      if (msg.type === 'carta:pd:init') {
        setFiles(msg.files);
        setLayout(msg.layout);
      } else if (msg.type === 'carta:pd:file-changed') {
        setFiles(prev => prev.map(f =>
          f.filename === msg.filename ? { ...f, blocks: msg.blocks } : f
        ));
      }
    };

    window.addEventListener('message', handler);
    // Signal ready to extension so it sends the init payload
    vscodeApi.postMessage({ type: 'carta:pd:ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleBlockChange = (filename: string, blockIndex: number, newBody: Record<string, unknown>) => {
    vscodeApiRef.current?.postMessage({
      type: 'carta:pd:block-change',
      filename,
      blockIndex,
      newBody,
    });
  };

  const handleLayoutChange = (newLayout: FileContainerLayout[]) => {
    setLayout(newLayout);
    vscodeApiRef.current?.postMessage({
      type: 'carta:pd:layout-change',
      layout: newLayout,
    });
  };

  if (files.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface text-content-muted text-sm">
        Loading design canvas…
      </div>
    );
  }

  return (
    <ProductDesignCanvas
      files={files}
      layout={layout}
      onBlockChange={handleBlockChange}
      onLayoutChange={handleLayoutChange}
      className="h-screen w-full"
    />
  );
}
