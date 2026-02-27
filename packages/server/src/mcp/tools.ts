/**
 * MCP Tool definitions for Carta
 *
 * Dispatches multi-op MCP tools to @carta/document executeTool.
 * No HTTP calls — callers supply a ToolHandlerConfig with a getDoc callback
 * for Y.Doc access and optional canvas-management callbacks.
 *
 * Workspace-only: 5 tools replacing the legacy 13-tool surface.
 * All tools use canvasId (not documentId). No page management — workspace
 * canvases are single-page.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  executeTool,
  getActivePage,
  extractDocument,
  listPages,
  listConstructs,
  listSchemas,
  listOrganizers,
} from '@carta/document';
import type * as Y from 'yjs';
import type { DocState, DocumentSummary } from '../document-server-core.js';

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const NodeSelectorSchema = z.union([
  z.literal('all'),
  z.object({ constructType: z.string().describe('Filter by construct type') }),
  z.object({ semanticIds: z.array(z.string()).describe('Explicit list of semantic IDs') }),
]);

const ArrangeConstraintSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('align'),
    axis: z.enum(['x', 'y']).describe('Axis to align on'),
    nodes: NodeSelectorSchema.optional().describe('Which nodes to align (default: all in scope)'),
    alignment: z.enum(['center', 'min', 'max']).optional().describe('Alignment target (default: center)'),
  }),
  z.object({
    type: z.literal('order'),
    axis: z.enum(['x', 'y']).describe('Axis to order along'),
    by: z.enum(['field', 'alphabetical']).describe('Sort criterion'),
    field: z.string().optional().describe('Field name for "field" sort'),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('spacing'),
    min: z.number().optional().describe('Minimum gap between node edges in px'),
    equal: z.boolean().optional().describe('Equalize spacing along primary axis'),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('group'),
    by: z.enum(['constructType', 'field']).describe('Group criterion'),
    field: z.string().optional().describe('Field name when by="field"'),
    axis: z.enum(['x', 'y']).optional().describe('Axis to arrange groups along (default: "x")'),
    groupGap: z.number().optional().describe('Gap between groups in px (default: 2x nodeGap)'),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('distribute'),
    axis: z.enum(['x', 'y']).describe('Axis to distribute along'),
    spacing: z.enum(['equal', 'packed']).optional().describe('"equal" for equal center-to-center, "packed" for equal edge-to-edge gaps (default: "equal")'),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('position'),
    anchor: z.enum(['top', 'bottom', 'left', 'right', 'center']).describe('Canvas edge or center to anchor to'),
    nodes: NodeSelectorSchema.optional(),
    margin: z.number().optional().describe('Offset from edge in px (default: 0)'),
  }),
  z.object({
    type: z.literal('flow'),
    direction: z.enum(['TB', 'BT', 'LR', 'RL']).optional().describe('Flow direction (default: "TB")'),
    sourcePort: z.string().optional().describe('Port ID defining downstream direction (default: "flow-out")'),
    layerGap: z.number().optional().describe('Gap between layers in px (default: 250)'),
    nodeGap: z.number().optional().describe('Gap between nodes in same layer in px (default: 150)'),
    nodes: NodeSelectorSchema.optional(),
  }),
]);

// ─── Canvas ID schema ─────────────────────────────────────────────────────────

const CanvasIdSchema = z.object({
  canvasId: z.string().describe('Canvas identifier (room name / relative path stem, e.g. "01-vision/domain-sketch")'),
});

// ─── Batch operations array (internal, no outer wrapper) ─────────────────────

const BatchOperationSchema = z.array(z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create'),
    constructType: z.string().describe('The type of construct to create'),
    values: z.record(z.unknown()).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional().describe('Organizer node ID, or "@N" to reference result of operation N'),
  }),
  z.object({
    op: z.literal('update'),
    semanticId: z.string().describe('Semantic ID or "@N" placeholder'),
    values: z.record(z.unknown()).optional(),
    instanceColor: z.string().nullable().optional(),
  }),
  z.object({
    op: z.literal('delete'),
    semanticId: z.string().describe('Semantic ID or "@N" placeholder'),
  }),
  z.object({
    op: z.literal('connect'),
    sourceSemanticId: z.string().describe('Source semantic ID or "@N" placeholder'),
    sourcePortId: z.string(),
    targetSemanticId: z.string().describe('Target semantic ID or "@N" placeholder'),
    targetPortId: z.string(),
  }),
  z.object({
    op: z.literal('disconnect'),
    sourceSemanticId: z.string().describe('Source semantic ID or "@N" placeholder'),
    sourcePortId: z.string(),
    targetSemanticId: z.string().describe('Target semantic ID or "@N" placeholder'),
  }),
  z.object({
    op: z.literal('move'),
    semanticId: z.string().describe('Semantic ID or "@N" placeholder'),
    parentId: z.string().nullable().describe('Target organizer ID, null to detach, or "@N" placeholder'),
    x: z.number().optional(),
    y: z.number().optional(),
  }),
])).describe('Operations to execute in order within a single transaction');

// ─── Canvas operations (merged: construct, connection, organizer, batch, read) ─

export const CanvasOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('list') }),
  z.object({
    op: z.literal('get'),
    canvasId: z.string().describe('Canvas identifier'),
  }),
  z.object({
    op: z.literal('summary'),
    canvasId: z.string().describe('Canvas identifier'),
    include: z.array(z.enum(['constructs', 'schemas'])).optional().describe('Embed additional data in the response: "constructs" (construct list + organizers), "schemas" (custom schema list)'),
  }),
  z.object({
    op: z.literal('create'),
    canvasId: z.string().describe('Canvas identifier'),
    constructType: z.string().describe('The type of construct to create'),
    values: z.record(z.unknown()).optional().describe('Initial field values'),
    x: z.number().optional().describe('X position on canvas'),
    y: z.number().optional().describe('Y position on canvas'),
    parentId: z.string().optional().describe('Organizer node ID — when set, position is relative to the organizer'),
  }),
  z.object({
    op: z.literal('create_bulk'),
    canvasId: z.string().describe('Canvas identifier'),
    constructs: z.array(z.object({
      constructType: z.string().describe('The type of construct to create'),
      values: z.record(z.unknown()).optional().describe('Initial field values'),
      x: z.number().optional().describe('X position on canvas (auto-placed if omitted)'),
      y: z.number().optional().describe('Y position on canvas (auto-placed if omitted)'),
      parentId: z.string().optional().describe('Organizer node ID'),
    })).describe('Array of constructs to create'),
  }),
  z.object({
    op: z.literal('update'),
    canvasId: z.string().describe('Canvas identifier'),
    semanticId: z.string().describe('The semantic ID of the construct'),
    values: z.record(z.unknown()).optional().describe('Field values to update'),
    instanceColor: z.string().nullable().optional().describe('Hex color override for node background (visual only)'),
  }),
  z.object({
    op: z.literal('delete'),
    canvasId: z.string().describe('Canvas identifier'),
    semanticId: z.string().describe('The semantic ID of the construct to delete'),
  }),
  z.object({
    op: z.literal('delete_bulk'),
    canvasId: z.string().describe('Canvas identifier'),
    semanticIds: z.array(z.string()).describe('Array of semantic IDs to delete'),
  }),
  z.object({
    op: z.literal('move'),
    canvasId: z.string().describe('Canvas identifier'),
    semanticId: z.string().describe('The semantic ID of the construct to move'),
    parentId: z.string().nullable().describe('Target organizer node ID, or null to detach from current organizer'),
    x: z.number().optional().describe('New X position (auto-converted if omitted)'),
    y: z.number().optional().describe('New Y position (auto-converted if omitted)'),
  }),
  z.object({
    op: z.literal('connect'),
    canvasId: z.string().describe('Canvas identifier'),
    sourceSemanticId: z.string().describe('Source construct semantic ID'),
    sourcePortId: z.string().describe('Source port ID'),
    targetSemanticId: z.string().describe('Target construct semantic ID'),
    targetPortId: z.string().describe('Target port ID'),
  }),
  z.object({
    op: z.literal('disconnect'),
    canvasId: z.string().describe('Canvas identifier'),
    sourceSemanticId: z.string().describe('Source construct semantic ID'),
    sourcePortId: z.string().describe('Source port ID'),
    targetSemanticId: z.string().describe('Target construct semantic ID'),
  }),
  z.object({
    op: z.literal('connect_bulk'),
    canvasId: z.string().describe('Canvas identifier'),
    connections: z.array(z.object({
      sourceSemanticId: z.string().describe('Source construct semantic ID'),
      sourcePortId: z.string().describe('Source port ID'),
      targetSemanticId: z.string().describe('Target construct semantic ID'),
      targetPortId: z.string().describe('Target port ID'),
    })).describe('Array of connections to create'),
  }),
  z.object({
    op: z.literal('create_organizer'),
    canvasId: z.string().describe('Canvas identifier'),
    name: z.string().describe('Organizer name'),
    color: z.string().optional().describe('Hex color (random from palette if omitted)'),
    x: z.number().optional().describe('X position on canvas'),
    y: z.number().optional().describe('Y position on canvas'),
    width: z.number().optional().describe('Width in pixels (default: 400)'),
    height: z.number().optional().describe('Height in pixels (default: 300)'),
    layout: z.enum(['freeform']).optional().describe('Layout strategy (default: freeform)'),
    description: z.string().optional().describe('Optional description'),
    attachedToSemanticId: z.string().optional().describe('Semantic ID of construct to attach this organizer to (creates a "wagon")'),
  }),
  z.object({
    op: z.literal('update_organizer'),
    canvasId: z.string().describe('Canvas identifier'),
    organizerId: z.string().describe('The organizer node ID'),
    name: z.string().optional().describe('New name'),
    color: z.string().optional().describe('New hex color'),
    collapsed: z.boolean().optional().describe('Collapse/expand the organizer'),
    layout: z.enum(['freeform']).optional().describe('New layout strategy'),
    description: z.string().optional().describe('New description'),
  }),
  z.object({
    op: z.literal('delete_organizer'),
    canvasId: z.string().describe('Canvas identifier'),
    organizerId: z.string().describe('The organizer node ID'),
    deleteMembers: z.boolean().optional().describe('If true, delete member constructs too. Default: false (detach members)'),
  }),
  z.object({
    op: z.literal('batch'),
    canvasId: z.string().describe('Canvas identifier'),
    operations: BatchOperationSchema,
  }),
]);

// ─── Schema operations (merged: schema, migrate, package, list_port_types) ────

export const SchemaOpSchema = z.discriminatedUnion('op', [
  // Schema CRUD
  z.object({
    op: z.literal('list'),
    canvasId: z.string().describe('Canvas identifier'),
    output: z.enum(['compact', 'full']).optional().describe('Output mode: "compact" returns {type, displayName, groupId} only. Default: "full"'),
    groupId: z.string().optional().describe('Filter schemas by groupId'),
  }),
  z.object({
    op: z.literal('get'),
    canvasId: z.string().describe('Canvas identifier'),
    type: z.string().describe('The schema type to retrieve'),
  }),
  z.object({
    op: z.literal('create'),
    canvasId: z.string().describe('Canvas identifier'),
    type: z.string().describe('Unique type identifier'),
    displayName: z.string().describe('Human-readable name'),
    color: z.string().describe('Hex color for the node'),
    semanticDescription: z.string().optional().describe('Description for AI context'),
    groupId: z.string().optional().describe('Schema group ID for organizing schemas'),
    packageId: z.string().optional().describe('Schema package ID to assign this schema to'),
    instanceColors: z.boolean().optional().describe('true = per-instance color palette; false/absent = schema color only'),
    fields: z
      .array(
        z.object({
          name: z.string(),
          label: z.string(),
          type: z.enum(['string', 'number', 'boolean', 'date', 'enum', 'resource']),
          semanticDescription: z.string().optional(),
          options: z.array(z.object({ value: z.string(), semanticDescription: z.string().optional() })).optional(),
          default: z.unknown().optional(),
          placeholder: z.string().optional(),
          displayHint: z.enum(['multiline', 'code', 'password', 'url', 'color', 'markdown']).optional(),
          displayTier: z.enum(['pill', 'summary']).optional().describe('Display tier: pill (node title), summary (shown on canvas). Omit for inspector-only fields.'),
          displayOrder: z.number().optional().describe('Sort order within a tier (default 0)'),
        })
      )
      .describe('Field definitions'),
    ports: z
      .array(
        z.object({
          id: z.string(),
          portType: z.enum(['flow-in', 'flow-out', 'parent', 'child', 'symmetric', 'intercept', 'relay']),
          label: z.string(),
          semanticDescription: z.string().optional(),
        })
      )
      .optional()
      .describe('Port configurations'),
  }),
  z.object({
    op: z.literal('update'),
    canvasId: z.string().describe('Canvas identifier'),
    type: z.string().describe('The schema type to update'),
    displayName: z.string().optional().describe('New human-readable name'),
    color: z.string().optional().describe('New hex color for the node'),
    semanticDescription: z.string().optional().describe('New description for AI context'),
    groupId: z.string().optional().describe('New schema group ID'),
    packageId: z.string().nullable().optional().describe('Schema package ID (null to remove from package)'),
    backgroundColorPolicy: z.enum(['defaultOnly', 'tints', 'any']).optional(),
    nodeShape: z.enum(['default', 'simple', 'circle', 'diamond', 'document', 'parallelogram', 'stadium']).optional().describe('Node render style'),
    enumIconField: z.string().optional().describe('Field name for icon markers'),
    enumIconMap: z.record(z.string()).optional().describe('Enum value → Unicode character mapping'),
    fieldUpdates: z.record(z.object({
      label: z.string().optional(),
      semanticDescription: z.string().optional(),
      displayHint: z.enum(['multiline', 'code', 'password', 'url', 'color', 'markdown']).optional(),
      displayTier: z.enum(['pill', 'summary']).optional(),
      displayOrder: z.number().optional(),
      placeholder: z.string().optional(),
    })).optional().describe('Map of field name → metadata updates (non-structural only)'),
  }),
  z.object({
    op: z.literal('delete'),
    canvasId: z.string().describe('Canvas identifier'),
    type: z.string().describe('The schema type to delete'),
  }),

  // Schema migrations
  z.object({
    op: z.literal('rename_field'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    oldName: z.string().describe('Current field name'),
    newName: z.string().describe('New field name'),
  }),
  z.object({
    op: z.literal('remove_field'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    fieldName: z.string().describe('Field name to remove'),
  }),
  z.object({
    op: z.literal('add_field'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    field: z.object({
      name: z.string().describe('Field name'),
      type: z.enum(['string', 'number', 'boolean', 'date', 'enum', 'resource']).describe('Field data type'),
      options: z.array(z.string()).optional().describe('Enum options (required if type is enum)'),
      label: z.string().optional().describe('Display label'),
      displayTier: z.enum(['pill', 'summary']).optional(),
      semanticDescription: z.string().optional(),
    }).describe('Field definition'),
    defaultValue: z.unknown().optional().describe('Default value to populate on existing instances'),
  }),
  z.object({
    op: z.literal('rename_port'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    oldPortId: z.string().describe('Current port ID'),
    newPortId: z.string().describe('New port ID'),
  }),
  z.object({
    op: z.literal('remove_port'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    portId: z.string().describe('Port ID to remove'),
  }),
  z.object({
    op: z.literal('add_port'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    portConfig: z.object({
      id: z.string().describe('Unique port ID within the schema'),
      portType: z.string().describe('Port type reference (e.g. flow-in, flow-out)'),
      label: z.string().describe('Display label for the port'),
      suggestedTypes: z.array(z.string()).optional(),
    }).describe('Port configuration to add'),
  }),
  z.object({
    op: z.literal('rename_type'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The current schema type to rename'),
    newType: z.string().describe('The new schema type identifier'),
  }),
  z.object({
    op: z.literal('change_field_type'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    fieldName: z.string().describe('Field name to change type of'),
    newType: z.enum(['string', 'number', 'boolean', 'date', 'enum', 'resource']).describe('New data type'),
    force: z.boolean().optional().describe('Set to true to execute. Default (false/omitted) returns a dry-run preview.'),
    enumOptions: z.array(z.string()).optional().describe('Enum options (required when newType is enum)'),
  }),
  z.object({
    op: z.literal('narrow_enum'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    fieldName: z.string().describe('Enum field name'),
    newOptions: z.array(z.string()).describe('New enum options list'),
    valueMapping: z.record(z.string()).optional().describe('Map old values to new values (e.g. {"old_val": "new_val"})'),
  }),
  z.object({
    op: z.literal('change_port_type'),
    canvasId: z.string().describe('Canvas identifier'),
    schemaType: z.string().describe('The schema type to modify'),
    portId: z.string().describe('Port ID to change'),
    newPortType: z.string().describe('New port type reference'),
  }),

  // Package operations (renamed to avoid collision with schema list/get/create)
  z.object({
    op: z.literal('list_packages'),
    canvasId: z.string().describe('Canvas identifier'),
  }),
  z.object({
    op: z.literal('get_package'),
    canvasId: z.string().describe('Canvas identifier'),
    packageId: z.string().describe('Schema package ID'),
  }),
  z.object({
    op: z.literal('create_package'),
    canvasId: z.string().describe('Canvas identifier'),
    name: z.string().describe('Package name'),
    description: z.string().optional().describe('Package description'),
    color: z.string().describe('Hex color for the package'),
  }),
  z.object({
    op: z.literal('list_standard_packages'),
    canvasId: z.string().describe('Canvas identifier'),
  }),
  z.object({
    op: z.literal('apply_package'),
    canvasId: z.string().describe('Canvas identifier'),
    packageId: z.string().describe('Standard library package ID (e.g., "software-architecture", "bpmn")'),
  }),
  z.object({
    op: z.literal('check_drift'),
    canvasId: z.string().describe('Canvas identifier'),
    packageId: z.string().describe('Package ID to check for modifications'),
  }),

  // Port types
  z.object({
    op: z.literal('list_port_types'),
    canvasId: z.string().describe('Canvas identifier'),
  }),
]);

// ─── Layout operations ────────────────────────────────────────────────────────

const LayoutOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('flow'),
    canvasId: z.string().describe('Canvas identifier'),
    direction: z.enum(['TB', 'BT', 'LR', 'RL']).describe('Layout direction: TB (top-to-bottom), BT, LR, RL'),
    sourcePort: z.string().optional().describe('Port ID defining downstream flow (default: "flow-out")'),
    sinkPort: z.string().optional().describe('Port ID defining upstream flow (default: "flow-in")'),
    layerGap: z.number().optional().describe('Gap between layers in pixels (default: 250)'),
    nodeGap: z.number().optional().describe('Gap between nodes in same layer (default: 150)'),
    scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds to layout (default: "all")'),
  }),
  z.object({
    op: z.literal('arrange'),
    canvasId: z.string().describe('Canvas identifier'),
    strategy: z.enum(['grid', 'preserve', 'force']).optional().describe('Base layout strategy (default: "preserve")'),
    constraints: z.array(ArrangeConstraintSchema).describe('Declarative layout constraints applied sequentially'),
    scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds (default: "all")'),
    nodeGap: z.number().optional().describe('Default gap between nodes in px (default: 40)'),
    forceIterations: z.number().optional().describe('Iteration count for force strategy (default: 50)'),
  }),
  z.object({
    op: z.literal('pin'),
    canvasId: z.string().describe('Canvas identifier'),
    sourceOrganizerId: z.string().describe('The organizer being positioned'),
    targetOrganizerId: z.string().describe('The reference organizer'),
    direction: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']).describe('Where source sits relative to target'),
    gap: z.number().optional().describe('Spacing between organizers in pixels (default: 60)'),
  }),
  z.object({
    op: z.literal('list_pins'),
    canvasId: z.string().describe('Canvas identifier'),
  }),
  z.object({
    op: z.literal('remove_pin'),
    canvasId: z.string().describe('Canvas identifier'),
    constraintId: z.string().describe('The constraint ID to remove'),
  }),
  z.object({
    op: z.literal('apply_pins'),
    canvasId: z.string().describe('Canvas identifier'),
    gap: z.number().optional().describe('Default spacing between organizers in pixels (default: 60)'),
  }),
]);

// ─── Workspace operations ─────────────────────────────────────────────────────

const WorkspaceOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('status') }),
]);

// ─── Tool definitions ─────────────────────────────────────────────────────────

export function getToolDefinitions() {
  return [
    {
      name: 'carta_canvas',
      description: `Canvas operations — read, mutate constructs, connections, organizers, and batch.\nops: list (all canvases in workspace), get (full canvas contents), summary (compact counts + optional embedded data), create (construct), create_bulk, update (construct fields), delete (construct), delete_bulk, move (construct into/out of organizer), connect, disconnect, connect_bulk, create_organizer, update_organizer, delete_organizer, batch (heterogeneous mutations in one transaction with @N placeholders)`,
      inputSchema: zodToJsonSchema(CanvasOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_schema',
      description: `Schema, migration, package, and port type operations.\nops: list (all schemas; output="compact" reduces tokens; filter by groupId), get (schema by type), create (new schema with fields/ports), update (non-breaking properties only), delete (by type), rename_field, remove_field, add_field, rename_port, remove_port, add_port, rename_type, change_field_type, narrow_enum, change_port_type, list_packages, get_package, create_package, list_standard_packages, apply_package, check_drift, list_port_types`,
      inputSchema: zodToJsonSchema(SchemaOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_layout',
      description: `Layout operations.\nops: flow (topological DAG layout along TB/BT/LR/RL direction), arrange (declarative constraint-based layout; strategies: grid/preserve/force; constraints: align, order, spacing, group, distribute, position, flow), pin (declare relative positioning between organizers), list_pins (list all pin constraints), remove_pin (remove a pin constraint by ID), apply_pins (resolve and apply all pin constraints)`,
      inputSchema: zodToJsonSchema(LayoutOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_compile',
      description: 'Compile a canvas to AI-readable output',
      inputSchema: zodToJsonSchema(CanvasIdSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_workspace',
      description: `Workspace operations.\nops: status (workspace tree: groups, canvases, files, schemas metadata)`,
      inputSchema: zodToJsonSchema(WorkspaceOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
  ];
}

// ─── Tool handler types ───────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolHandlers {
  carta_canvas: ToolHandler;
  carta_schema: ToolHandler;
  carta_layout: ToolHandler;
  carta_compile: ToolHandler;
  carta_workspace: ToolHandler;
  [key: string]: ToolHandler;
}

/**
 * DocState extended with an optional flush() method for remote (stdio) mode.
 * flush() sends accumulated Y.Doc updates back to the remote server.
 */
export interface DocStateWithFlush extends DocState {
  flush?(): Promise<void>;
}

/**
 * Configuration for createToolHandlers.
 *
 * Callers supply a getDoc callback for per-canvas Y.Doc access.
 * Workspace-level operations use optional callbacks — in stdio mode these
 * make HTTP calls; in embedded mode they delegate to the server config.
 */
export interface ToolHandlerConfig {
  /** Resolve a canvas ID to an in-memory DocState (real or reconstructed). */
  getDoc(canvasId: string): Promise<DocStateWithFlush>;
  /** List all canvases in the workspace. */
  listCanvases?(): Promise<DocumentSummary[]>;
  /** Get workspace tree (groups, files, metadata). */
  getWorkspaceTree?(): Promise<unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Unwrap a ToolResult, returning the data or an error object. */
function unwrap(result: { success: boolean; data?: unknown; error?: string }): unknown {
  if (!result.success) {
    return { error: result.error ?? 'Tool execution failed' };
  }
  return result.data;
}

/** Resolve pageId from the active page in the Y.Doc. Workspace canvases are single-page. */
function resolvePageId(ydoc: Y.Doc): string {
  return getActivePage(ydoc) ?? '';
}

/**
 * Build a canvas summary response.
 * Used by carta_canvas op:summary.
 */
function buildPageSummary(
  ydoc: Y.Doc,
  targetPageId?: string,
  targetPageName?: string,
  include?: string[]
): unknown {
  const ymeta = ydoc.getMap('meta');
  const title = (ymeta.get('title') as string) || 'Untitled Project';
  const pages = listPages(ydoc);
  const activePage = getActivePage(ydoc);
  const schemas = listSchemas(ydoc);
  const yschemasMap = ydoc.getMap('schemas');
  const customSchemaCount = schemas.filter(s => yschemasMap.has(s.type)).length;

  let totalConstructs = 0;
  let totalOrganizers = 0;
  let totalEdges = 0;

  const pageSummaries = pages.map(page => {
    const constructs = listConstructs(ydoc, page.id);
    const constructCount = constructs.filter(c => c.type !== 'organizer').length;
    const organizerCount = constructs.filter(c => c.type === 'organizer').length;
    const yedges = ydoc.getMap<unknown>('edges');
    const pageEdgeMap = yedges.get(page.id) as Map<unknown, unknown> | undefined;
    const edgeCount = pageEdgeMap ? (pageEdgeMap as { size?: number }).size ?? 0 : 0;
    totalConstructs += constructCount;
    totalOrganizers += organizerCount;
    totalEdges += edgeCount;
    return { id: page.id, name: page.name, constructCount, organizerCount, edgeCount };
  });

  const response: Record<string, unknown> = {
    title,
    activePage,
    pages: pageSummaries,
    customSchemaCount,
    totalConstructs,
    totalOrganizers,
    totalEdges,
  };

  if (include && include.length > 0) {
    // Resolve target page for embedded data
    let embedPageId = targetPageId;
    if (!embedPageId && targetPageName) {
      const page = pages.find(p => p.name.toLowerCase() === targetPageName.toLowerCase());
      embedPageId = page?.id;
    }
    embedPageId = embedPageId ?? activePage ?? undefined;

    if (embedPageId) {
      if (include.includes('constructs')) {
        const allNodes = listConstructs(ydoc, embedPageId);
        const organizers = listOrganizers(ydoc, embedPageId);
        const constructs = allNodes
          .filter(c => c.type !== 'organizer')
          .map(c => ({
            semanticId: c.data.semanticId,
            constructType: c.data.constructType,
            displayName: (c.data.values as Record<string, unknown> | undefined)?.name as string ?? c.data.semanticId,
            parentId: c.parentId,
          }));
        response.constructs = constructs;
        response.organizers = organizers;
      }
      if (include.includes('schemas')) {
        response.customSchemas = schemas
          .filter(s => yschemasMap.has(s.type))
          .map(s => ({ type: s.type, displayName: s.displayName, groupId: s.groupId }));
      }
    }
  }

  return response;
}

// ─── Tool handlers ────────────────────────────────────────────────────────────

export function createToolHandlers(config: ToolHandlerConfig): ToolHandlers {
  return {

    carta_canvas: async (args) => {
      const input = CanvasOpSchema.parse(args);

      if (input.op === 'list') {
        const canvases = await config.listCanvases?.() ?? [];
        return { canvases };
      }

      const docState = await config.getDoc(input.canvasId);
      const pageId = resolvePageId(docState.doc);
      try {
        switch (input.op) {
          case 'get':
            return { canvas: extractDocument(docState.doc, input.canvasId, pageId) };
          case 'summary':
            return buildPageSummary(docState.doc, undefined, undefined, input.include);
          case 'create':
            return unwrap(executeTool('create_construct', { constructType: input.constructType, values: input.values, x: input.x, y: input.y, parentId: input.parentId }, docState.doc, pageId));
          case 'create_bulk':
            return unwrap(executeTool('create_constructs', { constructs: input.constructs }, docState.doc, pageId));
          case 'update':
            return unwrap(executeTool('update_construct', { semanticId: input.semanticId, values: input.values, instanceColor: input.instanceColor }, docState.doc, pageId));
          case 'delete':
            return unwrap(executeTool('delete_construct', { semanticId: input.semanticId }, docState.doc, pageId));
          case 'delete_bulk':
            return unwrap(executeTool('delete_constructs', { semanticIds: input.semanticIds }, docState.doc, pageId));
          case 'move':
            return unwrap(executeTool('move_construct', { semanticId: input.semanticId, parentId: input.parentId, x: input.x, y: input.y }, docState.doc, pageId));
          case 'connect':
            return unwrap(executeTool('connect_constructs', { sourceSemanticId: input.sourceSemanticId, sourcePortId: input.sourcePortId, targetSemanticId: input.targetSemanticId, targetPortId: input.targetPortId }, docState.doc, pageId));
          case 'disconnect':
            return unwrap(executeTool('disconnect_constructs', { sourceSemanticId: input.sourceSemanticId, sourcePortId: input.sourcePortId, targetSemanticId: input.targetSemanticId }, docState.doc, pageId));
          case 'connect_bulk':
            return unwrap(executeTool('connect_constructs_bulk', { connections: input.connections }, docState.doc, pageId));
          case 'create_organizer':
            return unwrap(executeTool('create_organizer', { name: input.name, color: input.color, x: input.x, y: input.y, width: input.width, height: input.height, layout: input.layout, description: input.description, attachedToSemanticId: input.attachedToSemanticId }, docState.doc, pageId));
          case 'update_organizer':
            return unwrap(executeTool('update_organizer', { organizerId: input.organizerId, name: input.name, color: input.color, collapsed: input.collapsed, layout: input.layout, description: input.description }, docState.doc, pageId));
          case 'delete_organizer':
            return unwrap(executeTool('delete_organizer', { organizerId: input.organizerId, deleteMembers: input.deleteMembers }, docState.doc, pageId));
          case 'batch':
            return unwrap(executeTool('batch_mutate', { operations: input.operations }, docState.doc, pageId));
        }
      } finally {
        await docState.flush?.();
      }
    },

    carta_schema: async (args) => {
      const input = SchemaOpSchema.parse(args);
      const docState = await config.getDoc(input.canvasId);
      try {
        switch (input.op) {
          // Schema CRUD
          case 'list':
            return unwrap(executeTool('list_schemas', { output: input.output, groupId: input.groupId }, docState.doc, ''));
          case 'get':
            return unwrap(executeTool('get_schema', { type: input.type }, docState.doc, ''));
          case 'create': {
            const { op: _op, canvasId: _cid, ...params } = input;
            return unwrap(executeTool('create_schema', params, docState.doc, ''));
          }
          case 'update': {
            const { op: _op, canvasId: _cid, ...params } = input;
            return unwrap(executeTool('update_schema', params, docState.doc, ''));
          }
          case 'delete':
            return unwrap(executeTool('delete_schema', { type: input.type }, docState.doc, ''));

          // Schema migrations
          case 'rename_field':
            return unwrap(executeTool('rename_field', { schemaType: input.schemaType, oldName: input.oldName, newName: input.newName }, docState.doc, ''));
          case 'remove_field':
            return unwrap(executeTool('remove_field', { schemaType: input.schemaType, fieldName: input.fieldName }, docState.doc, ''));
          case 'add_field':
            return unwrap(executeTool('add_field', { schemaType: input.schemaType, field: input.field, defaultValue: input.defaultValue }, docState.doc, ''));
          case 'rename_port':
            return unwrap(executeTool('rename_port', { schemaType: input.schemaType, oldPortId: input.oldPortId, newPortId: input.newPortId }, docState.doc, ''));
          case 'remove_port':
            return unwrap(executeTool('remove_port', { schemaType: input.schemaType, portId: input.portId }, docState.doc, ''));
          case 'add_port':
            return unwrap(executeTool('add_port', { schemaType: input.schemaType, portConfig: input.portConfig }, docState.doc, ''));
          case 'rename_type':
            return unwrap(executeTool('rename_schema_type', { schemaType: input.schemaType, newType: input.newType }, docState.doc, ''));
          case 'change_field_type':
            return unwrap(executeTool('change_field_type', { schemaType: input.schemaType, fieldName: input.fieldName, newType: input.newType, force: input.force, enumOptions: input.enumOptions }, docState.doc, ''));
          case 'narrow_enum':
            return unwrap(executeTool('narrow_enum_options', { schemaType: input.schemaType, fieldName: input.fieldName, newOptions: input.newOptions, valueMapping: input.valueMapping }, docState.doc, ''));
          case 'change_port_type':
            return unwrap(executeTool('change_port_type', { schemaType: input.schemaType, portId: input.portId, newPortType: input.newPortType }, docState.doc, ''));

          // Package operations
          case 'list_packages':
            return unwrap(executeTool('list_packages', {}, docState.doc, ''));
          case 'get_package':
            return unwrap(executeTool('get_package', { packageId: input.packageId }, docState.doc, ''));
          case 'create_package':
            return unwrap(executeTool('create_package', { name: input.name, description: input.description, color: input.color }, docState.doc, ''));
          case 'list_standard_packages':
            return unwrap(executeTool('list_standard_packages', {}, docState.doc, ''));
          case 'apply_package':
            return unwrap(executeTool('apply_standard_package', { packageId: input.packageId }, docState.doc, ''));
          case 'check_drift':
            return unwrap(executeTool('check_package_drift', { packageId: input.packageId }, docState.doc, ''));

          // Port types
          case 'list_port_types':
            return unwrap(executeTool('list_port_types', {}, docState.doc, ''));
        }
      } finally {
        await docState.flush?.();
      }
    },

    carta_layout: async (args) => {
      const input = LayoutOpSchema.parse(args);
      const docState = await config.getDoc(input.canvasId);
      const pageId = resolvePageId(docState.doc);
      try {
        switch (input.op) {
          case 'flow':
            return unwrap(executeTool('flow_layout', { direction: input.direction, sourcePort: input.sourcePort, sinkPort: input.sinkPort, layerGap: input.layerGap, nodeGap: input.nodeGap, scope: input.scope }, docState.doc, pageId));
          case 'arrange':
            return unwrap(executeTool('arrange', { strategy: input.strategy, constraints: input.constraints, scope: input.scope, nodeGap: input.nodeGap, forceIterations: input.forceIterations }, docState.doc, pageId));
          case 'pin':
            return unwrap(executeTool('pin_constraint', { sourceOrganizerId: input.sourceOrganizerId, targetOrganizerId: input.targetOrganizerId, direction: input.direction, gap: input.gap }, docState.doc, pageId));
          case 'list_pins':
            return unwrap(executeTool('list_pin_constraints', {}, docState.doc, pageId));
          case 'remove_pin':
            return unwrap(executeTool('remove_pin_constraint', { constraintId: input.constraintId }, docState.doc, pageId));
          case 'apply_pins':
            return unwrap(executeTool('apply_pin_layout', { gap: input.gap }, docState.doc, pageId));
        }
      } finally {
        await docState.flush?.();
      }
    },

    carta_compile: async (args) => {
      const { canvasId } = CanvasIdSchema.parse(args);
      const docState = await config.getDoc(canvasId);
      const pageId = resolvePageId(docState.doc);
      return unwrap(executeTool('compile', {}, docState.doc, pageId));
    },

    carta_workspace: async (args) => {
      const input = WorkspaceOpSchema.parse(args);
      switch (input.op) {
        case 'status':
          return await config.getWorkspaceTree?.() ?? { error: 'Workspace not configured' };
      }
    },

  };
}
