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

// ===== M2: PORT REGISTRY =====

/**
 * Port definition for the port type registry
 * Defines a reusable port type with its connection compatibility rules
 */
export interface PortDefinition {
  id: string;                    // 'flow-in', 'flow-out', 'parent', 'child', 'symmetric'
  label: string;
  description: string;
  compatibleWith?: string[];     // Port type IDs this can connect to; undefined = any
  defaultPosition: PortPosition;
  color: string;
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
 * Definition of a single field within a construct schema
 */
export interface FieldDefinition {
  name: string;
  label: string;
  type: DataKind;            // Changed from FieldType
  description?: string;      // AI compilation context
  options?: string[];        // For enum type
  displayHint?: DisplayHint; // For string type presentation
  default?: unknown;
  placeholder?: string;
  displayInMap?: boolean;    // Show this field in the map node summary
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
  fields: FieldDefinition[];
  ports?: PortConfig[];      // Port configurations for connections
  suggestedRelated?: SuggestedRelatedConstruct[]; // Suggested related constructs for quick-add
  compilation: CompilationConfig;
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
 */
export interface ConstructNodeData {
  constructType: string;     // References ConstructSchema.type
  semanticId: string;        // Primary identifier: 'controller-user-api'
  values: ConstructValues;   // Field values
  deployableId?: string | null; // Deployable grouping (null/undefined means "none")
  groupId?: string;              // Visual canvas group (not compiled)
  // Port-based connections
  connections?: ConnectionValue[]; // Connections from this construct's ports
  // Relationship metadata for AI consumption
  references?: string[];     // Semantic IDs this construct references
  referencedBy?: string[];   // Semantic IDs that reference this construct
  // UI state
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
