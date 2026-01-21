// ============================================
// Core Type Definitions for Constructs System
// ============================================

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

// ============================================
// Port System Types
// ============================================

/**
 * Port direction determines valid connection pairings
 * - 'in': Receives flow from 'out' or 'bidi' ports
 * - 'out': Sends flow to 'in' or 'bidi' ports
 * - 'parent': Connected by 'child' ports (hierarchy)
 * - 'child': Connects to 'parent' ports (hierarchy)
 * - 'bidi': Bidirectional, can connect to any compatible port
 */
export type PortDirection = 'in' | 'out' | 'parent' | 'child' | 'bidi';

/**
 * Position of a port on the construct node
 */
export type PortPosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * Port configuration on a construct schema
 * Defines where handles appear and how they connect
 */
export interface PortConfig {
  id: string;                    // Unique within construct, e.g., 'fk_target'
  direction: PortDirection;
  position: PortPosition;
  offset: number;                // 0-100% along the edge
  label: string;                 // Display name shown on hover
  description?: string;          // Usage description for compiled output

  // Future type system hooks
  dataType?: string;
  accepts?: string[];
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
 * M2 primitive data types
 */
export type DataKind = 'string' | 'number' | 'boolean' | 'date' | 'enum';

/**
 * Display hints for string type presentation
 */
export type DisplayHint = 'multiline' | 'code' | 'password' | 'url' | 'color';

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
 * Compilation format types
 */
export type CompilationFormat = 'openapi' | 'dbml' | 'json' | 'custom';

/**
 * Configuration for how a construct compiles to output
 */
export interface CompilationConfig {
  format: CompilationFormat;
  template?: string;         // Template string for custom formats
  sectionHeader?: string;    // Header for this section in output
}

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
  fields: FieldDefinition[];
  ports?: PortConfig[];      // Port configurations for connections
  compilation: CompilationConfig;
  isBuiltIn?: boolean;       // true for built-in schemas, false for user-defined
}

/**
 * Values stored in a construct instance (node data)
 */
export interface ConstructValues {
  [fieldName: string]: unknown;
}

/**
 * Data stored in a React Flow node for constructs
 */
export interface ConstructNodeData {
  constructType: string;     // References ConstructSchema.type
  name: string;              // User-given name for this instance
  semanticId?: string;       // AI-friendly identifier: 'controller-user-api'
  values: ConstructValues;   // Field values
  deployableId?: string | null; // Deployable grouping (null/undefined means "none")
  // Port-based connections
  connections?: ConnectionValue[]; // Connections from this construct's ports
  // Relationship metadata for AI consumption
  references?: string[];     // Semantic IDs this construct references
  referencedBy?: string[];   // Semantic IDs that reference this construct
  // UI state
  isExpanded?: boolean;
  isRenaming?: boolean;
  onRename?: (newName: string) => void;
  onValuesChange?: (values: ConstructValues) => void;
  onToggleExpand?: () => void;
  onDeployableChange?: (deployableId: string | null) => void;
  deployables?: Deployable[]; // List of available deployables for dropdown
  // Index signature for React Flow compatibility
  [key: string]: unknown;
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
