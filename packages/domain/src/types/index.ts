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
 * Display tier for field visibility at different node detail levels
 * - 'pill': Used as the node title in pill/compact modes (max 1 per schema)
 * - 'minimal': Shown in collapsed/summary view
 * - 'details': Shown in expanded details view
 * - 'full': Only shown in full view modal (default)
 */
export type DisplayTier = 'pill' | 'minimal' | 'details' | 'full';


/**
 * Compilation format types
 */
export type CompilationFormat = 'json' | 'custom';

/**
 * Port polarity - determines connection direction semantics
 * - 'source': initiates connections (like flow-out, parent)
 * - 'sink': receives connections (like flow-in, child)
 * - 'bidirectional': can both initiate and receive (like symmetric)
 * - 'relay': pass-through output, connects to any sink (skips compatibleWith checks)
 * - 'intercept': pass-through input, connects to any source (skips compatibleWith checks)
 */
export type Polarity = 'source' | 'sink' | 'bidirectional' | 'relay' | 'intercept';

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
  semanticDescription?: string;      // AI compilation context
  options?: { value: string; semanticDescription?: string }[];        // For enum type
  displayHint?: DisplayHint; // For string type presentation
  default?: unknown;
  placeholder?: string;
  displayTier?: DisplayTier;           // Which detail level shows this field (default: 'full')
  displayOrder?: number;               // Sort order within a tier (default: 0)
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
  label: string;                 // Display name shown on hover
  semanticDescription?: string;          // Usage description for compiled output

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
  semanticDescription?: string;      // Description shown during compilation (AI context)
  fields: FieldSchema[];
  ports?: PortConfig[];      // Port configurations for connections
  suggestedRelated?: SuggestedRelatedConstruct[]; // Suggested related constructs for quick-add
  compilation: CompilationConfig;
  groupId?: string;          // References SchemaGroup.id for hierarchical organization
  backgroundColorPolicy?: 'defaultOnly' | 'tints' | 'any';  // Controls instance color picker: 'defaultOnly' (no picker), 'tints' (7 tint swatches), 'any' (full color picker). default: 'defaultOnly'
  renderStyle?: 'default' | 'simple';                            // 'default': header bar + fields. 'simple': tinted surface, label-dominant, content-first, no header bar. default: 'default'
  colorMode?: 'default' | 'instance' | 'enum';                  // How node color is determined: 'default' (schema color), 'instance' (per-instance override), 'enum' (driven by enum field value). default: 'default'
  enumColorField?: string;                                       // Field name (type 'enum') that drives color when colorMode is 'enum'
  enumColorMap?: Record<string, string>;                         // Enum value → hex color mapping for enum color mode
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
  // Port-based connections
  connections?: ConnectionValue[]; // Connections from this construct's ports
  // Relationship metadata for AI consumption
  references?: string[];     // Semantic IDs this construct references
  referencedBy?: string[];   // Semantic IDs that reference this construct
  organizedMembers?: string[];  // Semantic IDs of members in this construct's attached organizer(s)
  organizedIn?: string;         // Name/label of the organizer this construct is a member of
  // Visual overrides
  instanceColor?: string;    // Hex color override, visual-only
  // UI state
  nodeId?: string;           // Technical UUID (passed from Map for display purposes)
  viewLevel?: 'summary' | 'details';
  isDetailsPinned?: boolean;
  onValuesChange?: (values: ConstructValues) => void;
  onSetViewLevel?: (level: 'summary' | 'details') => void;
  onToggleDetailsPin?: () => void;
  onOpenFullView?: () => void;
  onInstanceColorChange?: (color: string | null) => void;
  // Index signature for React Flow compatibility
  [key: string]: unknown;
}

/**
 * Layout strategy for organizer nodes.
 * - 'freeform': Members keep their own positions (default, current behavior)
 * - 'stack': One member visible at a time, with prev/next navigation
 * - 'grid': Members auto-positioned in a grid layout
 */
export type OrganizerLayout = 'freeform' | 'stack' | 'grid';

/**
 * Data stored in a React Flow node for organizers.
 * Organizers use React Flow's native parentId system for containment.
 */
export interface OrganizerNodeData {
  isOrganizer: true;
  name: string;
  color: string;
  collapsed: boolean;
  description?: string;
  layout: OrganizerLayout;
  attachedToSemanticId?: string;  // Semantic ID of owning construct (makes this a "wagon")
  stackIndex?: number;        // Active member index for stack layout
  gridColumns?: number;       // Column count for grid layout
  [key: string]: unknown;
}

// ===== HELPERS =====

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

// ===== COMPILER / SERVER NODE TYPES =====

/**
 * Platform-agnostic node type for compilation and server use.
 * Matches the shape of React Flow nodes at runtime without the @xyflow/react dependency.
 */
export interface CompilerNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: ConstructNodeData;
  parentId?: string;
}

/**
 * Platform-agnostic edge type for compilation and server use.
 */
export interface CompilerEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// ===== DOCUMENT =====

/**
 * Level - A layer of abstraction within a Carta document
 * Users can create multiple levels to represent different abstraction stages
 * (e.g., sketch, detailed design, implementation)
 */
export interface Level {
  id: string;                 // 'level-{timestamp}-{random}'
  name: string;               // User-editable level name
  description?: string;       // Optional level description
  order: number;              // For sorting (0, 1, 2, ...)
  nodes: unknown[];           // Node<ConstructNodeData>[] - level-specific nodes
  edges: unknown[];           // Edge[] - level-specific edges
}

/**
 * Complete Carta document structure (v3 - legacy)
 * Represents the full state of a project (web client / export format)
 * @deprecated Use CartaDocumentV4 for new documents
 */
export interface CartaDocumentV3 {
  version: 3;
  title: string;
  description?: string;
  nodes: unknown[];           // Node<ConstructNodeData>[] - using unknown to avoid @xyflow/react import
  edges: unknown[];           // Edge[] - using unknown to avoid @xyflow/react import
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
}

/**
 * Complete Carta document structure (v4 - current)
 * Represents the full state of a project with levels support
 */
export interface CartaDocumentV4 {
  version: 4;
  title: string;
  description?: string;

  // Levels system
  levels: Level[];
  activeLevel?: string;       // Current active level ID (persisted for collaboration)

  // Shared metamodel definitions
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
}

/**
 * Union type for all document versions
 */
export type CartaDocument = CartaDocumentV3 | CartaDocumentV4;

/**
 * Server-side document model.
 * Extends the base document with server metadata and uses concrete node/edge types.
 */
export interface ServerDocument {
  id: string;
  title: string;
  folder: string;
  version: number;
  formatVersion: number;
  createdAt: string;
  updatedAt: string;
  nodes: CompilerNode[];
  edges: CompilerEdge[];
  customSchemas: ConstructSchema[];
}

/**
 * Lightweight document summary for vault listings.
 * Shared across local (IndexedDB), server, and desktop adapters.
 */
export interface DocumentSummary {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
  nodeCount: number;
  createdAt?: string;
  /** Local filename (desktop only, e.g. "my-doc.json") */
  filename?: string;
}

/**
 * Vault adapter interface — abstracts document storage for the browser modal.
 * Implemented by LocalVaultAdapter (IndexedDB), ServerVaultAdapter (HTTP), DesktopVaultAdapter (Electron).
 */
export interface VaultAdapter {
  /** Human-readable vault location: "Browser Storage" | server URL | filesystem path */
  readonly displayAddress: string;

  /** Optional async initialization (e.g., desktop needs to resolve vault path via IPC) */
  init?(): Promise<void>;

  /** List all documents in the vault */
  listDocuments(): Promise<DocumentSummary[]>;

  /** Create a new document. Returns the document ID. */
  createDocument(title: string, folder?: string): Promise<string>;

  /** Delete a document by ID. Returns true if deleted. */
  deleteDocument(id: string): Promise<boolean>;

  /** Whether this vault supports changing the storage location (desktop only) */
  readonly canChangeVault: boolean;

  /** Change vault location. Reloads the app after switching. Only callable when canChangeVault is true. */
  changeVault?(): Promise<void>;

  /** True when desktop vault folder hasn't been selected yet (first-run state) */
  readonly needsVaultSetup?: boolean;

  /** Initialize a vault at the given path. Returns server info and first document ID. */
  initializeVault?(vaultPath: string): Promise<{ documentId: string; syncUrl: string; wsUrl: string }>;
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

  // State access - Graph (reads from active level)
  getNodes(): unknown[];
  getEdges(): unknown[];
  getTitle(): string;
  getDescription(): string;

  // State access - Levels
  getLevels(): Level[];
  getLevel(id: string): Level | undefined;
  getActiveLevel(): string | undefined;

  // State access - Schemas
  getSchemas(): ConstructSchema[];
  getSchema(type: string): ConstructSchema | undefined;

  // State access - Port Schemas
  getPortSchemas(): PortSchema[];
  getPortSchema(id: string): PortSchema | undefined;

  // State access - Schema Groups
  getSchemaGroups(): SchemaGroup[];
  getSchemaGroup(id: string): SchemaGroup | undefined;

  // Mutations - Graph (writes to active level)
  setNodes(nodes: unknown[] | ((prev: unknown[]) => unknown[])): void;
  setEdges(edges: unknown[] | ((prev: unknown[]) => unknown[])): void;
  setTitle(title: string): void;
  setDescription(description: string): void;
  generateNodeId(): string;
  updateNode(nodeId: string, updates: Partial<ConstructNodeData>): void;

  // Mutations - Levels
  setActiveLevel(levelId: string): void;
  createLevel(name: string, description?: string): Level;
  deleteLevel(levelId: string): boolean;
  updateLevel(levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges' | 'deployables'>>): void;
  duplicateLevel(levelId: string, newName: string): Level;
  copyNodesToLevel(nodeIds: string[], targetLevelId: string): void;

  // Mutations - Schemas
  setSchemas(schemas: ConstructSchema[]): void;
  addSchema(schema: ConstructSchema): void;
  updateSchema(type: string, updates: Partial<ConstructSchema>): void;
  removeSchema(type: string): boolean;

  // Mutations - Port Schemas
  setPortSchemas(portSchemas: PortSchema[]): void;
  addPortSchema(portSchema: PortSchema): void;
  updatePortSchema(id: string, updates: Partial<PortSchema>): void;
  removePortSchema(id: string): boolean;

  // Mutations - Schema Groups
  setSchemaGroups(groups: SchemaGroup[]): void;
  addSchemaGroup(group: Omit<SchemaGroup, 'id'> | SchemaGroup): SchemaGroup;
  updateSchemaGroup(id: string, updates: Partial<SchemaGroup>): void;
  removeSchemaGroup(id: string): boolean;

  // Surgical node patches (bypasses full clear+rebuild for performance)
  patchNodes?(patches: Array<{ id: string; position?: { x: number; y: number }; style?: Record<string, unknown> }>): void;

  // Batched operations (for Yjs transact)
  // origin parameter allows MCP attribution (e.g., 'user' vs 'ai-mcp')
  transaction<T>(fn: () => T, origin?: string): T;

  // Subscriptions for observing changes
  subscribe(listener: () => void): () => void;

  // Granular subscriptions (optional for interface compatibility)
  subscribeToNodes?(listener: () => void): () => void;
  subscribeToEdges?(listener: () => void): () => void;
  subscribeToSchemas?(listener: () => void): () => void;
  subscribeToPortSchemas?(listener: () => void): () => void;
  subscribeToSchemaGroups?(listener: () => void): () => void;
  subscribeToLevels?(listener: () => void): () => void;
  subscribeToMeta?(listener: () => void): () => void;

  // Serialization for MCP and export
  toJSON(): CartaDocumentV4;

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
