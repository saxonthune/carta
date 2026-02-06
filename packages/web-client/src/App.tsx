import { useCallback, useState, useRef, useEffect } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import ImportPreviewModal from './components/modals/ImportPreviewModal';
import ExportPreviewModal from './components/modals/ExportPreviewModal';
import CompileModal from './components/modals/CompileModal';
import DocumentBrowserModal from './components/modals/DocumentBrowserModal';
import Header from './components/Header';
import CanvasContainer from './components/canvas/CanvasContainer';
import { compiler } from '@carta/compiler';
import { builtInPortSchemas, hydrateBuiltIns, syncWithDocumentStore } from '@carta/domain';
import type { ConstructSchema } from '@carta/domain';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { useSchemas } from './hooks/useSchemas';
import { useSchemaGroups } from './hooks/useSchemaGroups';
import { useLevels } from './hooks/useLevels';
import { useNodes } from './hooks/useNodes';
import { useClearDocument } from './hooks/useClearDocument';
import { useDocumentContext } from './contexts/DocumentContext';
import { exportProject, importProject, type CartaFile } from './utils/cartaFile';
import { analyzeImport, type ImportAnalysis, type ImportOptions } from './utils/importAnalyzer';
import { analyzeExport, type ExportAnalysis, type ExportOptions } from './utils/exportAnalyzer';
import { importDocument, type ImportConfig } from './utils/documentImporter';
import { AISidebar } from './ai';
import { config } from './config/featureFlags';

// Note: Schema initialization is now handled by DocumentProvider

function App() {
  // In server mode without a ?doc= param, show document browser so user can pick/create.
  // In local mode, main.tsx always resolves a documentId before rendering, so skip this gate.
  if (config.hasServer) {
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

  const { title, description, setTitle, setDescription } = useDocumentMeta();
  const { schemas } = useSchemas();
  const { schemaGroups } = useSchemaGroups();
  const { levels, activeLevel, setActiveLevel, createLevel, deleteLevel, updateLevel, duplicateLevel } = useLevels();
  const { updateNode } = useNodes();
  const [importPreview, setImportPreview] = useState<{ data: CartaFile; analysis: ImportAnalysis } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ data: CartaFile; config: ImportConfig; schemasToImport: ConstructSchema[] } | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportAnalysis | null>(null);
  const [compileOutput, setCompileOutput] = useState<string | null>(null);
  const [_selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiSidebarWidth] = useState(400);
  const nodesEdgesRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
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

  const handleNodesEdgesChange = useCallback((nodes: Node[], edges: Edge[]) => {
    nodesEdgesRef.current = { nodes, edges };
  }, []);

  const handleSelectionChange = useCallback((nodes: Node[]) => {
    setSelectedNodes(nodes);
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    // Toggle to details view on double-click
    updateNode(nodeId, { viewLevel: 'details' });
  }, [updateNode]);

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
      levels,
      customSchemas: schemas,
      portSchemas,
      schemaGroups,
    }, options);

    setExportPreview(null);
  }, [title, description, levels, schemas, schemaGroups, adapter]);

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

  const handleRestoreDefaultSchemas = useCallback(() => {
    // Hydrate fresh UUIDs for groups, with resolved schema groupId refs
    const { groups, schemas } = hydrateBuiltIns();

    // Add missing defaults without removing existing user content
    adapter.transaction(() => {
      const existingSchemaTypes = new Set(adapter.getSchemas().map(s => s.type));
      for (const schema of schemas) {
        if (!existingSchemaTypes.has(schema.type)) {
          adapter.addSchema(schema);
        }
      }

      const existingPortIds = new Set(adapter.getPortSchemas().map(p => p.id));
      for (const ps of builtInPortSchemas) {
        if (!existingPortIds.has(ps.id)) {
          adapter.addPortSchema(ps);
        }
      }

      const existingGroupNames = new Set(adapter.getSchemaGroups().map(g => g.name));
      for (const group of groups) {
        if (!existingGroupNames.has(group.name)) {
          adapter.addSchemaGroup(group);
        }
      }
    });

    // Sync port registry with current port schemas
    syncWithDocumentStore(adapter.getPortSchemas());
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
      />
      <CanvasContainer
        title={title}
        onNodesEdgesChange={handleNodesEdgesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        levels={levels}
        activeLevel={activeLevel}
        onSetActiveLevel={setActiveLevel}
        onCreateLevel={createLevel}
        onDeleteLevel={deleteLevel}
        onUpdateLevel={updateLevel}
        onDuplicateLevel={duplicateLevel}
      />

      {/* Modals */}
      {importPreview && (
        <ImportPreviewModal
          analysis={importPreview.analysis}
          levels={levels}
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
