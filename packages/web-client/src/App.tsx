import { useCallback, useState, useRef, useEffect, lazy, Suspense } from 'react';
import type { CartaNode, CartaEdge } from '@carta/types';
import DocumentBrowserModal from './components/modals/DocumentBrowserModal';
import Header from './components/Header';
import CanvasContainer from './components/canvas/CanvasContainer';
import { compiler } from '@carta/compiler';
import { syncWithDocumentStore } from '@carta/domain';
import type { ConstructSchema } from '@carta/domain';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { useSchemas } from './hooks/useSchemas';
import { useSchemaGroups } from './hooks/useSchemaGroups';
import { usePages } from './hooks/usePages';
import { useClearDocument } from './hooks/useClearDocument';
import { useDocumentContext } from './contexts/DocumentContext';
import { exportProject, importProject, type CartaFile } from './utils/cartaFile';
import { analyzeImport, type ImportAnalysis, type ImportOptions } from './utils/importAnalyzer';
import { analyzeExport, type ExportAnalysis, type ExportOptions } from './utils/exportAnalyzer';
import { importDocument, type ImportConfig } from './utils/documentImporter';
import { config } from './config/featureFlags';

const ImportPreviewModal = lazy(() => import('./components/modals/ImportPreviewModal'));
const ExportPreviewModal = lazy(() => import('./components/modals/ExportPreviewModal'));
const CompileModal = lazy(() => import('./components/modals/CompileModal'));
const AISidebar = lazy(() => import('./ai/components/AISidebar').then(m => ({ default: m.AISidebar })));

// Note: Schema initialization is now handled by DocumentProvider

function App() {
  // In server mode without a ?doc= param, show document browser so user can pick/create.
  // In local mode, main.tsx always resolves a documentId before rendering, so skip this gate.
  if (config.hasSync) {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('doc')) {
      return (
        <div className="h-screen flex flex-col bg-surface">
          <DocumentBrowserModal required onClose={() => {}} />
        </div>
      );
    }
  }

  return <AppContent />;
}

function AppContent() {
  const { adapter } = useDocumentContext();

  useEffect(() => {
    performance.mark('carta:app-mounted')
    performance.measure('carta:boot-to-mount', 'carta:boot-start', 'carta:app-mounted')
    performance.measure('carta:total-startup', 'carta:module-eval', 'carta:app-mounted')
    if (import.meta.env.DEV) {
      const entries = performance.getEntriesByType('measure').filter(e => e.name.startsWith('carta:'))
      console.groupCollapsed('[carta] startup timing')
      for (const e of entries) {
        console.log(`${e.name}: ${e.duration.toFixed(1)}ms`)
      }
      console.groupEnd()
    }
  }, [])

  const { title, description, setTitle, setDescription } = useDocumentMeta();
  const { schemas } = useSchemas();
  const { schemaGroups } = useSchemaGroups();
  const { pages, activePage, setActivePage, createPage, deletePage, updatePage, duplicatePage } = usePages();
  const [importPreview, setImportPreview] = useState<{ data: CartaFile; analysis: ImportAnalysis } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ data: CartaFile; config: ImportConfig; schemasToImport: ConstructSchema[] } | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportAnalysis | null>(null);
  const [compileOutput, setCompileOutput] = useState<string | null>(null);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiSidebarWidth] = useState(400);
  const nodesEdgesRef = useRef<{ nodes: CartaNode[]; edges: CartaEdge[] }>({ nodes: [], edges: [] });
  const { clearDocument } = useClearDocument();

  // Initialize refs on mount
  useEffect(() => {
    nodesEdgesRef.current = {
      nodes: adapter.getNodes() as CartaNode[],
      edges: adapter.getEdges() as CartaEdge[],
    };
  }, [adapter]);

  // Sync port registry on mount and when portSchemas change
  useEffect(() => {
    // Initial sync
    syncWithDocumentStore(adapter.getPortSchemas());

    // Subscribe to adapter changes
    const unsubscribe = adapter.subscribe(() => {
      syncWithDocumentStore(adapter.getPortSchemas());
    });
    return unsubscribe;
  }, [adapter]);

  // Process pending import in useEffect to stay within React's lifecycle
  useEffect(() => {
    if (!pendingImport) return;

    const { data, config, schemasToImport } = pendingImport;

    // Clear the pending flag first
    setPendingImport(null);

    // Call pure function - no hooks, just adapter manipulation
    importDocument(adapter, data, config, schemasToImport);
  }, [pendingImport, adapter]);

  const handleSelectionChange = useCallback((_nodes: CartaNode[]) => {
    // Selection handling removed with InspectorPanel (V1-only)
  }, []);

  const handleExport = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const portSchemas = adapter.getPortSchemas();
    const analysis = analyzeExport(title, description, nodes, edges, schemas, portSchemas, schemaGroups);
    setExportPreview(analysis);
  }, [title, description, schemas, schemaGroups, adapter]);

  const handleExportConfirm = useCallback((options: ExportOptions) => {
    const portSchemas = adapter.getPortSchemas();

    exportProject({
      title,
      description,
      pages,
      customSchemas: schemas,
      portSchemas,
      schemaGroups,
      schemaPackages: adapter.getSchemaPackages(),
    }, options);

    setExportPreview(null);
  }, [title, description, pages, schemas, schemaGroups, adapter]);

  const handleExportCancel = useCallback(() => {
    setExportPreview(null);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    try {
      const data = await importProject(file);
      const analysis = analyzeImport(data, file.name, nodesEdgesRef.current.nodes, schemas);
      setImportPreview({ data, analysis });
    } catch (error) {
      alert(`Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [schemas]);

  const handleImportConfirm = useCallback((options: ImportOptions) => {
    if (!importPreview) return;

    const { data, analysis } = importPreview;

    // Get schemas that will be imported (needed for edge normalization)
    const schemasToImport = analysis.schemas.items
      .filter(s => options.schemas.has(s.item.type))
      .map(s => s.item);

    // Convert ImportOptions to ImportConfig
    const config: ImportConfig = {
      schemas: options.schemas,
      nodes: options.nodes,
      targetLevel: options.targetLevel,
    };

    // Set pending import flag and close modal
    // The actual import will happen in useEffect
    setPendingImport({ data, config, schemasToImport });
    setImportPreview(null);
  }, [importPreview]);

  const handleImportCancel = useCallback(() => {
    setImportPreview(null);
  }, []);

  const handleCompile = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    // Cast to any since React Flow Node[] has compatible shape to CompilerNode[] at runtime
    const output = compiler.compile(nodes as any, edges as any, { schemas });
    setCompileOutput(output);
  }, [schemas]);

  return (
    <div className="h-screen flex">
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          description={description}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onExport={handleExport}
          onImport={handleImport}
          onCompile={handleCompile}
          onClear={clearDocument}
          onToggleAI={() => setAiSidebarOpen(!aiSidebarOpen)}
        />
        <CanvasContainer
          onSelectionChange={handleSelectionChange}
          pages={pages}
          activePage={activePage}
          onSetActivePage={setActivePage}
          onCreatePage={createPage}
          onDeletePage={deletePage}
          onUpdatePage={updatePage}
          onDuplicatePage={duplicatePage}
        />
      </div>

      <Suspense fallback={null}>
        <AISidebar
          isOpen={aiSidebarOpen}
          onToggle={() => setAiSidebarOpen(!aiSidebarOpen)}
          width={aiSidebarWidth}
        />
      </Suspense>

      {/* Modals */}
      {importPreview && (
        <Suspense fallback={null}>
          <ImportPreviewModal
            analysis={importPreview.analysis}
            pages={pages}
            onConfirm={handleImportConfirm}
            onCancel={handleImportCancel}
          />
        </Suspense>
      )}
      {exportPreview && (
        <Suspense fallback={null}>
          <ExportPreviewModal
            analysis={exportPreview}
            edges={nodesEdgesRef.current.edges}
            onConfirm={handleExportConfirm}
            onCancel={handleExportCancel}
          />
        </Suspense>
      )}
      {compileOutput && (
        <Suspense fallback={null}>
          <CompileModal
            output={compileOutput}
            onClose={() => setCompileOutput(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
