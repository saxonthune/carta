import { useCallback, useState, useRef, useEffect, lazy, Suspense } from 'react';
import type { CartaNode, CartaEdge } from '@carta/types';
import DocumentBrowserModal from './components/modals/DocumentBrowserModal';
import Header from './components/Header';
import CanvasContainer from './components/canvas/CanvasContainer';
import Navigator from './components/Navigator';
import WorkspaceNavigator from './components/WorkspaceNavigator';
import Footer from './components/Footer';
import { useWorkspaceMode } from './hooks/useWorkspaceMode';
import type { WorkspaceTree } from './hooks/useWorkspaceMode';
import { List } from '@phosphor-icons/react';
import { compiler } from '@carta/document';
import { syncWithDocumentStore } from '@carta/schema';
import type { ConstructSchema, Resource } from '@carta/schema';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { useSchemas } from './hooks/useSchemas';
import { useSchemaGroups } from './hooks/useSchemaGroups';
import { usePages } from './hooks/usePages';
import { useResources } from './hooks/useResources';
import { useSpecGroups } from './hooks/useSpecGroups';
import { useClearDocument } from './hooks/useClearDocument';
import { useExampleLoader } from './hooks/useExampleLoader';
import { useDocumentContext } from './contexts/DocumentContext';
import { exportProject, importProject, type CartaFile } from './utils/cartaFile';
import { analyzeImport, type ImportAnalysis, type ImportOptions } from './utils/importAnalyzer';
import { analyzeExport, type ExportAnalysis, type ExportOptions } from './utils/exportAnalyzer';
import { importDocument, type ImportConfig } from './utils/documentImporter';
import { config } from './config/featureFlags';

type ActiveView =
  | { type: 'page'; pageId: string }
  | { type: 'metamap' }
  | { type: 'resource'; resourceId: string };

const ImportPreviewModal = lazy(() => import('./components/modals/ImportPreviewModal'));
const ExportPreviewModal = lazy(() => import('./components/modals/ExportPreviewModal'));
const CompileModal = lazy(() => import('./components/modals/CompileModal'));
const ExampleConfirmModal = lazy(() => import('./components/modals/ExampleConfirmModal'));
const AISidebar = lazy(() => import('./ai/components/AISidebar').then(m => ({ default: m.AISidebar })));

// Note: Schema initialization is now handled by DocumentProvider

function App() {
  const { isWorkspace, loading: workspaceLoading, workspaceTree } = useWorkspaceMode();

  // Wait briefly while we detect whether the server is a workspace server
  if (workspaceLoading) {
    return null;
  }

  // Workspace mode: render the workspace layout (no DocumentContext needed)
  if (isWorkspace && workspaceTree) {
    return <WorkspaceAppLayout tree={workspaceTree} />;
  }

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

interface WorkspaceAppLayoutProps {
  tree: WorkspaceTree;
}

function WorkspaceAppLayout({ tree }: WorkspaceAppLayoutProps) {
  const [navigatorOpen, setNavigatorOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col">
      {/* Minimal workspace header */}
      <div className="h-10 bg-surface-alt border-b border-border flex items-center px-3 gap-3 shrink-0">
        <button
          className="w-7 h-7 flex items-center justify-center rounded text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
          onClick={() => setNavigatorOpen(!navigatorOpen)}
          title="Toggle navigator"
        >
          <List weight="bold" size={16} />
        </button>
        <span className="text-sm font-medium text-content truncate">
          {tree.manifest.title}
        </span>
      </div>
      <div className="flex-1 flex min-h-0">
        <WorkspaceNavigator
          isOpen={navigatorOpen}
          tree={tree}
          selectedCanvas={null}
          onSelectCanvas={() => {
            // No-op until workspace-09 wires DocumentAdapter per-canvas
          }}
        />
        <div className="flex-1 flex items-center justify-center text-content-muted">
          <p className="text-sm">Select a canvas to start editing (coming soon)</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function AppContent() {
  const { adapter } = useDocumentContext();

  useEffect(() => {
    performance.mark('carta:app-mounted')
    performance.measure('carta:boot-to-mount', 'carta:boot-start', 'carta:app-mounted')
    performance.measure('carta:total-startup', 'carta:module-eval', 'carta:app-mounted')
    if (import.meta.env.DEV) {
      // Defer slightly to catch canvas-mounted mark which fires in a child useEffect
      requestAnimationFrame(() => {
        const measures = performance.getEntriesByType('measure')
          .filter(e => e.name.startsWith('carta:'))
          .sort((a, b) => a.startTime - b.startTime)
        console.groupCollapsed('[carta] startup waterfall')
        console.table(measures.map(m => ({
          phase: m.name.replace('carta:', ''),
          start: `${m.startTime.toFixed(0)}ms`,
          duration: `${m.duration.toFixed(1)}ms`,
        })))
        console.groupEnd()
      })
    }
  }, [])

  const { title, description, setTitle, setDescription } = useDocumentMeta();
  const { schemas } = useSchemas();
  const { schemaGroups } = useSchemaGroups();
  const { pages, activePage, setActivePage, createPage, deletePage, updatePage, duplicatePage } = usePages();
  const { resources } = useResources();
  const { specGroups, createSpecGroup, updateSpecGroup, deleteSpecGroup, assignToSpecGroup, removeFromSpecGroup } = useSpecGroups();
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>(() => ({
    type: 'page',
    pageId: activePage || pages[0]?.id || '',
  }));
  const [importPreview, setImportPreview] = useState<{ data: CartaFile; analysis: ImportAnalysis } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ data: CartaFile; config: ImportConfig; schemasToImport: ConstructSchema[] } | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportAnalysis | null>(null);
  const [compileOutput, setCompileOutput] = useState<string | null>(null);
  // Keep activeView in sync when activePage changes externally
  useEffect(() => {
    if (activePage && activeView.type === 'page') {
      setActiveView({ type: 'page', pageId: activePage });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiSidebarWidth] = useState(400);
  const nodesEdgesRef = useRef<{ nodes: CartaNode[]; edges: CartaEdge[] }>({ nodes: [], edges: [] });
  const { clearDocument } = useClearDocument();
  const { showConfirmModal: showExampleConfirm, exampleTitle, onConfirm: onExampleConfirm, onCancel: onExampleCancel } = useExampleLoader();

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

  const handleCreateResource = useCallback(() => {
    const created = adapter.createResource('New Resource', 'freeform', '');
    setActiveView({ type: 'resource', resourceId: created.id });
  }, [adapter]);

  const handleExport = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const portSchemas = adapter.getPortSchemas();
    const analysis = analyzeExport(title, description, nodes, edges, schemas, portSchemas, schemaGroups);
    setExportPreview(analysis);
  }, [title, description, schemas, schemaGroups, adapter]);

  const handleExportConfirm = useCallback((options: ExportOptions) => {
    const portSchemas = adapter.getPortSchemas();
    const resourceSummaries = adapter.getResources();
    const resources: Resource[] = [];
    for (const summary of resourceSummaries) {
      const full = adapter.getResource(summary.id);
      if (full) resources.push(full);
    }

    exportProject({
      title,
      description,
      pages,
      customSchemas: schemas,
      portSchemas,
      schemaGroups,
      schemaPackages: adapter.getSchemaPackages(),
      resources,
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
    <div className="h-screen flex flex-col">
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
        onToggleNavigator={() => setNavigatorOpen(!navigatorOpen)}
      />
      <div className="flex-1 flex min-h-0">
        <Navigator
          isOpen={navigatorOpen}
          pages={pages}
          onSetActivePage={(pageId) => { setActivePage(pageId); setActiveView({ type: 'page', pageId }); }}
          onCreatePage={createPage}
          onDeletePage={deletePage}
          onUpdatePage={updatePage}
          onDuplicatePage={duplicatePage}
          resources={resources}
          onSelectResource={(resourceId) => setActiveView({ type: 'resource', resourceId })}
          onCreateResource={handleCreateResource}
          activeView={activeView}
          onSelectMetamap={() => setActiveView({ type: 'metamap' })}
          specGroups={specGroups}
          onCreateSpecGroup={(name) => { createSpecGroup(name); }}
          onUpdateSpecGroup={updateSpecGroup}
          onDeleteSpecGroup={deleteSpecGroup}
          onAssignToSpecGroup={assignToSpecGroup}
          onRemoveFromSpecGroup={removeFromSpecGroup}
        />
        <CanvasContainer
          onSelectionChange={handleSelectionChange}
          activeView={activeView}
        />
        <Suspense fallback={null}>
          <AISidebar
            isOpen={aiSidebarOpen}
            onToggle={() => setAiSidebarOpen(!aiSidebarOpen)}
            width={aiSidebarWidth}
          />
        </Suspense>
      </div>
      <Footer />

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
      {showExampleConfirm && (
        <Suspense fallback={null}>
          <ExampleConfirmModal
            isOpen={showExampleConfirm}
            exampleTitle={exampleTitle}
            onConfirm={onExampleConfirm}
            onCancel={onExampleCancel}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
