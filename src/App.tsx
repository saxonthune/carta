import { useCallback, useState, useRef, useEffect } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import ImportPreviewModal from './components/ImportPreviewModal';
import ExportPreviewModal from './components/ExportPreviewModal';
import CompileModal from './components/CompileModal';
import Header from './components/Header';
import Map, { initialNodes, initialEdges, initialTitle, getNodeId } from './components/Map';
import Dock, { type DockView } from './components/Dock';
import Footer from './components/Footer';
import { compiler } from './constructs/compiler';
import { seedDefaultSchemas, builtInSchemas } from './constructs/schemas';
import { schemaStorage } from './constructs/storage';
import { registry } from './constructs/registry';
import { deployableRegistry } from './constructs/deployables';
import { exportProject, importProject, generateSemanticId, type CartaFile } from './utils/cartaFile';
import { analyzeImport, type ImportAnalysis, type ImportOptions } from './utils/importAnalyzer';
import { analyzeExport, type ExportAnalysis, type ExportOptions } from './utils/exportAnalyzer';
import type { ConstructValues, Deployable, ConstructNodeData } from './constructs/types';

// Initialize schemas: load from localStorage, or seed defaults if this is first load
const hasStoredSchemas = schemaStorage.loadFromLocalStorage() > 0;
if (!hasStoredSchemas) {
  seedDefaultSchemas();
  schemaStorage.saveToLocalStorage();
}

deployableRegistry.loadFromLocalStorage();

const MIN_DOCK_HEIGHT = 100;
const MAX_DOCK_HEIGHT_RATIO = 0.7;

function App() {
  const [deployables, setDeployables] = useState<Deployable[]>(() => deployableRegistry.getAll());
  const [importPreview, setImportPreview] = useState<{ data: CartaFile; analysis: ImportAnalysis } | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportAnalysis | null>(null);
  const [compileOutput, setCompileOutput] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(initialTitle);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [dockHeight, setDockHeight] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [activeView, setActiveView] = useState<DockView>('viewer');
  const nodesEdgesRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: initialNodes, edges: initialEdges });
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeUpdateRef = useRef<((nodeId: string, updates: Partial<ConstructNodeData>) => void) | null>(null);
  const importRef = useRef<((nodes: Node[], edges: Edge[]) => void) | null>(null);

  const refreshDeployables = useCallback(() => {
    setDeployables(deployableRegistry.getAll());
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

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<ConstructNodeData>) => {
    if (nodeUpdateRef.current) {
      nodeUpdateRef.current(nodeId, updates);
    }
  }, []);

  const handleExport = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const allSchemas = registry.getAllSchemas();
    const analysis = analyzeExport(title, nodes, edges, deployableRegistry.getAll(), allSchemas);
    setExportPreview(analysis);
  }, [title]);

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
      nodeId: getNodeId(),
      nodes: nodesWithSemanticIds,
      edges,
      deployables: deployableRegistry.getAll(),
      customSchemas: registry.getAllSchemas(),
    }, options);

    setExportPreview(null);
  }, [title]);

  const handleExportCancel = useCallback(() => {
    setExportPreview(null);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    try {
      const data = await importProject(file);
      const analysis = analyzeImport(data, file.name, nodesEdgesRef.current.nodes, deployables);
      setImportPreview({ data, analysis });
    } catch (error) {
      alert(`Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [deployables]);

  const handleImportConfirm = useCallback((options: ImportOptions) => {
    if (!importPreview) return;

    const { data } = importPreview;

    // Import selected schemas
    if (options.schemas.size > 0 && data.customSchemas.length > 0) {
      const schemasToImport = data.customSchemas.filter(s => options.schemas.has(s.type));
      if (schemasToImport.length > 0) {
        registry.replaceSchemas(schemasToImport);
        schemaStorage.saveToLocalStorage();
      }
    }

    // Import selected deployables
    if (options.deployables.size > 0 && data.deployables.length > 0) {
      const deployablesToImport = data.deployables.filter(d => options.deployables.has(d.id));
      if (deployablesToImport.length > 0) {
        deployableRegistry.importDeployables(deployablesToImport);
        refreshDeployables();
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
  }, [importPreview, refreshDeployables]);

  const handleImportCancel = useCallback(() => {
    setImportPreview(null);
  }, []);

  const handleCompile = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const output = compiler.compile(nodes, edges);
    setCompileOutput(output);
  }, []);

  const handleClear = useCallback((mode: 'instances' | 'all') => {
    if (mode === 'instances') {
      // Clear only nodes and edges from localStorage, preserve schemas and deployables
      const saved = localStorage.getItem('react-flow-state');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          // Clear nodes and edges but keep nodeId and title
          localStorage.setItem('react-flow-state', JSON.stringify({
            nodes: [],
            edges: [],
            nodeId: state.nodeId || 1,
            title: state.title || 'Untitled Project'
          }));
        } catch (e) {
          console.error('Failed to clear instances:', e);
        }
      }
      // Reload to reflect changes
      window.location.reload();
    } else {
      // Clear everything: nodes, edges, all schemas, and deployables
      localStorage.removeItem('react-flow-state');
      localStorage.removeItem('carta-schemas');
      localStorage.removeItem('carta-deployables');
      // Reload to reflect changes
      window.location.reload();
    }
  }, []);

  const handleRestoreDefaultSchemas = useCallback(() => {
    // Clear registry and import fresh defaults
    registry.clearAllSchemas();
    registry.replaceSchemas(builtInSchemas);
    schemaStorage.saveToLocalStorage();
    
    // Notify user and reload to reflect changes
    alert('Default schemas restored successfully!');
    window.location.reload();
  }, []);

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
        onTitleChange={setTitle}
        onExport={handleExport}
        onImport={handleImport}
        onCompile={handleCompile}
        onClear={handleClear}
        onRestoreDefaultSchemas={handleRestoreDefaultSchemas}
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
              nodeUpdateRef={nodeUpdateRef}
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
          onNodeUpdate={handleNodeUpdate}
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
    </div>
  );
}

export default App;
