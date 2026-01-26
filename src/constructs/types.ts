// ============================================
// Core Type Definitions for Constructs System
// ============================================

// ===== M2: FIXED PRIMITIVES =====

/**
 * M2 primitive data types
 */
export type DataKind = 'string' | 'number' | 'boolean' | 'date' | 'enum';

/**
 * Display hints for string type presentation
 */
export type DisplayHint = 'multiline' | 'code' | 'password' | 'url' | 'color';

/**
 * Position of a port on the construct node
 */
export type PortPosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * Compilation format types
 */
export type CompilationFormat = 'json' | 'custom';

/**
 * Port polarity - determines connection direction semantics
 * - 'source': initiates connections (like flow-out, parent)
 * - 'sink': receives connections (like flow-in, child)
 * - 'bidirectional': can both initiate and receive (like symmetric)
 */
export type Polarity = 'source' | 'sink' | 'bidirectional';

// ===== M1: PORT SCHEMA =====

/**
 * Port schema for the port type registry (M1 blueprint)
 * Defines a reusable port type with its polarity and connection compatibility rules
 */
export interface PortSchema {
  id: string;                    // 'flow-in', 'flow-out', 'parent', 'child', 'symmetric'
  displayName: string;
  semanticDescription: string;   // AI compilation context
  polarity: Polarity;
  compatibleWith: string[];      // port IDs or wildcards: '*source*', '*sink*', '*'
  expectedComplement?: string;   // UI hint only (context menus), not validation
  defaultPosition: PortPosition;
  color: string;
  groupId?: string;              // References SchemaGroup.id for hierarchical organization
}


// ===== M1: REGISTRY INFRASTRUCTURE =====

/**
 * Base interface for registry items
 */
export interface RegistryItem {
  id: string;
  name: string;
  description?: string;
}

/**
 * Generic registry interface
 */
export interface Registry<T extends RegistryItem> {
  get(id: string): T | undefined;
  getAll(): T[];
  add(item: Omit<T, 'id'>): T;
  update(id: string, updates: Partial<T>): T | undefined;
  remove(id: string): boolean;
  clear(): void;
}

// ===== M1: FIELD & COMPILATION =====

/**
 * M1 schema for a single field within a construct schema
 */
export interface FieldSchema {
  name: string;
  label: string;
  type: DataKind;
  description?: string;      // AI compilation context
  options?: string[];        // For enum type
  displayHint?: DisplayHint; // For string type presentation
  default?: unknown;
  placeholder?: string;
  showInCollapsed?: boolean;    // Show this field when node is collapsed on canvas
}


/**
 * Configuration for how a construct compiles to output
 */
export interface CompilationConfig {
  format: CompilationFormat;
  template?: string;         // Template string for custom formats
  sectionHeader?: string;    // Header for this section in output
}

// ===== M1: PORT CONFIGURATION =====

/**
 * Port configuration on a construct schema
 * Defines where handles appear and how they connect
 */
export interface PortConfig {
  id: string;                    // Unique within construct, e.g., 'fk_target'
  portType: string;              // References PortDefinition.id (e.g., 'flow-in', 'flow-out')
  position: PortPosition;
  offset: number;                // 0-100% along the edge
  label: string;                 // Display name shown on hover
  description?: string;          // Usage description for compiled output

  // Type hints for UX (soft suggestions)
  suggestedTypes?: string[];     // Construct types for quick-add menus
  suggestedPorts?: string[];     // Port IDs that commonly connect here

  dataType?: string;
}

/**
 * Suggested related construct for schema-level quick-add menus
 * Defines a construct type that commonly relates to this construct type
 */
export interface SuggestedRelatedConstruct {
  constructType: string;         // Construct type to suggest (references ConstructSchema.type)
  fromPortId?: string;           // Optional: port on THIS construct (source)
  toPortId?: string;             // Optional: port on the RELATED construct (target)
  label?: string;                // Optional: custom label for the menu (defaults to displayName)
}

// ===== M1: CONSTRUCT SCHEMA =====

/**
 * Schema defines a construct TYPE (e.g., "controller", "db_table")
 * This is the blueprint for creating construct instances
 */
export interface ConstructSchema {
  type: string;              // Unique identifier: 'controller', 'db_table', etc.
  displayName: string;       // Human-readable name
  color: string;             // Node border/accent color
  icon?: string;             // Optional icon identifier
  description?: string;      // Description shown during compilation (AI context)
  displayField?: string;     // Field name to use as node title (fallback: semanticId)
  fields: FieldSchema[];
  ports?: PortConfig[];      // Port configurations for connections
  suggestedRelated?: SuggestedRelatedConstruct[]; // Suggested related constructs for quick-add
  compilation: CompilationConfig;
  groupId?: string;          // References SchemaGroup.id for hierarchical organization
}

// ===== M0: INSTANCE DATA =====

/**
 * Values stored in a construct instance (node data)
 */
export interface ConstructValues {
  [fieldName: string]: unknown;
}

/**
 * Connection stored on a construct instance
 * Represents a link from this construct's port to another construct's port
 */
export interface ConnectionValue {
  portId: string;                // Which port on this construct
  targetSemanticId: string;      // Connected construct's semanticId
  targetPortId: string;          // Which port on target construct
}

/**
 * Data stored in a React Flow node for constructs
 *
 * Identity: Nodes have TWO identifiers:
 * - Node.id (UUID): Immutable technical key for React Flow and Yjs (not stored here, lives on Node object)
 * - semanticId: Mutable, human/AI-readable identifier for connections and compilation
 */
export interface ConstructNodeData {
  constructType: string;     // References ConstructSchema.type
  semanticId: string;        // Human/AI-readable identifier (e.g., 'controller-user-api')
  values: ConstructValues;   // Field values
  deployableId?: string | null; // Deployable grouping (null/undefined means "none")
  groupId?: string;              // Visual canvas group (not compiled)
  // Port-based connections
  connections?: ConnectionValue[]; // Connections from this construct's ports
  // Relationship metadata for AI consumption
  references?: string[];     // Semantic IDs this construct references
  referencedBy?: string[];   // Semantic IDs that reference this construct
  // UI state
  nodeId?: string;           // Technical UUID (passed from Map for display purposes)
  isExpanded?: boolean;
  onValuesChange?: (values: ConstructValues) => void;
  onToggleExpand?: () => void;
  onDeployableChange?: (deployableId: string | null) => void;
  deployables?: Deployable[]; // List of available deployables for dropdown
  // Index signature for React Flow compatibility
  [key: string]: unknown;
}

// ===== HELPERS =====

/**
 * Deployable - A logical grouping for constructs
 * Helps organize constructs into deployable units (API, database, CDK stack, etc.)
 */
export interface Deployable {
  id: string;
  name: string;
  description: string;
  color?: string;  // Optional color for visual grouping
}

/**
 * Schema group - Hierarchical grouping for construct and port schemas
 * Uses flat storage with parent references for nesting (e.g., "Software Architecture > AWS > Lambda")
 */
export interface SchemaGroup {
  id: string;
  name: string;
  parentId?: string;    // undefined = root level
  color?: string;
  description?: string;
}

/**
 * Visual grouping of nodes on canvas (not included in compilation)
 * Nodes reference groups via groupId, groups don't track nodeIds
 */
export interface CanvasGroup {
  id: string;
  label: string;
  color?: string;
  collapsed?: boolean;
  position?: { x: number; y: number };
}

/**
 * Formatter interface - each output format implements this
 */
export interface Formatter {
  format: CompilationFormat;
  compile(
    nodes: ConstructNodeData[],
    edges: Array<{ source: string; target: string }>,
    schema: ConstructSchema
  ): string;
}

// ===== DOCUMENT =====

/**
 * Complete Carta document structure
 * Represents the full state of a project
 */
export interface CartaDocument {
  version: number;
  title: string;
  description?: string;
  nodes: unknown[];           // Node<ConstructNodeData>[] - using unknown to avoid @xyflow/react import
  edges: unknown[];           // Edge[] - using unknown to avoid @xyflow/react import
  schemas: ConstructSchema[];
  deployables: Deployable[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
}

// ===== PERSISTENCE =====

/**
 * Document adapter interface for abstracting persistence layer.
 * Currently implemented with localStorage, future: Yjs Y.Doc
 */
export interface DocumentAdapter {
  // Load/save lifecycle
  initialize(): Promise<void>;
  dispose(): void;

  // State access - Graph
  getNodes(): unknown[];
  getEdges(): unknown[];
  getTitle(): string;
  getDescription(): string;

  // State access - Schemas
  getSchemas(): ConstructSchema[];
  getSchema(type: string): ConstructSchema | undefined;

  // State access - Deployables
  getDeployables(): Deployable[];
  getDeployable(id: string): Deployable | undefined;

  // State access - Port Schemas
  getPortSchemas(): PortSchema[];
  getPortSchema(id: string): PortSchema | undefined;

  // State access - Schema Groups
  getSchemaGroups(): SchemaGroup[];
  getSchemaGroup(id: string): SchemaGroup | undefined;

  // Mutations - Graph (will become Y.Doc transactions in Yjs)
  setNodes(nodes: unknown[] | ((prev: unknown[]) => unknown[])): void;
  setEdges(edges: unknown[] | ((prev: unknown[]) => unknown[])): void;
  setTitle(title: string): void;
  setDescription(description: string): void;
  generateNodeId(): string;
  updateNode(nodeId: string, updates: Partial<ConstructNodeData>): void;

  // Mutations - Schemas
  setSchemas(schemas: ConstructSchema[]): void;
  addSchema(schema: ConstructSchema): void;
  updateSchema(type: string, updates: Partial<ConstructSchema>): void;
  removeSchema(type: string): boolean;

  // Mutations - Deployables
  setDeployables(deployables: Deployable[]): void;
  addDeployable(deployable: Omit<Deployable, 'id'>): Deployable;
  updateDeployable(id: string, updates: Partial<Deployable>): void;
  removeDeployable(id: string): boolean;

  // Mutations - Port Schemas
  setPortSchemas(portSchemas: PortSchema[]): void;
  addPortSchema(portSchema: PortSchema): void;
  updatePortSchema(id: string, updates: Partial<PortSchema>): void;
  removePortSchema(id: string): boolean;

  // Mutations - Schema Groups
  setSchemaGroups(groups: SchemaGroup[]): void;
  addSchemaGroup(group: Omit<SchemaGroup, 'id'>): SchemaGroup;
  updateSchemaGroup(id: string, updates: Partial<SchemaGroup>): void;
  removeSchemaGroup(id: string): boolean;

  // Batched operations (for Yjs transact)
  // origin parameter allows MCP attribution (e.g., 'user' vs 'ai-mcp')
  transaction<T>(fn: () => T, origin?: string): T;

  // Subscriptions for observing changes
  subscribe(listener: () => void): () => void;

  // Serialization for MCP and export
  toJSON(): CartaDocument;

  // Optional collaboration methods (only on Yjs adapter)
  getConnectionStatus?(): 'disconnected' | 'connecting' | 'connected';
  getConnectedClients?(): number;
}

/**
 * Options for creating an adapter
 */
export interface AdapterOptions {
  storageKey?: string;
}
