import { useState, useEffect, useRef } from 'react';
import type { DocumentAdapter } from '@carta/schema';
import { useDocumentContext } from '../contexts/DocumentContext';
import { importProjectFromString } from '../utils/cartaFile';
import { importDocument } from '../utils/documentImporter';
import type { ImportConfig } from '../utils/documentImporter';
import type { CartaFile } from '../utils/cartaFile';

interface ExampleLoaderResult {
  showConfirmModal: boolean;
  exampleTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function stripExampleParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('example');
  history.replaceState(null, '', url.toString());
}

function doImport(adapter: DocumentAdapter, data: CartaFile): void {
  const config: ImportConfig = {
    schemas: new Set(data.customSchemas.map(s => s.type)),
    nodes: new Set(data.pages.flatMap(p => p.nodes as Array<{ id: string }>).map(n => n.id)),
    targetLevel: 'replace',
  };
  const schemasToImport = data.customSchemas;
  importDocument(adapter, data, config, schemasToImport);
}

export function useExampleLoader(): ExampleLoaderResult {
  const { adapter } = useDocumentContext();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [exampleTitle, setExampleTitle] = useState('');
  const pendingDataRef = useRef<CartaFile | null>(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const name = params.get('example');
    if (!name) return;

    async function loadExample() {
      try {
        const response = await fetch(`/examples/${name}.carta.json`);
        if (!response.ok) {
          console.warn('Failed to load example:', name, response.status);
          stripExampleParam();
          return;
        }
        const text = await response.text();
        const data = importProjectFromString(text);

        const isBlank = adapter.getPages().every(p => p.nodes.length === 0);
        if (isBlank) {
          doImport(adapter, data);
          stripExampleParam();
        } else {
          pendingDataRef.current = data;
          setExampleTitle(data.title);
          setShowConfirmModal(true);
        }
      } catch (error) {
        console.warn('Failed to load example:', name, error);
        stripExampleParam();
      }
    }

    loadExample();
  }, [adapter]);

  function onConfirm() {
    if (pendingDataRef.current) {
      doImport(adapter, pendingDataRef.current);
      pendingDataRef.current = null;
    }
    stripExampleParam();
    setShowConfirmModal(false);
  }

  function onCancel() {
    pendingDataRef.current = null;
    stripExampleParam();
    setShowConfirmModal(false);
  }

  return { showConfirmModal, exampleTitle, onConfirm, onCancel };
}
