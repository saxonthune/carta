import { useCallback, useState, useRef, useEffect } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import ImportPreviewModal from './components/ImportPreviewModal';
import ExportPreviewModal from './components/ExportPreviewModal';
import CompileModal from './components/CompileModal';
import Header from './components/Header';
import Map, { initialNodes, initialEdges, initialTitle, getNodeId } from './components/Map';
import Dock from './components/Dock';
import Footer from './components/Footer';
import { compiler } from './constructs/compiler';
import { registerBuiltInSchemas } from './constructs/schemas';
import { schemaStorage } from './constructs/storage';
import { registry } from './constructs/registry';
import { deployableRegistry } from './constructs/deployables';
import { exportProject, importProject, generateSemanticId, type CartaFile } from './utils/cartaFile';
import { analyzeImport, type ImportAnalysis, type ImportOptions } from './utils/importAnalyzer';
import { analyzeExport, type ExportAnalysis, type ExportOptions } from './utils/exportAnalyzer';
import type { ConstructValues, Deployable, ConstructNodeData } from './constructs/types';

registerBuiltInSchemas();
schemaStorage.loadFromLocalStorage();
deployableRegistry.loadFromLocalStorage();

function App() {
  const [deployables, setDeployables] = useState<Deployable[]>(() => deployableRegistry.getAll());
  const [importPreview, setImportPreview] = useState<{ data: CartaFile; analysis: ImportAnalysis } | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportAnalysis | null>(null);
  const [compileOutput, setCompileOutput] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(initialTitle);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [dockHeight, setDockHeight] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const nodesEdgesRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: initialNodes, edges: initialEdges });
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeUpdateRef = useRef<((nodeId: string, updates: Partial<ConstructNodeData>) => void) | null>(null);

  const refreshDeployables = useCallback(() => {
    setDeployables(deployableRegistry.getAll());
  }, []);

  const handleNodesEdgesChange = useCallback((nodes: Node[], edges: Edge[]) => {
    nodesEdgesRef.current = { nodes, edges };
  }, []);

  const handleSelectionChange = useCallback((nodes: Node[]) => {
    setSelectedNodes(nodes);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<ConstructNodeData>) => {
    if (nodeUpdateRef.current) {
      nodeUpdateRef.current(nodeId, updates);
    }
  }, []);

  const handleExport = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const userSchemas = registry.getUserSchemas();
    const analysis = analyzeExport(title, nodes, edges, deployableRegistry.getAll(), userSchemas);
    setExportPreview(analysis);
  }, [title]);

  const handleExportConfirm = useCallback((options: ExportOptions) => {
    const { nodes, edges } = nodesEdgesRef.current;
    // Ensure all nodes have semanticIds before export
    const nodesWithSemanticIds = nodes.map(node => {
      const nodeData = node.data as ConstructValues & { constructType?: string; name?: string; semanticId?: string };
      if (!nodeData.semanticId) {
        const semanticId = generateSemanticId(nodeData.constructType || 'unknown', nodeData.name || 'unnamed');
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
      customSchemas: registry.getUserSchemas(),
    }, options);

    setExportPreview(null);
  }, [title]);

  const handleExportCancel = useCallback(() => {
    setExportPreview(null);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    try {
      const data = await importProject(file);
      const analysis = analyzeImport(data, file.name);
      setImportPreview({ data, analysis });
    } catch (error) {
      alert(`Failed to import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const handleImportConfirm = useCallback((options: ImportOptions) => {
    if (!importPreview) return;

    const { data } = importPreview;

    // Import schemas if selected
    if (options.schemas && data.customSchemas.length > 0) {
      registry.replaceUserSchemas(data.customSchemas);
      schemaStorage.saveToLocalStorage();
    }

    // For now, nodes and deployables require full import (future: selective)
    // When enabled, these would import incrementally without page reload

    // Close the modal
    setImportPreview(null);
  }, [importPreview]);

  const handleImportCancel = useCallback(() => {
    setImportPreview(null);
  }, []);

  const handleCompile = useCallback(() => {
    const { nodes, edges } = nodesEdgesRef.current;
    const output = compiler.compile(nodes, edges);
    setCompileOutput(output);
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeight = containerRect.bottom - e.clientY;
    // Clamp between 100px and 70% of container
    const maxHeight = containerRect.height * 0.7;
    setDockHeight(Math.max(100, Math.min(newHeight, maxHeight)));
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

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
              nodeUpdateRef={nodeUpdateRef}
            />
          </ReactFlowProvider>
        </div>
        {/* Resize handle */}
        <div
          className={`h-1 bg-gray-200 hover:bg-indigo-400 cursor-row-resize transition-colors ${isResizing ? 'bg-indigo-500' : ''}`}
          onMouseDown={handleResizeStart}
        />
        <Dock
          selectedNodes={selectedNodes}
          deployables={deployables}
          onDeployablesChange={refreshDeployables}
          onNodeUpdate={handleNodeUpdate}
          height={dockHeight}
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
