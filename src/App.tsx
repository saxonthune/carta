import { useCallback, useState, useRef, useEffect } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import ImportPreviewModal from './components/ImportPreviewModal';
import ExportPreviewModal from './components/ExportPreviewModal';
import CompileModal from './components/CompileModal';
import DocumentBrowserModal from './components/DocumentBrowserModal';
import Header from './components/Header';
import Map from './components/Map';
import Drawer from './components/Drawer';
import { type DrawerTab } from './components/DrawerTabs';
import Footer from './components/Footer';
import { compiler } from './constructs/compiler';
import { builtInConstructSchemas, builtInPortSchemas, builtInSchemaGroups } from './constructs/schemas';
import { syncWithDocumentStore } from './constructs/portRegistry';
import { useDocument } from './hooks/useDocument';
import { useClearDocument } from './hooks/useClearDocument';
import { useDocumentContext } from './contexts/DocumentContext';
import { exportProject, importProject, importProjectFromString, generateSemanticId, type CartaFile } from './utils/cartaFile';
import type { Example } from './utils/examples';
import { analyzeImport, type ImportAnalysis, type ImportOptions } from './utils/importAnalyzer';
import { analyzeExport, type ExportAnalysis, type ExportOptions } from './utils/exportAnalyzer';
import { importDocument, type ImportConfig } from './utils/documentImporter';
import type { ConstructValues, ConstructSchema } from './constructs/types';
import { AISidebar } from './ai';

// Note: Schema initialization is now handled by DocumentProvider

function App() {
  const { adapter, needsDocumentSelection } = useDocumentContext();

  // In server mode without a ?doc= param, show forced document selection
  if (needsDocumentSelection) {
    return (
      <div className="h-screen flex flex-col bg-surface">
        <DocumentBrowserModal required onClose={() => {}} />
      </div>
    );
  }

  const {
    title,
    description,
    schemas,
    deployables,
    schemaGroups,
    updateNode,
    setTitle,
    setDescription,
  } = useDocument();
  const [importPreview, setImportPreview] = useState<{ data: CartaFile; analysis: ImportAnalysis } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ data: CartaFile; config: ImportConfig; schemasToImport: ConstructSchema[] } | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportAnalysis | null>(null);
  const [compileOutput, setCompileOutput] = useState<string | null>(null);
  const [_selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('constructs');
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiSidebarWidth] = useState(400);
  const nodesEdgesRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const containerRef = useRef<HTMLDivElement>(null);
  const { clearDocument } = useClearDocument();

  // Initialize refs on mount
  useEffect(() => {
    nodesEdgesRef.current = {
      nodes: adapter.getNodes() as Node[],
      edges: adapter.getEdges() as Edge[],
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

  // No-op for compatibility with existing props
  const refreshDeployables = useCallback(() => {
    // Deployables now update automatically via useDocument
  }, []);

  const handleNodesEdgesChange = useCallback((nodes: Node[], edges: Edge[]) => {
    nodesEdgesRef.current = { nodes, edges };
  }, []);

  const handleSelectionChange = useCallback((nodes: Node[]) => {
    setSelectedNodes(nodes);
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    // Toggle expand on the node instead of opening dock
    updateNode(nodeId, { isExpanded: true });
  }, [updateNode]);

  const handleExport = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const portSchemas = adapter.getPortSchemas();
    const analysis = analyzeExport(title, description, nodes, edges, deployables, schemas, portSchemas, schemaGroups);
    setExportPreview(analysis);
  }, [title, description, deployables, schemas, schemaGroups, adapter]);

  const handleExportConfirm = useCallback((options: ExportOptions) => {
    const { nodes, edges } = nodesEdgesRef.current;
    const portSchemas = adapter.getPortSchemas();
    // Ensure all nodes have semanticIds before export
    const nodesWithSemanticIds = nodes.map(node => {
      const nodeData = node.data as ConstructValues & { constructType?: string; semanticId?: string };
      if (!nodeData.semanticId) {
        const semanticId = generateSemanticId(nodeData.constructType || 'unknown');
        return {
          ...node,
          data: {
            ...nodeData,
            semanticId,
          },
        };
      }
      return node;
    });

    exportProject({
      title,
      description,
      nodes: nodesWithSemanticIds,
      edges,
      deployables,
      customSchemas: schemas,
      portSchemas,
      schemaGroups,
    }, options);

    setExportPreview(null);
  }, [title, description, deployables, schemas, schemaGroups, adapter]);

  const handleExportCancel = useCallback(() => {
    setExportPreview(null);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    try {
      const data = await importProject(file);
      const analysis = analyzeImport(data, file.name, nodesEdgesRef.current.nodes, deployables, schemas);
      setImportPreview({ data, analysis });
    } catch (error) {
      alert(`Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [deployables, schemas]);

  const handleLoadExample = useCallback((example: Example) => {
    try {
      const data = importProjectFromString(example.content);
      const analysis = analyzeImport(data, example.filename, nodesEdgesRef.current.nodes, deployables, schemas);
      setImportPreview({ data, analysis });
    } catch (error) {
      alert(`Failed to load example: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [deployables, schemas]);

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
      deployables: options.deployables,
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
    const output = compiler.compile(nodes, edges, { schemas, deployables });
    setCompileOutput(output);
  }, [schemas, deployables]);

  const handleRestoreDefaultSchemas = useCallback(() => {
    // Restore all defaults in a single transaction
    adapter.transaction(() => {
      // Clear and restore construct schemas
      adapter.setSchemas(builtInConstructSchemas);

      // Restore port schemas
      adapter.setPortSchemas(builtInPortSchemas);

      // Restore schema groups
      adapter.setSchemaGroups(builtInSchemaGroups);
    });

    // Sync port registry with new port schemas
    syncWithDocumentStore(builtInPortSchemas);
    // Changes propagate automatically via Yjs subscription - no reload needed
  }, [adapter]);

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
        onRestoreDefaultSchemas={handleRestoreDefaultSchemas}
        onToggleAI={() => setAiSidebarOpen(!aiSidebarOpen)}
        onLoadExample={handleLoadExample}
      />
      <div ref={containerRef} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <ReactFlowProvider>
            <Map
              deployables={deployables}
              onDeployablesChange={refreshDeployables}
              title={title}
              onNodesEdgesChange={handleNodesEdgesChange}
              onSelectionChange={handleSelectionChange}
              onNodeDoubleClick={handleNodeDoubleClick}
            />
          </ReactFlowProvider>
        </div>
        <Footer />
      </div>

      {/* Drawer system */}
      <Drawer
        isOpen={drawerOpen}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
        activeTab={drawerTab}
        onActiveTabChange={setDrawerTab}
        onDeployablesChange={refreshDeployables}
      />

      {/* Modals */}
      {importPreview && (
        <ImportPreviewModal
          analysis={importPreview.analysis}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
        />
      )}
      {exportPreview && (
        <ExportPreviewModal
          analysis={exportPreview}
          edges={nodesEdgesRef.current.edges}
          onConfirm={handleExportConfirm}
          onCancel={handleExportCancel}
        />
      )}
      {compileOutput && (
        <CompileModal
          output={compileOutput}
          onClose={() => setCompileOutput(null)}
        />
      )}
      <AISidebar
        isOpen={aiSidebarOpen}
        onToggle={() => setAiSidebarOpen(!aiSidebarOpen)}
        width={aiSidebarWidth}
      />
    </div>
  );
}

export default App;
