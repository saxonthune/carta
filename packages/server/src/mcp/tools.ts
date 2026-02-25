/**
 * MCP Tool definitions for Carta
 *
 * All tools communicate with the document server via HTTP REST API.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

// ─── Standalone schemas (unchanged tools) ────────────────────────────────────

const BatchMutateSchema = z.object({
  documentId: z.string().describe('The document ID'),
  operations: z.array(z.discriminatedUnion('op', [
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
  ])).describe('Operations to execute in order within a single transaction'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const DocumentIdSchema = z.object({
  documentId: z.string().describe('The document ID'),
});

const RebuildPageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

// ─── Consolidated discriminated union schemas ─────────────────────────────────

const DocumentOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('list') }),
  z.object({ op: z.literal('list_active') }),
  z.object({
    op: z.literal('get'),
    documentId: z.string().describe('The document ID'),
  }),
  z.object({
    op: z.literal('create'),
    title: z.string().describe('Document title'),
  }),
  z.object({
    op: z.literal('delete'),
    documentId: z.string().describe('The document ID to delete'),
  }),
  z.object({
    op: z.literal('rename'),
    documentId: z.string().describe('The document ID'),
    title: z.string().describe('New document title'),
  }),
]);

const PageOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('list'),
    documentId: z.string().describe('The document ID'),
  }),
  z.object({
    op: z.literal('create'),
    documentId: z.string().describe('The document ID'),
    name: z.string().describe('Name for the new page'),
    description: z.string().optional().describe('Optional page description'),
  }),
  z.object({
    op: z.literal('update'),
    documentId: z.string().describe('The document ID'),
    pageId: z.string().describe('The page ID to update'),
    name: z.string().optional().describe('New page name'),
    description: z.string().optional().describe('New page description'),
    order: z.number().optional().describe('New sort order'),
  }),
  z.object({
    op: z.literal('delete'),
    documentId: z.string().describe('The document ID'),
    pageId: z.string().describe('The page ID to delete'),
  }),
  z.object({
    op: z.literal('set_active'),
    documentId: z.string().describe('The document ID'),
    pageId: z.string().optional().describe('The page ID to set as active'),
    pageName: z.string().optional().describe('The page name to set as active (alternative to pageId, case-insensitive)'),
  }),
  z.object({
    op: z.literal('summary'),
    documentId: z.string().describe('The document ID'),
    pageId: z.string().optional().describe('Target a specific page for embedded data'),
    pageName: z.string().optional().describe('Target a specific page by name (alternative to pageId, case-insensitive)'),
    include: z.array(z.enum(['constructs', 'schemas'])).optional().describe('Embed additional data in the response: "constructs" (construct list + organizers for the target page), "schemas" (custom schema list)'),
  }),
]);

export const SchemaOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('list'),
    documentId: z.string().describe('The document ID'),
    output: z.enum(['compact', 'full']).optional().describe('Output mode: "compact" returns {type, displayName, groupId} only. Default: "full"'),
    groupId: z.string().optional().describe('Filter schemas by groupId'),
  }),
  z.object({
    op: z.literal('get'),
    documentId: z.string().describe('The document ID'),
    type: z.string().describe('The schema type to retrieve'),
  }),
  z.object({
    op: z.literal('create'),
    documentId: z.string().describe('The document ID'),
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
    documentId: z.string().describe('The document ID'),
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
    documentId: z.string().describe('The document ID'),
    type: z.string().describe('The schema type to delete'),
  }),
]);

export const SchemaMigrateOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('rename_field'),
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The schema type to modify'),
    oldName: z.string().describe('Current field name'),
    newName: z.string().describe('New field name'),
  }),
  z.object({
    op: z.literal('remove_field'),
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The schema type to modify'),
    fieldName: z.string().describe('Field name to remove'),
  }),
  z.object({
    op: z.literal('add_field'),
    documentId: z.string().describe('The document ID'),
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
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The schema type to modify'),
    oldPortId: z.string().describe('Current port ID'),
    newPortId: z.string().describe('New port ID'),
  }),
  z.object({
    op: z.literal('remove_port'),
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The schema type to modify'),
    portId: z.string().describe('Port ID to remove'),
  }),
  z.object({
    op: z.literal('add_port'),
    documentId: z.string().describe('The document ID'),
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
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The current schema type to rename'),
    newType: z.string().describe('The new schema type identifier'),
  }),
  z.object({
    op: z.literal('change_field_type'),
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The schema type to modify'),
    fieldName: z.string().describe('Field name to change type of'),
    newType: z.enum(['string', 'number', 'boolean', 'date', 'enum', 'resource']).describe('New data type'),
    force: z.boolean().optional().describe('Set to true to execute. Default (false/omitted) returns a dry-run preview.'),
    enumOptions: z.array(z.string()).optional().describe('Enum options (required when newType is enum)'),
  }),
  z.object({
    op: z.literal('narrow_enum'),
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The schema type to modify'),
    fieldName: z.string().describe('Enum field name'),
    newOptions: z.array(z.string()).describe('New enum options list'),
    valueMapping: z.record(z.string()).optional().describe('Map old values to new values (e.g. {"old_val": "new_val"})'),
  }),
  z.object({
    op: z.literal('change_port_type'),
    documentId: z.string().describe('The document ID'),
    schemaType: z.string().describe('The schema type to modify'),
    portId: z.string().describe('Port ID to change'),
    newPortType: z.string().describe('New port type reference'),
  }),
]);

export const ConstructOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('list'),
    documentId: z.string().describe('The document ID'),
    constructType: z.string().optional().describe('Filter by construct type (e.g. "service", "api-endpoint")'),
    pageId: z.string().optional().describe('Target a specific page instead of the active page'),
    output: z.enum(['compact', 'full']).optional().describe('Output detail level. "compact" (default): {semanticId, constructType, displayName, parentId}. "full": adds values, position, connections for each construct.'),
  }),
  z.object({
    op: z.literal('get'),
    documentId: z.string().describe('The document ID'),
    semanticId: z.string().describe('The semantic ID of the construct'),
    output: z.enum(['compact', 'full']).optional().describe('Output detail level. "compact": {semanticId, constructType, displayName, connections}. "full" (default): all field values, position, references.'),
  }),
  z.object({
    op: z.literal('create'),
    documentId: z.string().describe('The document ID'),
    constructType: z.string().describe('The type of construct to create'),
    values: z.record(z.unknown()).optional().describe('Initial field values'),
    x: z.number().optional().describe('X position on canvas'),
    y: z.number().optional().describe('Y position on canvas'),
    parentId: z.string().optional().describe('Organizer node ID — when set, position is relative to the organizer'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('create_bulk'),
    documentId: z.string().describe('The document ID'),
    constructs: z.array(z.object({
      constructType: z.string().describe('The type of construct to create'),
      values: z.record(z.unknown()).optional().describe('Initial field values'),
      x: z.number().optional().describe('X position on canvas (auto-placed if omitted)'),
      y: z.number().optional().describe('Y position on canvas (auto-placed if omitted)'),
      parentId: z.string().optional().describe('Organizer node ID'),
    })).describe('Array of constructs to create'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('update'),
    documentId: z.string().describe('The document ID'),
    semanticId: z.string().describe('The semantic ID of the construct'),
    values: z.record(z.unknown()).optional().describe('Field values to update'),
    instanceColor: z.string().nullable().optional().describe('Hex color override for node background (visual only)'),
  }),
  z.object({
    op: z.literal('delete'),
    documentId: z.string().describe('The document ID'),
    semanticId: z.string().describe('The semantic ID of the construct to delete'),
  }),
  z.object({
    op: z.literal('delete_bulk'),
    documentId: z.string().describe('The document ID'),
    semanticIds: z.array(z.string()).describe('Array of semantic IDs to delete'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('move'),
    documentId: z.string().describe('The document ID'),
    semanticId: z.string().describe('The semantic ID of the construct to move'),
    parentId: z.string().nullable().describe('Target organizer node ID, or null to detach from current organizer'),
    x: z.number().optional().describe('New X position (auto-converted if omitted)'),
    y: z.number().optional().describe('New Y position (auto-converted if omitted)'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
]);

export const ConnectionOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('connect'),
    documentId: z.string().describe('The document ID'),
    sourceSemanticId: z.string().describe('Source construct semantic ID'),
    sourcePortId: z.string().describe('Source port ID'),
    targetSemanticId: z.string().describe('Target construct semantic ID'),
    targetPortId: z.string().describe('Target port ID'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('disconnect'),
    documentId: z.string().describe('The document ID'),
    sourceSemanticId: z.string().describe('Source construct semantic ID'),
    sourcePortId: z.string().describe('Source port ID'),
    targetSemanticId: z.string().describe('Target construct semantic ID'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('connect_bulk'),
    documentId: z.string().describe('The document ID'),
    connections: z.array(z.object({
      sourceSemanticId: z.string().describe('Source construct semantic ID'),
      sourcePortId: z.string().describe('Source port ID'),
      targetSemanticId: z.string().describe('Target construct semantic ID'),
      targetPortId: z.string().describe('Target port ID'),
    })).describe('Array of connections to create'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
]);

const OrganizerOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create'),
    documentId: z.string().describe('The document ID'),
    name: z.string().describe('Organizer name'),
    color: z.string().optional().describe('Hex color (random from palette if omitted)'),
    x: z.number().optional().describe('X position on canvas'),
    y: z.number().optional().describe('Y position on canvas'),
    width: z.number().optional().describe('Width in pixels (default: 400)'),
    height: z.number().optional().describe('Height in pixels (default: 300)'),
    layout: z.enum(['freeform']).optional().describe('Layout strategy (default: freeform)'),
    description: z.string().optional().describe('Optional description'),
    attachedToSemanticId: z.string().optional().describe('Semantic ID of construct to attach this organizer to (creates a "wagon")'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('update'),
    documentId: z.string().describe('The document ID'),
    organizerId: z.string().describe('The organizer node ID'),
    name: z.string().optional().describe('New name'),
    color: z.string().optional().describe('New hex color'),
    collapsed: z.boolean().optional().describe('Collapse/expand the organizer'),
    layout: z.enum(['freeform']).optional().describe('New layout strategy'),
    description: z.string().optional().describe('New description'),
  }),
  z.object({
    op: z.literal('delete'),
    documentId: z.string().describe('The document ID'),
    organizerId: z.string().describe('The organizer node ID'),
    deleteMembers: z.boolean().optional().describe('If true, delete member constructs too. Default: false (detach members)'),
  }),
]);

const LayoutOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('flow'),
    documentId: z.string().describe('The document ID'),
    direction: z.enum(['TB', 'BT', 'LR', 'RL']).describe('Layout direction: TB (top-to-bottom), BT, LR, RL'),
    sourcePort: z.string().optional().describe('Port ID defining downstream flow (default: "flow-out")'),
    sinkPort: z.string().optional().describe('Port ID defining upstream flow (default: "flow-in")'),
    layerGap: z.number().optional().describe('Gap between layers in pixels (default: 250)'),
    nodeGap: z.number().optional().describe('Gap between nodes in same layer (default: 150)'),
    scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds to layout (default: "all")'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('arrange'),
    documentId: z.string().describe('The document ID'),
    strategy: z.enum(['grid', 'preserve', 'force']).optional().describe('Base layout strategy (default: "preserve")'),
    constraints: z.array(ArrangeConstraintSchema).describe('Declarative layout constraints applied sequentially'),
    scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds (default: "all")'),
    nodeGap: z.number().optional().describe('Default gap between nodes in px (default: 40)'),
    forceIterations: z.number().optional().describe('Iteration count for force strategy (default: 50)'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('pin'),
    documentId: z.string().describe('The document ID'),
    sourceOrganizerId: z.string().describe('The organizer being positioned'),
    targetOrganizerId: z.string().describe('The reference organizer'),
    direction: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']).describe('Where source sits relative to target'),
    gap: z.number().optional().describe('Spacing between organizers in pixels (default: 60)'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('list_pins'),
    documentId: z.string().describe('The document ID'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('remove_pin'),
    documentId: z.string().describe('The document ID'),
    constraintId: z.string().describe('The constraint ID to remove'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
  z.object({
    op: z.literal('apply_pins'),
    documentId: z.string().describe('The document ID'),
    gap: z.number().optional().describe('Default spacing between organizers in pixels (default: 60)'),
    pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
  }),
]);

const PackageOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('list'),
    documentId: z.string().describe('The document ID'),
  }),
  z.object({
    op: z.literal('get'),
    documentId: z.string().describe('The document ID'),
    packageId: z.string().describe('Schema package ID'),
  }),
  z.object({
    op: z.literal('create'),
    documentId: z.string().describe('The document ID'),
    name: z.string().describe('Package name'),
    description: z.string().optional().describe('Package description'),
    color: z.string().describe('Hex color for the package'),
  }),
  z.object({
    op: z.literal('list_standard'),
    documentId: z.string().describe('The document ID'),
  }),
  z.object({
    op: z.literal('apply'),
    documentId: z.string().describe('The document ID'),
    packageId: z.string().describe('Standard library package ID (e.g., "software-architecture", "bpmn")'),
  }),
  z.object({
    op: z.literal('check_drift'),
    documentId: z.string().describe('The document ID'),
    packageId: z.string().describe('Package ID to check for modifications'),
  }),
]);

// ─── Resource op schema ───────────────────────────────────────────────────────

export const ResourceOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('list'),
    documentId: z.string().describe('The document ID'),
  }),
  z.object({
    op: z.literal('get'),
    documentId: z.string().describe('The document ID'),
    resourceId: z.string().describe('Resource ID'),
  }),
  z.object({
    op: z.literal('create'),
    documentId: z.string().describe('The document ID'),
    name: z.string().describe('Resource name'),
    format: z.string().describe('Format identifier (e.g., "typescript", "json-schema", "openapi", "freeform")'),
    body: z.string().describe('Resource body content'),
  }),
  z.object({
    op: z.literal('update'),
    documentId: z.string().describe('The document ID'),
    resourceId: z.string().describe('Resource ID'),
    name: z.string().optional().describe('New name'),
    format: z.string().optional().describe('New format'),
    body: z.string().optional().describe('New body content (updates working copy, does NOT create a version)'),
  }),
  z.object({
    op: z.literal('delete'),
    documentId: z.string().describe('The document ID'),
    resourceId: z.string().describe('Resource ID to delete'),
  }),
  z.object({
    op: z.literal('publish'),
    documentId: z.string().describe('The document ID'),
    resourceId: z.string().describe('Resource ID'),
    label: z.string().optional().describe('Version label (e.g., "Added billing address")'),
  }),
  z.object({
    op: z.literal('history'),
    documentId: z.string().describe('The document ID'),
    resourceId: z.string().describe('Resource ID'),
  }),
  z.object({
    op: z.literal('diff'),
    documentId: z.string().describe('The document ID'),
    resourceId: z.string().describe('Resource ID'),
    fromVersionId: z.string().optional().describe('Version ID to compare from (omit for current working copy)'),
    toVersionId: z.string().optional().describe('Version ID to compare to (omit for current working copy)'),
  }),
]);

// ─── Tool definitions ─────────────────────────────────────────────────────────

export function getToolDefinitions() {
  return [
    {
      name: 'carta_document',
      description: `Document operations.\nops: list (all documents), list_active (documents with active browser connections), get (by ID), create (new document with title), delete (by ID), rename (change title)`,
      inputSchema: zodToJsonSchema(DocumentOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_page',
      description: `Page operations.\nops: list (all pages + activePage ID), create (new page with name), update (rename, description, order), delete (must have >1 page), set_active (switch active page — returns constructs/organizers/schemas for orientation), summary (compact document summary with counts; accepts include=["constructs","schemas"] for embedded data; accepts pageName alternative)`,
      inputSchema: zodToJsonSchema(PageOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_schema',
      description: `Schema operations.\nops: list (all schemas; output="compact" reduces tokens; filter by groupId), get (schema by type), create (new custom schema with fields/ports — see below), update (non-breaking properties only: color, displayName, nodeShape, fieldUpdates, etc.), delete (by type).\n\nFor op:create — Required: documentId, type, displayName, color. Fields array: [{name, label, type: string|number|boolean|date|enum, options?, displayTier?: pill|summary, displayHint?, placeholder?, default?, semanticDescription?, displayOrder?}]. Ports array (optional): [{id, portType: flow-in|flow-out|parent|child|symmetric|intercept|relay, label, semanticDescription?}]. Smart defaults: auto displayTier for primary fields, default ports if none specified.`,
      inputSchema: zodToJsonSchema(SchemaOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_schema_migrate',
      description: `Schema migration operations (structural changes with instance fixup).\nops: rename_field (rename + migrate all values), remove_field (delete + clear instances), add_field (add new field; optionally populate existing), rename_port (update all edges), remove_port (delete + disconnect edges), add_port (no fixup needed), rename_type (update all instances + cross-refs), change_field_type (dry-run by default; set force=true to execute), narrow_enum (update enum options + remap values), change_port_type (disconnects incompatible edges)`,
      inputSchema: zodToJsonSchema(SchemaMigrateOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_construct',
      description: `Construct (node) operations.\nops: list (all constructs; filter by constructType; output="full" includes values/position/connections), get (by semanticId; output="compact" is lightweight), create (new instance; semanticId auto-generated; values keyed by field name; parentId for organizer-relative placement), create_bulk (multiple in one transaction; all-or-nothing; nodes without x/y auto-placed), update (partial values or instanceColor), delete (by semanticId), delete_bulk (multiple in one transaction; cleans up edges/wagons), move (into/out of organizer; parentId=null to detach; preserves connections)`,
      inputSchema: zodToJsonSchema(ConstructOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_connection',
      description: `Connection operations.\nops: connect (link two constructs via ports; accepts pageId), disconnect (remove connection between constructs), connect_bulk (multiple connections; best-effort; individual failures reported)`,
      inputSchema: zodToJsonSchema(ConnectionOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_organizer',
      description: `Organizer operations.\nops: create (new visual grouping container; accepts attachedToSemanticId to create a "wagon"), update (name, color, collapsed, layout, description), delete (detaches members by default; deleteMembers=true also deletes them)`,
      inputSchema: zodToJsonSchema(OrganizerOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_layout',
      description: `Layout operations.\nops: flow (topological DAG layout along TB/BT/LR/RL direction; uses port connections for hierarchy), arrange (declarative constraint-based layout; strategies: grid/preserve/force; constraints: align, order, spacing, group, distribute, position, flow), pin (declare relative positioning between organizers; directions: N/NE/E/SE/S/SW/W/NW), list_pins (list all pin constraints for a page), remove_pin (remove a pin constraint by ID), apply_pins (resolve and apply all pin constraints; returns updated count + warnings)`,
      inputSchema: zodToJsonSchema(LayoutOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_package',
      description: `Schema package operations.\nops: list (packages with member counts), get (package with schemas/ports/groups/relationships), create (new package; schemas assigned via packageId on schema), list_standard (all standard library packages with status: available/loaded/modified), apply (load a standard library package by ID; idempotent), check_drift (compare loaded package against its snapshot to detect modifications)`,
      inputSchema: zodToJsonSchema(PackageOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_compile',
      description: 'Compile a document to AI-readable output',
      inputSchema: zodToJsonSchema(DocumentIdSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_batch_mutate',
      description: `Execute heterogeneous operations in a single transaction. Supports: create, update, delete, connect, disconnect, move. Optionally accepts pageId to target a specific page.

Use "@N" placeholder syntax to reference results from earlier operations in the same batch. Example:
  [
    { "op": "create", "constructType": "service", "values": { "name": "Auth" } },
    { "op": "create", "constructType": "service", "values": { "name": "Gateway" } },
    { "op": "connect", "sourceSemanticId": "@0", "sourcePortId": "flow-out", "targetSemanticId": "@1", "targetPortId": "flow-in" }
  ]
Here "@0" resolves to the semanticId generated by the create at index 0.

For create/update ops, values is a Record keyed by field name from the schema. Use carta_schema op:get to discover field names. semanticId is auto-generated for create ops; use "@N" placeholders to reference it in later ops.`,
      inputSchema: zodToJsonSchema(BatchMutateSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_list_port_types',
      description: 'List available port types and their compatibility rules',
      inputSchema: zodToJsonSchema(DocumentIdSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_rebuild_page',
      description: `Rebuild all Yjs data for a page by round-tripping through plain objects. Flushes corrupt Y.Map state, orphaned keys, and stale references while preserving node IDs, positions, fields, edges, and organizer membership. Debug tool — use when a page has rendering issues that don't appear on freshly-created pages.`,
      inputSchema: zodToJsonSchema(RebuildPageSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_resource',
      description: `Resource operations. Resources are versioned data contracts (API specs, TypeScript types, schemas) stored at the document level.\nops: list (all resources), get (resource by ID with current body), create (new resource with name/format/body), update (edit working copy — does NOT create a version), delete (remove resource), publish (snapshot current body as a new version), history (version timeline), diff (compare versions or working copy vs version)`,
      inputSchema: zodToJsonSchema(ResourceOpSchema, { $refStrategy: 'none' }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
  ];
}

// ─── Tool handler types ───────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolHandlers {
  carta_document: ToolHandler;
  carta_page: ToolHandler;
  carta_schema: ToolHandler;
  carta_schema_migrate: ToolHandler;
  carta_construct: ToolHandler;
  carta_connection: ToolHandler;
  carta_organizer: ToolHandler;
  carta_layout: ToolHandler;
  carta_package: ToolHandler;
  carta_compile: ToolHandler;
  carta_batch_mutate: ToolHandler;
  carta_list_port_types: ToolHandler;
  carta_rebuild_page: ToolHandler;
  carta_resource: ToolHandler;
  [key: string]: ToolHandler;
}

export interface ToolHandlerOptions {
  serverUrl?: string;
}

// ─── Tool handlers ────────────────────────────────────────────────────────────

export function createToolHandlers(options: ToolHandlerOptions = {}): ToolHandlers {
  const apiUrl = options.serverUrl || process.env.CARTA_SERVER_URL || process.env.CARTA_COLLAB_API_URL || 'http://localhost:1234';

  async function apiRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ data?: T; error?: string }> {
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json()) as T & { error?: string };

      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}: ${response.statusText}` };
      }

      return { data };
    } catch (error) {
      return {
        error: `Failed to connect to document server at ${apiUrl}. Is it running? Start it with: pnpm document-server`,
      };
    }
  }

  return {
    carta_document: async (args) => {
      const input = DocumentOpSchema.parse(args);
      switch (input.op) {
        case 'list': {
          const result = await apiRequest<{ documents: unknown[] }>('GET', '/api/documents');
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'list_active': {
          const result = await apiRequest<{ documents: Array<{ documentId: string; clientCount: number }> }>('GET', '/api/rooms');
          if (result.error) return { error: result.error, hint: 'Start the document server with: pnpm document-server' };
          return result.data;
        }
        case 'get': {
          const result = await apiRequest<{ document: unknown }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'create': {
          const result = await apiRequest<{ document: unknown }>('POST', '/api/documents', { title: input.title });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'delete': {
          const result = await apiRequest<{ deleted: boolean }>('DELETE', `/api/documents/${encodeURIComponent(input.documentId)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'rename': {
          const result = await apiRequest<{ document: unknown }>('PATCH', `/api/documents/${encodeURIComponent(input.documentId)}`, { title: input.title });
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_page: async (args) => {
      const input = PageOpSchema.parse(args);
      switch (input.op) {
        case 'list': {
          const result = await apiRequest<{ pages: unknown[]; activePage: string }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/pages`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'create': {
          const result = await apiRequest<{ page: unknown }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/pages`, { name: input.name, description: input.description });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'update': {
          const result = await apiRequest<{ page: unknown }>('PATCH', `/api/documents/${encodeURIComponent(input.documentId)}/pages/${encodeURIComponent(input.pageId)}`, { name: input.name, description: input.description, order: input.order });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'delete': {
          const result = await apiRequest<{ deleted: boolean }>('DELETE', `/api/documents/${encodeURIComponent(input.documentId)}/pages/${encodeURIComponent(input.pageId)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'set_active': {
          const result = await apiRequest<{
            activePage: string;
            page: unknown;
            constructs: unknown[];
            organizers: unknown[];
            edgeCount: number;
            customSchemas: unknown[];
          }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/pages/active`, { pageId: input.pageId, pageName: input.pageName });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'summary': {
          const params = new URLSearchParams();
          if (input.pageId) params.set('pageId', input.pageId);
          if (input.pageName) params.set('pageName', input.pageName);
          if (input.include && input.include.length > 0) params.set('include', input.include.join(','));
          const qs = params.toString() ? `?${params.toString()}` : '';
          const result = await apiRequest<unknown>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/summary${qs}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_schema: async (args) => {
      const input = SchemaOpSchema.parse(args);
      switch (input.op) {
        case 'list': {
          const params = new URLSearchParams();
          if (input.output) params.set('output', input.output);
          if (input.groupId) params.set('groupId', input.groupId);
          const qs = params.toString() ? `?${params.toString()}` : '';
          const result = await apiRequest<{ schemas: unknown[] }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/schemas${qs}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'get': {
          const result = await apiRequest<{ schema: unknown }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.type)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'create': {
          const result = await apiRequest<{ schema: unknown }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas`, {
            type: input.type,
            displayName: input.displayName,
            color: input.color,
            semanticDescription: input.semanticDescription,
            groupId: input.groupId,
            packageId: input.packageId,
            instanceColors: input.instanceColors,
            fields: input.fields,
            ports: input.ports,
          });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'update': {
          const { documentId, type, op: _op, ...updates } = input;
          const result = await apiRequest<{ schema: unknown }>('PATCH', `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(type)}`, updates);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'delete': {
          const result = await apiRequest<{ deleted: boolean }>('DELETE', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.type)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_schema_migrate: async (args) => {
      const input = SchemaMigrateOpSchema.parse(args);
      switch (input.op) {
        case 'rename_field': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'renameField', oldName: input.oldName, newName: input.newName });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'remove_field': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'removeField', fieldName: input.fieldName });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'add_field': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'addField', field: input.field, defaultValue: input.defaultValue });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'rename_port': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'renamePort', oldPortId: input.oldPortId, newPortId: input.newPortId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'remove_port': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'removePort', portId: input.portId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'add_port': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'addPort', portConfig: input.portConfig });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'rename_type': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'renameSchemaType', newType: input.newType });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'change_field_type': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'changeFieldType', fieldName: input.fieldName, newType: input.newType, force: input.force, enumOptions: input.enumOptions });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'narrow_enum': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'narrowEnumOptions', fieldName: input.fieldName, newOptions: input.newOptions, valueMapping: input.valueMapping });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'change_port_type': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/schemas/${encodeURIComponent(input.schemaType)}/migrate`, { operation: 'changePortType', portId: input.portId, newPortType: input.newPortType });
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_construct: async (args) => {
      const input = ConstructOpSchema.parse(args);
      switch (input.op) {
        case 'list': {
          const params = new URLSearchParams();
          if (input.constructType) params.set('type', input.constructType);
          if (input.pageId) params.set('pageId', input.pageId);
          if (input.output) params.set('output', input.output);
          const qs = params.toString() ? `?${params.toString()}` : '';
          const result = await apiRequest<{ constructs: unknown[]; organizers: unknown[] }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/constructs${qs}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'get': {
          const outputQs = input.output ? `?output=${input.output}` : '';
          const result = await apiRequest<{ construct: unknown }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/constructs/${encodeURIComponent(input.semanticId)}${outputQs}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'create': {
          const result = await apiRequest<{ construct: unknown }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/constructs`, { constructType: input.constructType, values: input.values, x: input.x, y: input.y, parentId: input.parentId, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'create_bulk': {
          const result = await apiRequest<{ constructs: unknown[] }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/constructs/bulk`, { constructs: input.constructs, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'update': {
          const result = await apiRequest<{ construct: unknown }>('PATCH', `/api/documents/${encodeURIComponent(input.documentId)}/constructs/${encodeURIComponent(input.semanticId)}`, { values: input.values, instanceColor: input.instanceColor });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'delete': {
          const result = await apiRequest<{ deleted: boolean }>('DELETE', `/api/documents/${encodeURIComponent(input.documentId)}/constructs/${encodeURIComponent(input.semanticId)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'delete_bulk': {
          const result = await apiRequest<{ results: unknown[] }>('DELETE', `/api/documents/${encodeURIComponent(input.documentId)}/constructs/bulk`, { semanticIds: input.semanticIds, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'move': {
          const result = await apiRequest<{ construct: unknown; parentId: string | null }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/constructs/${encodeURIComponent(input.semanticId)}/move`, { parentId: input.parentId, x: input.x, y: input.y, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_connection: async (args) => {
      const input = ConnectionOpSchema.parse(args);
      switch (input.op) {
        case 'connect': {
          const result = await apiRequest<{ edge: unknown }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/connections`, {
            sourceSemanticId: input.sourceSemanticId,
            sourcePortId: input.sourcePortId,
            targetSemanticId: input.targetSemanticId,
            targetPortId: input.targetPortId,
            pageId: input.pageId,
          });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'disconnect': {
          const result = await apiRequest<{ disconnected: boolean }>('DELETE', `/api/documents/${encodeURIComponent(input.documentId)}/connections`, {
            sourceSemanticId: input.sourceSemanticId,
            sourcePortId: input.sourcePortId,
            targetSemanticId: input.targetSemanticId,
            pageId: input.pageId,
          });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'connect_bulk': {
          const result = await apiRequest<{ results: unknown[] }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/connections/bulk`, { connections: input.connections, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_organizer: async (args) => {
      const input = OrganizerOpSchema.parse(args);
      switch (input.op) {
        case 'create': {
          const result = await apiRequest<{ organizer: unknown }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/organizers`, {
            name: input.name,
            color: input.color,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            layout: input.layout,
            description: input.description,
            attachedToSemanticId: input.attachedToSemanticId,
            pageId: input.pageId,
          });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'update': {
          const result = await apiRequest<{ organizer: unknown }>('PATCH', `/api/documents/${encodeURIComponent(input.documentId)}/organizers/${encodeURIComponent(input.organizerId)}`, {
            name: input.name,
            color: input.color,
            collapsed: input.collapsed,
            layout: input.layout,
            description: input.description,
          });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'delete': {
          const params = input.deleteMembers ? '?deleteMembers=true' : '';
          const result = await apiRequest<{ deleted: boolean }>('DELETE', `/api/documents/${encodeURIComponent(input.documentId)}/organizers/${encodeURIComponent(input.organizerId)}${params}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_layout: async (args) => {
      const input = LayoutOpSchema.parse(args);
      switch (input.op) {
        case 'flow': {
          const result = await apiRequest<{ updated: number; layers: Record<string, number> }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/layout/flow`, { direction: input.direction, sourcePort: input.sourcePort, sinkPort: input.sinkPort, layerGap: input.layerGap, nodeGap: input.nodeGap, scope: input.scope, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'arrange': {
          const result = await apiRequest<{ updated: number; constraintsApplied: number }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/layout/arrange`, { strategy: input.strategy, constraints: input.constraints, scope: input.scope, nodeGap: input.nodeGap, forceIterations: input.forceIterations, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'pin': {
          const result = await apiRequest<{ constraint: unknown }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/pin-constraints`, { sourceOrganizerId: input.sourceOrganizerId, targetOrganizerId: input.targetOrganizerId, direction: input.direction, gap: input.gap, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'list_pins': {
          const params = new URLSearchParams();
          if (input.pageId) params.set('pageId', input.pageId);
          const queryString = params.toString();
          const url = `/api/documents/${encodeURIComponent(input.documentId)}/pin-constraints${queryString ? '?' + queryString : ''}`;
          const result = await apiRequest<{ constraints: unknown[] }>('GET', url);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'remove_pin': {
          const params = new URLSearchParams();
          if (input.pageId) params.set('pageId', input.pageId);
          const queryString = params.toString();
          const url = `/api/documents/${encodeURIComponent(input.documentId)}/pin-constraints/${encodeURIComponent(input.constraintId)}${queryString ? '?' + queryString : ''}`;
          const result = await apiRequest<{ success: boolean }>('DELETE', url);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'apply_pins': {
          const result = await apiRequest<{ updated: number; warnings: string[] }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/layout/pin`, { gap: input.gap, pageId: input.pageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_package: async (args) => {
      const input = PackageOpSchema.parse(args);
      switch (input.op) {
        case 'list': {
          const result = await apiRequest<{ packages: unknown[] }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/packages`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'get': {
          const result = await apiRequest<unknown>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/packages/${encodeURIComponent(input.packageId)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'create': {
          const result = await apiRequest<{ package: unknown }>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/packages`, { name: input.name, description: input.description, color: input.color });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'list_standard': {
          const result = await apiRequest<{ packages: unknown[] }>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/standard-packages`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'apply': {
          const result = await apiRequest<unknown>('POST', `/api/documents/${encodeURIComponent(input.documentId)}/standard-packages/apply`, { packageId: input.packageId });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'check_drift': {
          const result = await apiRequest<unknown>('GET', `/api/documents/${encodeURIComponent(input.documentId)}/standard-packages/${encodeURIComponent(input.packageId)}/drift`);
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },

    carta_compile: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ output: string }>('GET', `/api/documents/${encodeURIComponent(documentId)}/compile`);
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_batch_mutate: async (args) => {
      const { documentId, operations, pageId } = BatchMutateSchema.parse(args);
      const result = await apiRequest<{ results: unknown[] }>('POST', `/api/documents/${encodeURIComponent(documentId)}/batch`, { operations, pageId });
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_port_types: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ portTypes: unknown[] }>('GET', `/api/documents/${encodeURIComponent(documentId)}/port-types`);
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rebuild_page: async (args) => {
      const { documentId, pageId } = RebuildPageSchema.parse(args);
      const result = await apiRequest<{ nodesRebuilt: number; edgesRebuilt: number; orphansDropped: string[] }>('POST', `/api/documents/${encodeURIComponent(documentId)}/rebuild-page`, { pageId });
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_resource: async (args) => {
      const input = ResourceOpSchema.parse(args);
      const docId = encodeURIComponent(input.documentId);
      switch (input.op) {
        case 'list': {
          const result = await apiRequest<{ resources: unknown[] }>('GET', `/api/documents/${docId}/resources`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'get': {
          const result = await apiRequest<{ resource: unknown }>('GET', `/api/documents/${docId}/resources/${encodeURIComponent(input.resourceId)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'create': {
          const result = await apiRequest<{ resource: unknown }>('POST', `/api/documents/${docId}/resources`, { name: input.name, format: input.format, body: input.body });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'update': {
          const result = await apiRequest<{ resource: unknown }>('PATCH', `/api/documents/${docId}/resources/${encodeURIComponent(input.resourceId)}`, { name: input.name, format: input.format, body: input.body });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'delete': {
          const result = await apiRequest<{ deleted: boolean }>('DELETE', `/api/documents/${docId}/resources/${encodeURIComponent(input.resourceId)}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'publish': {
          const result = await apiRequest<{ version: unknown }>('POST', `/api/documents/${docId}/resources/${encodeURIComponent(input.resourceId)}/publish`, { label: input.label });
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'history': {
          const result = await apiRequest<{ versions: unknown[] }>('GET', `/api/documents/${docId}/resources/${encodeURIComponent(input.resourceId)}/history`);
          if (result.error) return { error: result.error };
          return result.data;
        }
        case 'diff': {
          const params = new URLSearchParams();
          if (input.fromVersionId) params.set('from', input.fromVersionId);
          if (input.toVersionId) params.set('to', input.toVersionId);
          const qs = params.toString() ? `?${params.toString()}` : '';
          const result = await apiRequest<unknown>('GET', `/api/documents/${docId}/resources/${encodeURIComponent(input.resourceId)}/diff${qs}`);
          if (result.error) return { error: result.error };
          return result.data;
        }
      }
    },
  };
}
