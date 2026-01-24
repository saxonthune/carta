import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { ConstructNodeData, ConstructSchema, Deployable, PortSchema } from '../constructs/types';
import { DEFAULT_PORT_SCHEMAS } from '../constructs/portRegistry';

// Storage keys
const NEW_STORAGE_KEY = 'carta-document';
const OLD_GRAPH_KEY = 'react-flow-state';
const OLD_SCHEMAS_KEY = 'carta-schemas';
const OLD_DEPLOYABLES_KEY = 'carta-deployables';
const DEBOUNCE_DELAY = 500;

interface DocumentState {
  // Graph data
  nodes: Node[];
  edges: Edge[];

  // Metadata
  title: string;

  // M1: Schemas (was in registry singleton)
  schemas: ConstructSchema[];

  // M1: Port Schemas (port type registry)
  portSchemas: PortSchema[];

  // Deployables (was in deployableRegistry singleton)
  deployables: Deployable[];

  // Actions - Graph
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setTitle: (title: string) => void;
  getNextNodeId: () => string;
  updateNode: (nodeId: string, updates: Partial<ConstructNodeData>) => void;

  // Actions - Schemas
  getSchema: (type: string) => ConstructSchema | undefined;
  setSchemas: (schemas: ConstructSchema[]) => void;
  addSchema: (schema: ConstructSchema) => void;
  updateSchema: (type: string, updates: Partial<ConstructSchema>) => void;
  removeSchema: (type: string) => boolean;

  // Actions - Port Schemas
  getPortSchema: (id: string) => PortSchema | undefined;
  getPortSchemas: () => PortSchema[];
  setPortSchemas: (schemas: PortSchema[]) => void;
  addPortSchema: (schema: PortSchema) => void;
  updatePortSchema: (id: string, updates: Partial<PortSchema>) => void;
  removePortSchema: (id: string) => boolean;

  // Actions - Deployables
  getDeployable: (id: string) => Deployable | undefined;
  setDeployables: (deployables: Deployable[]) => void;
  addDeployable: (deployable: Omit<Deployable, 'id'>) => Deployable;
  updateDeployable: (id: string, updates: Partial<Deployable>) => void;
  removeDeployable: (id: string) => boolean;

  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;

  // For import
  importNodes: (nodes: Node[], edges: Edge[]) => void;
}

/**
 * Generate a deployable ID
 */
function generateDeployableId(): string {
  return 'dep_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a color for deployable visualization
 */
function generateDeployableColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6b7280', // gray
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Load initial state from localStorage with migration support
 * Handles migration from old storage keys to unified format
 */
function loadInitialState(): {
  nodes: Node[];
  edges: Edge[];
  title: string;
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
  deployables: Deployable[];
} {
  try {
    // Check for new unified storage first
    const newSaved = localStorage.getItem(NEW_STORAGE_KEY);
    if (newSaved) {
      const parsed = JSON.parse(newSaved);
      return {
        nodes: parsed.nodes || [],
        edges: parsed.edges || [],
        title: parsed.title || 'Untitled Project',
        schemas: parsed.schemas || [],
        portSchemas: parsed.portSchemas || DEFAULT_PORT_SCHEMAS,
        deployables: parsed.deployables || [],
      };
    }

    // Migration: Check for old storage keys
    const oldGraphData = localStorage.getItem(OLD_GRAPH_KEY);
    const oldSchemasData = localStorage.getItem(OLD_SCHEMAS_KEY);
    const oldDeployablesData = localStorage.getItem(OLD_DEPLOYABLES_KEY);

    if (oldGraphData || oldSchemasData || oldDeployablesData) {
      console.log('Migrating from old storage format to unified document store...');

      // Parse old data
      let nodes: Node[] = [];
      let edges: Edge[] = [];
      let title = 'Untitled Project';
      let schemas: ConstructSchema[] = [];
      let portSchemas = DEFAULT_PORT_SCHEMAS;
      let deployables: Deployable[] = [];

      if (oldGraphData) {
        const parsed = JSON.parse(oldGraphData);
        nodes = parsed.nodes || [];
        edges = parsed.edges || [];
        title = parsed.title || 'Untitled Project';
      }

      if (oldSchemasData) {
        schemas = JSON.parse(oldSchemasData) || [];
      }

      if (oldDeployablesData) {
        deployables = JSON.parse(oldDeployablesData) || [];
      }

      // Save to new unified key
      localStorage.setItem(
        NEW_STORAGE_KEY,
        JSON.stringify({ nodes, edges, title, schemas, portSchemas, deployables })
      );

      // Remove old keys
      localStorage.removeItem(OLD_GRAPH_KEY);
      localStorage.removeItem(OLD_SCHEMAS_KEY);
      localStorage.removeItem(OLD_DEPLOYABLES_KEY);

      console.log('Migration complete. Old storage keys removed.');

      return { nodes, edges, title, schemas, portSchemas, deployables };
    }
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
  }

  // No existing data - return empty state (schemas will be seeded by App.tsx)
  return {
    nodes: [],
    edges: [],
    title: 'Untitled Project',
    schemas: [],
    portSchemas: DEFAULT_PORT_SCHEMAS,
    deployables: [],
  };
}

const initialState = loadInitialState();

export const useDocumentStore = create<DocumentState>((set, get) => ({
  // Initial state
  nodes: initialState.nodes,
  edges: initialState.edges,
  title: initialState.title,
  schemas: initialState.schemas,
  portSchemas: initialState.portSchemas,
  deployables: initialState.deployables,

  // Actions - Graph
  setNodes: (nodesOrUpdater) => {
    set((state) => ({
      nodes:
        typeof nodesOrUpdater === 'function'
          ? nodesOrUpdater(state.nodes)
          : nodesOrUpdater,
    }));
  },

  setEdges: (edgesOrUpdater) => {
    set((state) => ({
      edges:
        typeof edgesOrUpdater === 'function'
          ? edgesOrUpdater(state.edges)
          : edgesOrUpdater,
    }));
  },

  setTitle: (title) => {
    set({ title });
  },

  getNextNodeId: () => crypto.randomUUID(),

  updateNode: (nodeId, updates) => {
    set((state) => {
      // If semantic ID is changing, we need to update all connections that reference it
      const oldSemanticId = updates.semanticId
        ? (state.nodes.find((n) => n.id === nodeId)?.data as ConstructNodeData | undefined)?.semanticId
        : undefined;

      const newNodes = state.nodes.map((node) => {
        if (node.id === nodeId) {
          // Update the target node
          return { ...node, data: { ...node.data, ...updates } };
        } else if (oldSemanticId && updates.semanticId && node.type === 'construct') {
          // Update connections in other nodes that reference the old semantic ID
          const data = node.data as ConstructNodeData;
          if (data.connections && data.connections.length > 0) {
            const updatedConnections = data.connections.map((conn) =>
              conn.targetSemanticId === oldSemanticId
                ? { ...conn, targetSemanticId: updates.semanticId! }
                : conn
            );
            // Only update if something changed
            if (updatedConnections.some((c, i) => c !== data.connections![i])) {
              return { ...node, data: { ...data, connections: updatedConnections } };
            }
          }
        }
        return node;
      });

      return { nodes: newNodes };
    });
  },

  // Actions - Schemas
  getSchema: (type) => {
    return get().schemas.find((s) => s.type === type);
  },

  setSchemas: (schemas) => {
    set({ schemas });
  },

  addSchema: (schema) => {
    set((state) => ({
      schemas: [...state.schemas.filter((s) => s.type !== schema.type), schema],
    }));
  },

  updateSchema: (type, updates) => {
    set((state) => ({
      schemas: state.schemas.map((s) =>
        s.type === type ? { ...s, ...updates } : s
      ),
    }));
  },

  removeSchema: (type) => {
    const exists = get().schemas.some((s) => s.type === type);
    if (exists) {
      set((state) => ({
        schemas: state.schemas.filter((s) => s.type !== type),
      }));
    }
    return exists;
  },

  // Actions - Port Schemas
  getPortSchema: (id) => {
    return get().portSchemas.find((s) => s.id === id);
  },

  getPortSchemas: () => {
    return get().portSchemas;
  },

  setPortSchemas: (schemas) => {
    set({ portSchemas: schemas });
  },

  addPortSchema: (schema) => {
    set((state) => ({
      portSchemas: [...state.portSchemas.filter((s) => s.id !== schema.id), schema],
    }));
  },

  updatePortSchema: (id, updates) => {
    set((state) => ({
      portSchemas: state.portSchemas.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },

  removePortSchema: (id) => {
    const exists = get().portSchemas.some((s) => s.id === id);
    if (exists) {
      set((state) => ({
        portSchemas: state.portSchemas.filter((s) => s.id !== id),
      }));
    }
    return exists;
  },

  // Actions - Deployables
  getDeployable: (id) => {
    return get().deployables.find((d) => d.id === id);
  },

  setDeployables: (deployables) => {
    set({ deployables });
  },

  addDeployable: (deployable) => {
    const id = generateDeployableId();
    const color = deployable.color || generateDeployableColor();
    const newDeployable: Deployable = { ...deployable, id, color };
    set((state) => ({
      deployables: [...state.deployables, newDeployable],
    }));
    return newDeployable;
  },

  updateDeployable: (id, updates) => {
    set((state) => ({
      deployables: state.deployables.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    }));
  },

  removeDeployable: (id) => {
    const exists = get().deployables.some((d) => d.id === id);
    if (exists) {
      set((state) => ({
        deployables: state.deployables.filter((d) => d.id !== id),
      }));
    }
    return exists;
  },

  // Persistence
  loadFromStorage: () => {
    const loaded = loadInitialState();
    set({
      nodes: loaded.nodes,
      edges: loaded.edges,
      title: loaded.title,
      schemas: loaded.schemas,
      portSchemas: loaded.portSchemas,
      deployables: loaded.deployables,
    });
  },

  saveToStorage: () => {
    const { nodes, edges, title, schemas, portSchemas, deployables } = get();
    try {
      localStorage.setItem(
        NEW_STORAGE_KEY,
        JSON.stringify({
          nodes,
          edges,
          title,
          schemas,
          portSchemas,
          deployables,
        })
      );
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
    }
  },

  importNodes: (nodes, edges) => {
    set({ nodes, edges });
  },
}));

/**
 * Get current state outside of React components
 */
export function getDocumentState(): DocumentState {
  return useDocumentStore.getState();
}

// Set up debounced auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

useDocumentStore.subscribe((state, prevState) => {
  // Only save when data changes (not functions)
  if (
    state.nodes !== prevState.nodes ||
    state.edges !== prevState.edges ||
    state.title !== prevState.title ||
    state.schemas !== prevState.schemas ||
    state.portSchemas !== prevState.portSchemas ||
    state.deployables !== prevState.deployables
  ) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      state.saveToStorage();
    }, DEBOUNCE_DELAY);
  }
});
