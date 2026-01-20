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

/**
 * Column definition for table fields
 */
export interface ColumnDef {
  name: string;
  label: string;
  type?: 'text' | 'dropdown' | 'boolean';
  options?: string[]; // For dropdown columns
}

/**
 * Field types supported by the visual editor
 */
export type FieldType = 'text' | 'dropdown' | 'table' | 'connection' | 'code';

/**
 * Definition of a single field within a construct schema
 */
export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];        // For dropdown type
  columns?: ColumnDef[];     // For table type
  connectionType?: string;   // For connection type (links to another construct type)
  default?: unknown;
  placeholder?: string;
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
  category: string;          // For grouping: 'api', 'data', 'infra'
  color: string;             // Node border/accent color
  icon?: string;             // Optional icon identifier
  description?: string;      // Description shown during compilation (AI context)
  fields: FieldDefinition[];
  compilation: CompilationConfig;
  isBuiltIn?: boolean;       // true for built-in schemas, false for user-defined
}

/**
 * Table row data for table fields
 */
export interface TableRow {
  id: string;
  [key: string]: unknown;
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
