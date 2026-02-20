/**
 * MCP Tool definitions for Carta
 *
 * All tools communicate with the document server via HTTP REST API.
 */

import { z } from 'zod';
import { portRegistry as defaultPortRegistry } from '@carta/domain';

// Schemas for tool inputs
const DocumentIdSchema = z.object({
  documentId: z.string().describe('The document ID'),
});

const CreateDocumentSchema = z.object({
  title: z.string().describe('Document title'),
});

const DeleteDocumentSchema = z.object({
  documentId: z.string().describe('The document ID to delete'),
});

const RenameDocumentSchema = z.object({
  documentId: z.string().describe('The document ID'),
  title: z.string().describe('New document title'),
});

const CreatePageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  name: z.string().describe('Name for the new page'),
  description: z.string().optional().describe('Optional page description'),
});

const RenamePageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  pageId: z.string().describe('The page ID to update'),
  name: z.string().optional().describe('New page name'),
  description: z.string().optional().describe('New page description'),
  order: z.number().optional().describe('New sort order'),
});

const DeletePageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  pageId: z.string().describe('The page ID to delete'),
});

const SetActivePageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  pageId: z.string().optional().describe('The page ID to set as active'),
  pageName: z.string().optional().describe('The page name to set as active (alternative to pageId, case-insensitive)'),
});

const DocumentSummarySchema = z.object({
  documentId: z.string().describe('The document ID'),
  pageId: z.string().optional().describe('Target a specific page for embedded data'),
  pageName: z.string().optional().describe('Target a specific page by name (alternative to pageId, case-insensitive)'),
  include: z.array(z.enum(['constructs', 'schemas'])).optional().describe('Embed additional data in the response: "constructs" (construct list + organizers for the target page), "schemas" (custom schema list)'),
});

const ListSchemasSchema = z.object({
  documentId: z.string().describe('The document ID'),
  output: z.enum(['compact', 'full']).optional().describe('Output mode: "compact" returns {type, displayName, groupId} only. Default: "full"'),
  groupId: z.string().optional().describe('Filter schemas by groupId'),
});

const ListConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  constructType: z.string().optional().describe('Filter by construct type (e.g. "service", "api-endpoint")'),
  pageId: z.string().optional().describe('Target a specific page instead of the active page'),
  output: z.enum(['compact', 'full']).optional().describe('Output detail level. "compact" (default): {semanticId, constructType, displayName, parentId}. "full": adds values, position, connections for each construct.'),
});

const CreateConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  constructType: z.string().describe('The type of construct to create'),
  values: z.record(z.unknown()).optional().describe('Initial field values'),
  x: z.number().optional().describe('X position on canvas'),
  y: z.number().optional().describe('Y position on canvas'),
  parentId: z.string().optional().describe('Organizer node ID — when set, position is relative to the organizer'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const UpdateConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  semanticId: z.string().describe('The semantic ID of the construct'),
  values: z.record(z.unknown()).optional().describe('Field values to update'),
  instanceColor: z.string().nullable().optional().describe('Hex color override for node background (visual only)'),
});

const DeleteConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  semanticId: z.string().describe('The semantic ID of the construct to delete'),
});

const GetConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  semanticId: z.string().describe('The semantic ID of the construct'),
  output: z.enum(['compact', 'full']).optional().describe('Output detail level. "compact": {semanticId, constructType, displayName, connections}. "full" (default): all field values, position, references.'),
});

const ConnectConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  sourceSemanticId: z.string().describe('Source construct semantic ID'),
  sourcePortId: z.string().describe('Source port ID'),
  targetSemanticId: z.string().describe('Target construct semantic ID'),
  targetPortId: z.string().describe('Target port ID'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const DisconnectConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  sourceSemanticId: z.string().describe('Source construct semantic ID'),
  sourcePortId: z.string().describe('Source port ID'),
  targetSemanticId: z.string().describe('Target construct semantic ID'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const CreateOrganizerSchema = z.object({
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
});

const UpdateOrganizerSchema = z.object({
  documentId: z.string().describe('The document ID'),
  organizerId: z.string().describe('The organizer node ID'),
  name: z.string().optional().describe('New name'),
  color: z.string().optional().describe('New hex color'),
  collapsed: z.boolean().optional().describe('Collapse/expand the organizer'),
  layout: z.enum(['freeform']).optional().describe('New layout strategy'),
  description: z.string().optional().describe('New description'),
});

const DeleteOrganizerSchema = z.object({
  documentId: z.string().describe('The document ID'),
  organizerId: z.string().describe('The organizer node ID'),
  deleteMembers: z.boolean().optional().describe('If true, delete member constructs too. Default: false (detach members)'),
});

const BulkCreateConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  constructs: z.array(z.object({
    constructType: z.string().describe('The type of construct to create'),
    values: z.record(z.unknown()).optional().describe('Initial field values'),
    x: z.number().optional().describe('X position on canvas (auto-placed if omitted)'),
    y: z.number().optional().describe('Y position on canvas (auto-placed if omitted)'),
    parentId: z.string().optional().describe('Organizer node ID'),
  })).describe('Array of constructs to create'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const BulkConnectSchema = z.object({
  documentId: z.string().describe('The document ID'),
  connections: z.array(z.object({
    sourceSemanticId: z.string().describe('Source construct semantic ID'),
    sourcePortId: z.string().describe('Source port ID'),
    targetSemanticId: z.string().describe('Target construct semantic ID'),
    targetPortId: z.string().describe('Target port ID'),
  })).describe('Array of connections to create'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const MoveConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  semanticId: z.string().describe('The semantic ID of the construct to move'),
  parentId: z.string().nullable().describe('Target organizer node ID, or null to detach from current organizer'),
  x: z.number().optional().describe('New X position (auto-converted if omitted)'),
  y: z.number().optional().describe('New Y position (auto-converted if omitted)'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const DeleteConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  semanticIds: z.array(z.string()).describe('Array of semantic IDs to delete'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const RebuildPageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

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

const FlowLayoutSchema = z.object({
  documentId: z.string().describe('The document ID'),
  direction: z.enum(['TB', 'BT', 'LR', 'RL']).describe('Layout direction: TB (top-to-bottom), BT, LR, RL'),
  sourcePort: z.string().optional().describe('Port ID defining downstream flow (default: "flow-out")'),
  sinkPort: z.string().optional().describe('Port ID defining upstream flow (default: "flow-in")'),
  layerGap: z.number().optional().describe('Gap between layers in pixels (default: 250)'),
  nodeGap: z.number().optional().describe('Gap between nodes in same layer (default: 150)'),
  scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds to layout (default: "all")'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

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

const ArrangeLayoutSchema = z.object({
  documentId: z.string().describe('The document ID'),
  strategy: z.enum(['grid', 'preserve', 'force']).optional().describe('Base layout strategy (default: "preserve")'),
  constraints: z.array(ArrangeConstraintSchema).describe('Declarative layout constraints applied sequentially'),
  scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds (default: "all")'),
  nodeGap: z.number().optional().describe('Default gap between nodes in px (default: 40)'),
  forceIterations: z.number().optional().describe('Iteration count for force strategy (default: 50)'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const PinConstraintSchema = z.object({
  documentId: z.string().describe('The document ID'),
  sourceOrganizerId: z.string().describe('The organizer being positioned'),
  targetOrganizerId: z.string().describe('The reference organizer'),
  direction: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']).describe('Where source sits relative to target'),
  gap: z.number().optional().describe('Spacing between organizers in pixels (default: 60)'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const ListPinConstraintsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const RemovePinConstraintSchema = z.object({
  documentId: z.string().describe('The document ID'),
  constraintId: z.string().describe('The constraint ID to remove'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const ApplyPinLayoutSchema = z.object({
  documentId: z.string().describe('The document ID'),
  gap: z.number().optional().describe('Default spacing between organizers in pixels (default: 60)'),
  pageId: z.string().optional().describe('Target page ID (uses active page if omitted)'),
});

const CreateSchemaInputSchema = z.object({
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
        type: z.enum(['string', 'number', 'boolean', 'date', 'enum']),
        semanticDescription: z.string().optional(),
        options: z.array(z.object({ value: z.string(), semanticDescription: z.string().optional() })).optional(),
        default: z.unknown().optional(),
        placeholder: z.string().optional(),
        displayHint: z.enum(['multiline', 'code', 'password', 'url', 'color']).optional(),
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
});

// Schema Migration Schemas
const RenameFieldSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  oldName: z.string().describe('Current field name'),
  newName: z.string().describe('New field name'),
});

const RemoveFieldSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  fieldName: z.string().describe('Field name to remove'),
});

const AddFieldSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  field: z.object({
    name: z.string().describe('Field name'),
    type: z.enum(['string', 'number', 'boolean', 'enum', 'url']).describe('Field data type'),
    options: z.array(z.string()).optional().describe('Enum options (required if type is enum)'),
    label: z.string().optional().describe('Display label'),
    displayTier: z.enum(['pill', 'summary']).optional(),
    semanticDescription: z.string().optional(),
  }).describe('Field definition'),
  defaultValue: z.unknown().optional().describe('Default value to populate on existing instances'),
});

const RenamePortSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  oldPortId: z.string().describe('Current port ID'),
  newPortId: z.string().describe('New port ID'),
});

const RemovePortSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  portId: z.string().describe('Port ID to remove'),
});

const RenameSchemaTypeSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The current schema type to rename'),
  newType: z.string().describe('The new schema type identifier'),
});

const ChangeFieldTypeSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  fieldName: z.string().describe('Field name to change type of'),
  newType: z.enum(['string', 'number', 'boolean', 'date', 'enum']).describe('New data type'),
  force: z.boolean().optional().describe('Set to true to execute. Default (false/omitted) returns a dry-run preview.'),
  enumOptions: z.array(z.string()).optional().describe('Enum options (required when newType is enum)'),
});

const NarrowEnumOptionsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  fieldName: z.string().describe('Enum field name'),
  newOptions: z.array(z.string()).describe('New enum options list'),
  valueMapping: z.record(z.string()).optional().describe('Map old values to new values (e.g. {"old_val": "new_val"})'),
});

const AddPortSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  portConfig: z.object({
    id: z.string().describe('Unique port ID within the schema'),
    portType: z.string().describe('Port type reference (e.g. flow-in, flow-out)'),
    label: z.string().describe('Display label for the port'),
    suggestedTypes: z.array(z.string()).optional(),
  }).describe('Port configuration to add'),
});

const ChangePortTypeSchema = z.object({
  documentId: z.string().describe('The document ID'),
  schemaType: z.string().describe('The schema type to modify'),
  portId: z.string().describe('Port ID to change'),
  newPortType: z.string().describe('New port type reference'),
});

// Schema Package & Library Schemas
const CreatePackageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  name: z.string().describe('Package name'),
  description: z.string().optional().describe('Package description'),
  color: z.string().describe('Hex color for the package'),
});

const ListPackagesSchema = z.object({
  documentId: z.string().describe('The document ID'),
});

const GetPackageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  packageId: z.string().describe('Schema package ID'),
});

const ListStandardPackagesSchema = z.object({
  documentId: z.string().describe('The document ID'),
});

const ApplyStandardPackageSchema = z.object({
  documentId: z.string().describe('The document ID'),
  packageId: z.string().describe('Standard library package ID (e.g., "software-architecture", "bpmn")'),
});

const CheckPackageDriftSchema = z.object({
  documentId: z.string().describe('The document ID'),
  packageId: z.string().describe('Package ID to check for modifications'),
});

/**
 * Tool definitions for MCP
 */
export function getToolDefinitions() {
  return [
    {
      name: 'carta_list_active_documents',
      description: 'List documents with active browser connections (Yjs collaboration mode only)',
      inputSchema: z.object({}).shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_list_documents',
      description: 'List all Carta documents',
      inputSchema: z.object({}).shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_get_document',
      description: 'Get a Carta document by ID',
      inputSchema: DocumentIdSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_create_document',
      description: 'Create a new Carta document',
      inputSchema: CreateDocumentSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_delete_document',
      description: 'Delete a Carta document by ID',
      inputSchema: DeleteDocumentSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_rename_document',
      description: 'Rename a Carta document',
      inputSchema: RenameDocumentSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_list_pages',
      description: 'List all pages in a document (returns pages array and activePage ID)',
      inputSchema: DocumentIdSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_create_page',
      description: 'Create a new page in a document',
      inputSchema: CreatePageSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_rename_page',
      description: 'Rename or update a page (name, description, order)',
      inputSchema: RenamePageSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_delete_page',
      description: 'Delete a page (document must have more than one page)',
      inputSchema: DeletePageSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_set_active_page',
      description: 'Switch the active page. Returns enriched context: page info, constructs, organizers, edge count, and custom schemas — so you can orient in a single call. Accepts pageName as alternative to pageId.',
      inputSchema: SetActivePageSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_list_schemas',
      description: 'List all available construct schemas (built-in and custom). Use output="compact" to reduce token usage.',
      inputSchema: ListSchemasSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_get_schema',
      description: 'Get a construct schema by type',
      inputSchema: z.object({
        documentId: z.string(),
        type: z.string(),
      }).shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_create_schema',
      description: `Create a custom construct schema.

Required top-level params: documentId (string), type (string, unique identifier), displayName (string), color (string, hex).
Optional top-level params: semanticDescription (string), groupId (string), instanceColors (boolean, default false — enables per-instance color palette picker).

Fields array (each field object):
- name (string, required): field identifier
- label (string, required): display label
- type (enum, required): 'string'|'number'|'boolean'|'date'|'enum'
- options (array of {value: string, semanticDescription?: string} objects, required for enum type)
- displayTier (enum, optional): 'pill' (node title, max 1 per schema) | 'summary' (shown on canvas). Omit for inspector-only fields.
- displayHint (enum, optional): 'multiline'|'code'|'password'|'url'|'color'
- placeholder (string, optional)
- default (any, optional)
- semanticDescription (string, optional)
- displayOrder (number, optional, default 0)

Ports array (optional, each port object):
- id (string, required): unique port identifier
- portType (enum, required): 'flow-in'|'flow-out'|'parent'|'child'|'symmetric'|'intercept'|'relay'
- label (string, required): display label
- semanticDescription (string, optional)

Smart defaults:
- Primary fields (name, title, label, summary, condition) auto-get displayTier='summary'
- If no ports specified, adds default ports: flow-in (left), flow-out (right), parent (bottom), child (top)
- instanceColors defaults to false (no color picker); set to true to enable a per-instance palette picker`,
      inputSchema: CreateSchemaInputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_update_schema',
      description: 'Update non-breaking properties of a custom schema (color, displayName, nodeShape, etc). Cannot change type, fields array, or ports array — use migration operations for structural changes. Supports field metadata updates via fieldUpdates map.',
      inputSchema: z.object({
        documentId: z.string().describe('The document ID'),
        type: z.string().describe('The schema type to update'),
        displayName: z.string().optional().describe('New human-readable name'),
        color: z.string().optional().describe('New hex color for the node'),
        semanticDescription: z.string().optional().describe('New description for AI context'),
        groupId: z.string().optional().describe('New schema group ID'),
        packageId: z.string().nullable().optional().describe('Schema package ID (null to remove from package)'),
        instanceColors: z.boolean().optional().describe('true = per-instance color palette; false/absent = schema color only'),
        nodeShape: z.enum(['default', 'simple', 'circle', 'diamond', 'document', 'parallelogram', 'stadium']).optional().describe('Node render style'),
        enumIconField: z.string().optional().describe('Field name for icon markers'),
        enumIconMap: z.record(z.string()).optional().describe('Enum value → Unicode character mapping'),
        fieldUpdates: z.record(z.object({
          label: z.string().optional(),
          semanticDescription: z.string().optional(),
          displayHint: z.enum(['multiline', 'code', 'password', 'url', 'color']).optional(),
          displayTier: z.enum(['pill', 'summary']).optional(),
          displayOrder: z.number().optional(),
          placeholder: z.string().optional(),
        })).optional().describe('Map of field name → metadata updates (non-structural only)'),
      }).shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_rename_field',
      description: 'Rename a field in a schema and migrate all instance values to the new name. Updates displayField reference if needed.',
      inputSchema: RenameFieldSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_remove_field',
      description: 'Remove a field from a schema and delete its values from all instances. Clears displayField reference if needed.',
      inputSchema: RemoveFieldSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_add_field',
      description: 'Add a new field to a schema. Optionally populate existing instances with a default value.',
      inputSchema: AddFieldSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_rename_port',
      description: 'Rename a port in a schema and update all edge connections to use the new port ID.',
      inputSchema: RenamePortSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_remove_port',
      description: 'Remove a port from a schema and delete all edges connected through it.',
      inputSchema: RemovePortSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_rename_schema_type',
      description: 'Rename a schema type. Updates all instances and cross-references in other schemas.',
      inputSchema: RenameSchemaTypeSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_change_field_type',
      description: 'Change a field\'s data type. Returns a dry-run preview by default showing how many instances would lose data. Set force=true to execute.',
      inputSchema: ChangeFieldTypeSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_narrow_enum_options',
      description: 'Update enum field options. Remaps values via valueMapping or clears orphaned values.',
      inputSchema: NarrowEnumOptionsSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_add_port',
      description: 'Add a new port to a schema. No instance fixup needed.',
      inputSchema: AddPortSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_change_port_type',
      description: 'Change a port\'s type reference. Disconnects edges that become incompatible with the new port type.',
      inputSchema: ChangePortTypeSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_delete_schema',
      description: 'Delete a custom construct schema by type',
      inputSchema: z.object({
        documentId: z.string().describe('The document ID'),
        type: z.string().describe('The schema type to delete'),
      }).shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_list_constructs',
      description: 'List constructs in a document. Default returns compact summaries. Use output="full" to include field values, positions, and connections. Optionally filter by constructType or target a specific page.',
      inputSchema: ListConstructsSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_get_construct',
      description: 'Get a construct by semantic ID. Use output="compact" for a lightweight summary without field values.',
      inputSchema: GetConstructSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_create_construct',
      description: `Create a new construct instance. semanticId is auto-generated (type prefix + random suffix) — do not pass it.

values: Record keyed by field name from the target schema. Use carta_get_schema(type) to discover field names.
Example: for a schema with fields [{name: "file", ...}, {name: "layer", ...}], pass values: {"file": "Map.tsx", "layer": "canvas"}.

When parentId is set, x/y are relative to the organizer. Nodes without x/y default to (0,0). Optionally accepts pageId to target a specific page.`,
      inputSchema: CreateConstructSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_update_construct',
      description: `Update an existing construct's field values or instance color.

values: Partial record keyed by field name from the schema — only include fields to change. Use carta_get_schema(type) to discover field names.
instanceColor: hex string or null to clear. Visual-only override for node background.`,
      inputSchema: UpdateConstructSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_delete_construct',
      description: 'Delete a construct',
      inputSchema: DeleteConstructSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_connect_constructs',
      description: 'Connect two constructs via ports. Optionally accepts pageId to target a specific page.',
      inputSchema: ConnectConstructsSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_disconnect_constructs',
      description: 'Disconnect two constructs. Optionally accepts pageId to target a specific page.',
      inputSchema: DisconnectConstructsSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_create_constructs',
      description: `Create multiple constructs in a single transaction (all-or-nothing). semanticId is auto-generated for each — do not pass it.

Each construct object: { constructType, values?, x?, y?, parentId? }
values: Record keyed by field name from the schema for that constructType. Use carta_get_schema(type) to discover field names.

Nodes without x/y are auto-placed in a grid. Optionally accepts pageId to target a specific page.`,
      inputSchema: BulkCreateConstructsSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_connect_constructs_bulk',
      description: 'Connect multiple construct pairs in a single call. Best-effort: individual failures are reported, not aborted. Optionally accepts pageId to target a specific page.',
      inputSchema: BulkConnectSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_get_document_summary',
      description: 'Get a compact document summary with page/construct/edge counts. Use include=["constructs","schemas"] to embed detailed data for a specific page (defaults to active page). Accepts pageName as alternative to pageId.',
      inputSchema: DocumentSummarySchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_create_organizer',
      description: 'Create an organizer node to visually group constructs. Use carta_create_construct with parentId to place constructs inside it. Optionally accepts pageId to target a specific page.',
      inputSchema: CreateOrganizerSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_update_organizer',
      description: 'Update organizer properties (name, color, collapsed, layout, description)',
      inputSchema: UpdateOrganizerSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_delete_organizer',
      description: 'Delete an organizer. By default, detaches member constructs (converts to absolute positions). Set deleteMembers=true to also delete members.',
      inputSchema: DeleteOrganizerSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_list_port_types',
      description: 'List available port types and their compatibility rules',
      inputSchema: DocumentIdSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_compile',
      description: 'Compile a document to AI-readable output',
      inputSchema: DocumentIdSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_move_construct',
      description: 'Move a construct into or out of an organizer. Position is auto-converted between absolute and relative. Connections are preserved. Optionally accepts pageId to target a specific page.',
      inputSchema: MoveConstructSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_delete_constructs',
      description: 'Delete multiple constructs in a single transaction. Cleans up edges, connections, and attached wagons. Best-effort: per-item results. Optionally accepts pageId to target a specific page.',
      inputSchema: DeleteConstructsSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
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

For create/update ops, values is a Record keyed by field name from the schema. Use carta_get_schema(type) to discover field names. semanticId is auto-generated for create ops; use "@N" placeholders to reference it in later ops.`,
      inputSchema: BatchMutateSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_flow_layout',
      description: 'Arrange nodes in topological order along a flow direction. Uses port connections to determine hierarchy — nodes with no incoming flow edges become sources (layer 0). Supports TB/BT/LR/RL directions. Only affects top-level nodes (not inside organizers). Optionally accepts pageId to target a specific page.',
      inputSchema: FlowLayoutSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_arrange',
      description: 'Arrange nodes using declarative constraints. Strategies: "grid" (initial), "preserve" (adjust), "force" (organic spring layout). Constraints: align, order, spacing, group, distribute, position, flow (topological DAG layout). Constraints apply sequentially. Optionally accepts pageId to target a specific page.',
      inputSchema: ArrangeLayoutSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_pin_constraint',
      description: 'Create a pin constraint between two organizers. Declares that sourceOrganizerId should be positioned relative to targetOrganizerId in the specified direction (N, NE, E, SE, S, SW, W, NW). The constraint is stored per-page and resolved on demand. Optionally accepts pageId to target a specific page.',
      inputSchema: PinConstraintSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_list_pin_constraints',
      description: 'List all pin constraints for a page. Returns an array of constraints with their IDs, source/target organizer IDs, direction, and optional gap. Optionally accepts pageId to target a specific page.',
      inputSchema: ListPinConstraintsSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_remove_pin_constraint',
      description: 'Remove a pin constraint by ID. Returns success status. Optionally accepts pageId to target a specific page.',
      inputSchema: RemovePinConstraintSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
      name: 'carta_apply_pin_layout',
      description: 'Resolve and apply pin constraints to organizer positions. Uses topological sort to determine positioning order, detects cycles, and computes absolute positions from relative constraints. Returns the number of organizers updated and any warnings. Optionally accepts pageId to target a specific page.',
      inputSchema: ApplyPinLayoutSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_rebuild_page',
      description: `Rebuild all Yjs data for a page by round-tripping through plain objects. Flushes corrupt Y.Map state, orphaned keys, and stale references while preserving node IDs, positions, fields, edges, and organizer membership. Debug tool — use when a page has rendering issues that don't appear on freshly-created pages.`,
      inputSchema: RebuildPageSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_create_package',
      description: 'Create a schema package for grouping related schemas. Schemas can be assigned to the package via packageId.',
      inputSchema: CreatePackageSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'carta_list_packages',
      description: 'List schema packages with member schema counts.',
      inputSchema: ListPackagesSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_get_package',
      description: 'Get a schema package with its member schemas, port schemas, groups, and relationships.',
      inputSchema: GetPackageSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_list_standard_packages',
      description: 'List all standard library packages with their status for a document. Status: "available" (not loaded), "loaded" (loaded, unmodified), "modified" (loaded but changed). Use carta_apply_package to load available packages.',
      inputSchema: ListStandardPackagesSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_apply_package',
      description: 'Apply a standard library package to a document by package ID. Idempotent: returns "skipped" if already loaded. Adds all schemas, port schemas, groups, and relationships from the package.',
      inputSchema: ApplyStandardPackageSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'carta_check_package_drift',
      description: 'Check if a loaded package has been modified in the document. Compares current state against the snapshot stored at load time. Useful for diagnosing schema issues.',
      inputSchema: CheckPackageDriftSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
  ];
}

/**
 * Tool handler function type
 */
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * Tool handlers interface with specific tool names
 */
export interface ToolHandlers {
  carta_list_active_documents: ToolHandler;
  carta_list_documents: ToolHandler;
  carta_get_document: ToolHandler;
  carta_create_document: ToolHandler;
  carta_delete_document: ToolHandler;
  carta_rename_document: ToolHandler;
  carta_list_pages: ToolHandler;
  carta_create_page: ToolHandler;
  carta_rename_page: ToolHandler;
  carta_delete_page: ToolHandler;
  carta_set_active_page: ToolHandler;
  carta_list_schemas: ToolHandler;
  carta_get_schema: ToolHandler;
  carta_create_schema: ToolHandler;
  carta_update_schema: ToolHandler;
  carta_delete_schema: ToolHandler;
  carta_rename_field: ToolHandler;
  carta_remove_field: ToolHandler;
  carta_add_field: ToolHandler;
  carta_rename_port: ToolHandler;
  carta_remove_port: ToolHandler;
  carta_rename_schema_type: ToolHandler;
  carta_change_field_type: ToolHandler;
  carta_narrow_enum_options: ToolHandler;
  carta_add_port: ToolHandler;
  carta_change_port_type: ToolHandler;
  carta_list_constructs: ToolHandler;
  carta_get_construct: ToolHandler;
  carta_create_construct: ToolHandler;
  carta_update_construct: ToolHandler;
  carta_delete_construct: ToolHandler;
  carta_connect_constructs: ToolHandler;
  carta_disconnect_constructs: ToolHandler;
  carta_create_constructs: ToolHandler;
  carta_connect_constructs_bulk: ToolHandler;
  carta_get_document_summary: ToolHandler;
  carta_create_organizer: ToolHandler;
  carta_update_organizer: ToolHandler;
  carta_delete_organizer: ToolHandler;
  carta_list_port_types: ToolHandler;
  carta_compile: ToolHandler;
  carta_move_construct: ToolHandler;
  carta_delete_constructs: ToolHandler;
  carta_batch_mutate: ToolHandler;
  carta_flow_layout: ToolHandler;
  carta_arrange: ToolHandler;
  carta_pin_constraint: ToolHandler;
  carta_list_pin_constraints: ToolHandler;
  carta_remove_pin_constraint: ToolHandler;
  carta_apply_pin_layout: ToolHandler;
  carta_rebuild_page: ToolHandler;
  carta_create_package: ToolHandler;
  carta_list_packages: ToolHandler;
  carta_get_package: ToolHandler;
  carta_list_standard_packages: ToolHandler;
  carta_apply_package: ToolHandler;
  carta_check_package_drift: ToolHandler;
  [key: string]: ToolHandler;
}

/**
 * Options for creating tool handlers
 */
export interface ToolHandlerOptions {
  serverUrl?: string;
}

/**
 * Create tool handlers that communicate via HTTP with the document server
 */
export function createToolHandlers(options: ToolHandlerOptions = {}): ToolHandlers {
  const apiUrl = options.serverUrl || process.env.CARTA_SERVER_URL || process.env.CARTA_COLLAB_API_URL || 'http://localhost:1234';

  /**
   * Make HTTP request to document server API
   */
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
    carta_list_active_documents: async () => {
      const result = await apiRequest<{ documents: Array<{ documentId: string; clientCount: number }> }>(
        'GET',
        '/api/rooms'
      );
      if (result.error) {
        return { error: result.error, hint: 'Start the document server with: pnpm document-server' };
      }
      return result.data;
    },

    carta_list_documents: async () => {
      const result = await apiRequest<{ documents: unknown[] }>('GET', '/api/documents');
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_get_document: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ document: unknown }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_document: async (args) => {
      const { title } = CreateDocumentSchema.parse(args);
      const result = await apiRequest<{ document: unknown }>('POST', '/api/documents', { title });
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_delete_document: async (args) => {
      const { documentId } = DeleteDocumentSchema.parse(args);
      const result = await apiRequest<{ deleted: boolean }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(documentId)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rename_document: async (args) => {
      const { documentId, title } = RenameDocumentSchema.parse(args);
      const result = await apiRequest<{ document: unknown }>(
        'PATCH',
        `/api/documents/${encodeURIComponent(documentId)}`,
        { title }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_pages: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ pages: unknown[]; activePage: string }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/pages`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_page: async (args) => {
      const { documentId, name, description } = CreatePageSchema.parse(args);
      const result = await apiRequest<{ page: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/pages`,
        { name, description }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rename_page: async (args) => {
      const { documentId, pageId, name, description, order } = RenamePageSchema.parse(args);
      const result = await apiRequest<{ page: unknown }>(
        'PATCH',
        `/api/documents/${encodeURIComponent(documentId)}/pages/${encodeURIComponent(pageId)}`,
        { name, description, order }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_delete_page: async (args) => {
      const { documentId, pageId } = DeletePageSchema.parse(args);
      const result = await apiRequest<{ deleted: boolean }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(documentId)}/pages/${encodeURIComponent(pageId)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_set_active_page: async (args) => {
      const { documentId, pageId, pageName } = SetActivePageSchema.parse(args);
      const result = await apiRequest<{
        activePage: string;
        page: unknown;
        constructs: unknown[];
        organizers: unknown[];
        edgeCount: number;
        customSchemas: unknown[];
      }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/pages/active`,
        { pageId, pageName }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_schemas: async (args) => {
      const { documentId, output, groupId } = ListSchemasSchema.parse(args);
      const params = new URLSearchParams();
      if (output) params.set('output', output);
      if (groupId) params.set('groupId', groupId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const result = await apiRequest<{ schemas: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/schemas${qs}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_get_schema: async (args) => {
      const { documentId, type } = z
        .object({ documentId: z.string(), type: z.string() })
        .parse(args);
      const result = await apiRequest<{ schema: unknown }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(type)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_schema: async (args) => {
      const input = CreateSchemaInputSchema.parse(args);
      const result = await apiRequest<{ schema: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(input.documentId)}/schemas`,
        {
          type: input.type,
          displayName: input.displayName,
          color: input.color,
          semanticDescription: input.semanticDescription,
          groupId: input.groupId,
          packageId: input.packageId,
          instanceColors: input.instanceColors,
          fields: input.fields,
          ports: input.ports,
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_update_schema: async (args) => {
      const input = z.object({
        documentId: z.string(),
        type: z.string(),
        displayName: z.string().optional(),
        color: z.string().optional(),
        semanticDescription: z.string().optional(),
        groupId: z.string().optional(),
        packageId: z.string().nullable().optional(),
        backgroundColorPolicy: z.enum(['defaultOnly', 'tints', 'any']).optional(),
        nodeShape: z.enum(['default', 'simple', 'circle', 'diamond', 'document', 'parallelogram', 'stadium']).optional(),
        fieldUpdates: z.record(z.object({
          label: z.string().optional(),
          semanticDescription: z.string().optional(),
          displayHint: z.enum(['multiline', 'code', 'password', 'url', 'color']).optional(),
          displayTier: z.enum(['pill', 'summary']).optional(),
          displayOrder: z.number().optional(),
          placeholder: z.string().optional(),
        })).optional(),
      }).parse(args);

      const { documentId, type, ...updates } = input;
      const result = await apiRequest<{ schema: unknown }>(
        'PATCH',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(type)}`,
        updates
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rename_field: async (args) => {
      const { documentId, schemaType, oldName, newName } = RenameFieldSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'renameField', oldName, newName }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_remove_field: async (args) => {
      const { documentId, schemaType, fieldName } = RemoveFieldSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'removeField', fieldName }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_add_field: async (args) => {
      const { documentId, schemaType, field, defaultValue } = AddFieldSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'addField', field, defaultValue }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rename_port: async (args) => {
      const { documentId, schemaType, oldPortId, newPortId } = RenamePortSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'renamePort', oldPortId, newPortId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_remove_port: async (args) => {
      const { documentId, schemaType, portId } = RemovePortSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'removePort', portId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rename_schema_type: async (args) => {
      const { documentId, schemaType, newType } = RenameSchemaTypeSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'renameSchemaType', newType }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_change_field_type: async (args) => {
      const { documentId, schemaType, fieldName, newType, force, enumOptions } = ChangeFieldTypeSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'changeFieldType', fieldName, newType, force, enumOptions }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_narrow_enum_options: async (args) => {
      const { documentId, schemaType, fieldName, newOptions, valueMapping } = NarrowEnumOptionsSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'narrowEnumOptions', fieldName, newOptions, valueMapping }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_add_port: async (args) => {
      const { documentId, schemaType, portConfig } = AddPortSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'addPort', portConfig }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_change_port_type: async (args) => {
      const { documentId, schemaType, portId, newPortType } = ChangePortTypeSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(schemaType)}/migrate`,
        { operation: 'changePortType', portId, newPortType }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_delete_schema: async (args) => {
      const { documentId, type } = z.object({ documentId: z.string(), type: z.string() }).parse(args);
      const result = await apiRequest<{ deleted: boolean }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(documentId)}/schemas/${encodeURIComponent(type)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_constructs: async (args) => {
      const { documentId, constructType, pageId, output } = ListConstructsSchema.parse(args);
      const params = new URLSearchParams();
      if (constructType) params.set('type', constructType);
      if (pageId) params.set('pageId', pageId);
      if (output) params.set('output', output);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const result = await apiRequest<{ constructs: unknown[]; organizers: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/constructs${qs}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_get_construct: async (args) => {
      const { documentId, semanticId, output } = GetConstructSchema.parse(args);
      const outputQs = output ? `?output=${output}` : '';
      const result = await apiRequest<{ construct: unknown }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/${encodeURIComponent(semanticId)}${outputQs}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_construct: async (args) => {
      const { documentId, constructType, values, x, y, parentId, pageId } = CreateConstructSchema.parse(args);
      const result = await apiRequest<{ construct: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/constructs`,
        { constructType, values, x, y, parentId, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_update_construct: async (args) => {
      const { documentId, semanticId, values, instanceColor } = UpdateConstructSchema.parse(args);
      const result = await apiRequest<{ construct: unknown }>(
        'PATCH',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/${encodeURIComponent(semanticId)}`,
        { values, instanceColor }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_delete_construct: async (args) => {
      const { documentId, semanticId } = DeleteConstructSchema.parse(args);
      const result = await apiRequest<{ deleted: boolean }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/${encodeURIComponent(semanticId)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_connect_constructs: async (args) => {
      const input = ConnectConstructsSchema.parse(args);
      const result = await apiRequest<{ edge: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(input.documentId)}/connections`,
        {
          sourceSemanticId: input.sourceSemanticId,
          sourcePortId: input.sourcePortId,
          targetSemanticId: input.targetSemanticId,
          targetPortId: input.targetPortId,
          pageId: input.pageId,
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_disconnect_constructs: async (args) => {
      const input = DisconnectConstructsSchema.parse(args);
      const result = await apiRequest<{ disconnected: boolean }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(input.documentId)}/connections`,
        {
          sourceSemanticId: input.sourceSemanticId,
          sourcePortId: input.sourcePortId,
          targetSemanticId: input.targetSemanticId,
          pageId: input.pageId,
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_constructs: async (args) => {
      const { documentId, constructs, pageId } = BulkCreateConstructsSchema.parse(args);
      const result = await apiRequest<{ constructs: unknown[] }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/bulk`,
        { constructs, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_connect_constructs_bulk: async (args) => {
      const { documentId, connections, pageId } = BulkConnectSchema.parse(args);
      const result = await apiRequest<{ results: unknown[] }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/connections/bulk`,
        { connections, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_get_document_summary: async (args) => {
      const { documentId, pageId, pageName, include } = DocumentSummarySchema.parse(args);
      const params = new URLSearchParams();
      if (pageId) params.set('pageId', pageId);
      if (pageName) params.set('pageName', pageName);
      if (include && include.length > 0) params.set('include', include.join(','));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const result = await apiRequest<unknown>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/summary${qs}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_organizer: async (args) => {
      const input = CreateOrganizerSchema.parse(args);
      const result = await apiRequest<{ organizer: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(input.documentId)}/organizers`,
        {
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
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_update_organizer: async (args) => {
      const input = UpdateOrganizerSchema.parse(args);
      const result = await apiRequest<{ organizer: unknown }>(
        'PATCH',
        `/api/documents/${encodeURIComponent(input.documentId)}/organizers/${encodeURIComponent(input.organizerId)}`,
        {
          name: input.name,
          color: input.color,
          collapsed: input.collapsed,
          layout: input.layout,
          description: input.description,
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_delete_organizer: async (args) => {
      const input = DeleteOrganizerSchema.parse(args);
      const params = input.deleteMembers ? '?deleteMembers=true' : '';
      const result = await apiRequest<{ deleted: boolean }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(input.documentId)}/organizers/${encodeURIComponent(input.organizerId)}${params}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_port_types: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ portTypes: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/port-types`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_compile: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ output: string }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/compile`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_move_construct: async (args) => {
      const { documentId, semanticId, parentId, x, y, pageId } = MoveConstructSchema.parse(args);
      const result = await apiRequest<{ construct: unknown; parentId: string | null }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/${encodeURIComponent(semanticId)}/move`,
        { parentId, x, y, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_delete_constructs: async (args) => {
      const { documentId, semanticIds, pageId } = DeleteConstructsSchema.parse(args);
      const result = await apiRequest<{ results: unknown[] }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/bulk`,
        { semanticIds, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_batch_mutate: async (args) => {
      const { documentId, operations, pageId } = BatchMutateSchema.parse(args);
      const result = await apiRequest<{ results: unknown[] }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/batch`,
        { operations, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_flow_layout: async (args) => {
      const { documentId, direction, sourcePort, sinkPort, layerGap, nodeGap, scope, pageId } = FlowLayoutSchema.parse(args);
      const result = await apiRequest<{ updated: number; layers: Record<string, number> }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/layout/flow`,
        { direction, sourcePort, sinkPort, layerGap, nodeGap, scope, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_arrange: async (args) => {
      const { documentId, strategy, constraints, scope, nodeGap, forceIterations, pageId } = ArrangeLayoutSchema.parse(args);
      const result = await apiRequest<{ updated: number; constraintsApplied: number }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/layout/arrange`,
        { strategy, constraints, scope, nodeGap, forceIterations, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_pin_constraint: async (args) => {
      const { documentId, sourceOrganizerId, targetOrganizerId, direction, gap, pageId } = PinConstraintSchema.parse(args);
      const result = await apiRequest<{ constraint: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/pin-constraints`,
        { sourceOrganizerId, targetOrganizerId, direction, gap, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_pin_constraints: async (args) => {
      const { documentId, pageId } = ListPinConstraintsSchema.parse(args);
      const params = new URLSearchParams();
      if (pageId) params.set('pageId', pageId);
      const queryString = params.toString();
      const url = `/api/documents/${encodeURIComponent(documentId)}/pin-constraints${queryString ? '?' + queryString : ''}`;
      const result = await apiRequest<{ constraints: unknown[] }>('GET', url);
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_remove_pin_constraint: async (args) => {
      const { documentId, constraintId, pageId } = RemovePinConstraintSchema.parse(args);
      const params = new URLSearchParams();
      if (pageId) params.set('pageId', pageId);
      const queryString = params.toString();
      const url = `/api/documents/${encodeURIComponent(documentId)}/pin-constraints/${encodeURIComponent(constraintId)}${queryString ? '?' + queryString : ''}`;
      const result = await apiRequest<{ success: boolean }>('DELETE', url);
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_apply_pin_layout: async (args) => {
      const { documentId, gap, pageId } = ApplyPinLayoutSchema.parse(args);
      const result = await apiRequest<{ updated: number; warnings: string[] }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/layout/pin`,
        { gap, pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rebuild_page: async (args) => {
      const { documentId, pageId } = RebuildPageSchema.parse(args);
      const result = await apiRequest<{ nodesRebuilt: number; edgesRebuilt: number; orphansDropped: string[] }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/rebuild-page`,
        { pageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_package: async (args) => {
      const { documentId, name, description, color } = CreatePackageSchema.parse(args);
      const result = await apiRequest<{ package: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/packages`,
        { name, description, color }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_packages: async (args) => {
      const { documentId } = ListPackagesSchema.parse(args);
      const result = await apiRequest<{ packages: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/packages`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_get_package: async (args) => {
      const { documentId, packageId } = GetPackageSchema.parse(args);
      const result = await apiRequest<unknown>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/packages/${encodeURIComponent(packageId)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_standard_packages: async (args) => {
      const { documentId } = ListStandardPackagesSchema.parse(args);
      const result = await apiRequest<{ packages: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/standard-packages`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_apply_package: async (args) => {
      const { documentId, packageId } = ApplyStandardPackageSchema.parse(args);
      const result = await apiRequest<unknown>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/standard-packages/apply`,
        { packageId }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_check_package_drift: async (args) => {
      const { documentId, packageId } = CheckPackageDriftSchema.parse(args);
      const result = await apiRequest<unknown>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/standard-packages/${encodeURIComponent(packageId)}/drift`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },
  };
}
