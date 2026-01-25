import { useCallback, useState, useRef, useEffect } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import ImportPreviewModal from './components/ImportPreviewModal';
import ExportPreviewModal from './components/ExportPreviewModal';
import CompileModal from './components/CompileModal';
import Header from './components/Header';
import Map from './components/Map';
import Dock, { type DockView } from './components/Dock';
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
import type { ConstructValues } from './constructs/types';
import { AISidebar } from './ai';

// Note: Schema initialization is now handled by DocumentProvider

const MIN_DOCK_HEIGHT = 100;
const MAX_DOCK_HEIGHT_RATIO = 0.7;

function App() {
  const { adapter } = useDocumentContext();
  const {
    title,
    description,
    schemas,
    deployables,
    updateNode,
    setTitle,
    setDescription,
    setSchemas,
    setDeployables,
  } = useDocument();
  const [importPreview, setImportPreview] = useState<{ data: CartaFile; analysis: ImportAnalysis } | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportAnalysis | null>(null);
  const [compileOutput, setCompileOutput] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [dockHeight, setDockHeight] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [activeView, setActiveView] = useState<DockView>('viewer');
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiSidebarWidth] = useState(400);
  const nodesEdgesRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const containerRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<((nodes: Node[], edges: Edge[]) => void) | null>(null);
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

  const handleNodeDoubleClick = useCallback((_nodeId: string) => {
    // Switch to viewer tab (node is already selected by Map's onSelectionChange)
    setActiveView('viewer');
  }, []);

  const handleExport = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const analysis = analyzeExport(title, nodes, edges, deployables, schemas);
    setExportPreview(analysis);
  }, [title, deployables, schemas]);

  const handleExportConfirm = useCallback((options: ExportOptions) => {
    const { nodes, edges } = nodesEdgesRef.current;
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
    }, options);

    setExportPreview(null);
  }, [title, description, deployables, schemas]);

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

    const { data } = importPreview;

    // Clear existing document state before importing (like Excalidraw)
    // Use transaction for atomic update
    adapter.transaction(() => {
      adapter.setNodes([]);
      adapter.setEdges([]);
      adapter.setSchemas([]);
      adapter.setDeployables([]);
      adapter.setPortSchemas([]);
    });

    // Set title and description from imported file
    if (data.title) {
      setTitle(data.title);
    }
    if (data.description) {
      setDescription(data.description);
    }

    // Import selected schemas
    if (options.schemas.size > 0 && data.customSchemas.length > 0) {
      const schemasToImport = data.customSchemas.filter(s => options.schemas.has(s.type));
      if (schemasToImport.length > 0) {
        setSchemas(schemasToImport);
      }
    }

    // Import selected deployables
    if (options.deployables.size > 0 && data.deployables.length > 0) {
      const deployablesToImport = data.deployables.filter(d => options.deployables.has(d.id));
      if (deployablesToImport.length > 0) {
        setDeployables(deployablesToImport);
      }
    }

    // Import selected nodes and edges
    if (options.nodes.size > 0 && data.nodes.length > 0 && importRef.current) {
      const nodesToImport = data.nodes.filter(n => options.nodes.has(n.id));
      // Filter edges to only include those between imported nodes
      const importedNodeIds = new Set(nodesToImport.map(n => n.id));
      const edgesToImport = data.edges.filter(
        e => importedNodeIds.has(e.source) && importedNodeIds.has(e.target)
      );

      if (nodesToImport.length > 0) {
        importRef.current(nodesToImport, edgesToImport);
      }
    }

    // Close the modal
    setImportPreview(null);
  }, [importPreview, adapter, setTitle, setDescription, setSchemas, setDeployables]);

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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeight = containerRect.bottom - e.clientY;
    // Clamp between MIN_DOCK_HEIGHT and MAX_DOCK_HEIGHT_RATIO of container
    const maxHeight = containerRect.height * MAX_DOCK_HEIGHT_RATIO;
    setDockHeight(Math.max(MIN_DOCK_HEIGHT, Math.min(newHeight, maxHeight)));
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleResizeBarDoubleClick = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const maxHeight = containerRect.height * MAX_DOCK_HEIGHT_RATIO;
    // Toggle between minimum and maximum heights
    setDockHeight(dockHeight >= maxHeight - 10 ? MIN_DOCK_HEIGHT : maxHeight);
  }, [dockHeight]);

  // Attach mouse listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

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
              importRef={importRef}
            />
          </ReactFlowProvider>
        </div>
        {/* Resize handle */}
        <div
          className={`h-1 bg-gray-200 hover:bg-indigo-400 cursor-row-resize transition-colors ${isResizing ? 'bg-indigo-500' : ''}`}
          onMouseDown={handleResizeStart}
          onDoubleClick={handleResizeBarDoubleClick}
        />
        <Dock
          selectedNodes={selectedNodes}
          deployables={deployables}
          onDeployablesChange={refreshDeployables}
          onNodeUpdate={updateNode}
          height={dockHeight}
          activeView={activeView}
          onActiveViewChange={setActiveView}
        />
        <Footer />
      </div>
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
          portSchemas={adapter.getPortSchemas()}
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
