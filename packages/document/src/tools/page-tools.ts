/**
 * Page-scoped tool definitions.
 *
 * These tools operate on a specific page and require a pageId parameter.
 * Includes: constructs, connections, organizers, layout operations.
 */

import { z } from 'zod';
import * as Y from 'yjs';
import {
  listConstructs,
  getConstruct,
  createConstruct,
  updateConstruct,
  deleteConstruct,
  moveConstruct,
  createConstructsBulk,
  deleteConstructsBulk,
  connect,
  connectBulk,
  disconnect,
  batchMutate,
  listOrganizers,
  createOrganizer,
  updateOrganizer,
  deleteOrganizer,
  flowLayout,
  arrangeLayout,
  addPinConstraint,
  listPinConstraints,
  removePinConstraint,
  applyPinLayout,
  rebuildPage,
} from '../doc-operations.js';
import { yToPlain } from '../yjs-helpers.js';
import type { ToolDefinition } from './types.js';

// ============================================================
// Zod Schemas (copied from MCP tools, minus documentId)
// ============================================================

const ListConstructsInput = z.object({
  constructType: z.string().optional(),
});

const GetConstructInput = z.object({
  semanticId: z.string(),
});

const CreateConstructInput = z.object({
  constructType: z.string(),
  values: z.record(z.unknown()).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  parentId: z.string().optional(),
});

const UpdateConstructInput = z.object({
  semanticId: z.string(),
  values: z.record(z.unknown()).optional(),
  instanceColor: z.string().nullable().optional(),
});

const DeleteConstructInput = z.object({
  semanticId: z.string(),
});

const ConnectConstructsInput = z.object({
  sourceSemanticId: z.string(),
  sourcePortId: z.string(),
  targetSemanticId: z.string(),
  targetPortId: z.string(),
});

const DisconnectConstructsInput = z.object({
  sourceSemanticId: z.string(),
  sourcePortId: z.string(),
  targetSemanticId: z.string(),
});

const BulkCreateConstructsInput = z.object({
  constructs: z.array(z.object({
    constructType: z.string(),
    values: z.record(z.unknown()).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional(),
  })),
});

const BulkConnectInput = z.object({
  connections: z.array(z.object({
    sourceSemanticId: z.string(),
    sourcePortId: z.string(),
    targetSemanticId: z.string(),
    targetPortId: z.string(),
  })),
});

const MoveConstructInput = z.object({
  semanticId: z.string(),
  parentId: z.string().nullable(),
  x: z.number().optional(),
  y: z.number().optional(),
});

const DeleteConstructsInput = z.object({
  semanticIds: z.array(z.string()),
});

const BatchMutateInput = z.object({
  operations: z.array(z.discriminatedUnion('op', [
    z.object({
      op: z.literal('create'),
      constructType: z.string(),
      values: z.record(z.unknown()).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      parentId: z.string().optional(),
    }),
    z.object({
      op: z.literal('update'),
      semanticId: z.string(),
      values: z.record(z.unknown()).optional(),
      instanceColor: z.string().nullable().optional(),
    }),
    z.object({
      op: z.literal('delete'),
      semanticId: z.string(),
    }),
    z.object({
      op: z.literal('connect'),
      sourceSemanticId: z.string(),
      sourcePortId: z.string(),
      targetSemanticId: z.string(),
      targetPortId: z.string(),
    }),
    z.object({
      op: z.literal('disconnect'),
      sourceSemanticId: z.string(),
      sourcePortId: z.string(),
      targetSemanticId: z.string(),
    }),
    z.object({
      op: z.literal('move'),
      semanticId: z.string(),
      parentId: z.string().nullable(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
  ])),
});

const CreateOrganizerInput = z.object({
  name: z.string(),
  color: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  layout: z.enum(['freeform']).optional(),
  description: z.string().optional(),
  attachedToSemanticId: z.string().optional(),
});

const UpdateOrganizerInput = z.object({
  organizerId: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
  layout: z.enum(['freeform']).optional(),
  description: z.string().optional(),
});

const DeleteOrganizerInput = z.object({
  organizerId: z.string(),
  deleteMembers: z.boolean().optional(),
});

const FlowLayoutInput = z.object({
  direction: z.enum(['TB', 'BT', 'LR', 'RL']),
  sourcePort: z.string().optional(),
  sinkPort: z.string().optional(),
  layerGap: z.number().optional(),
  nodeGap: z.number().optional(),
  scope: z.union([z.literal('all'), z.array(z.string())]).optional(),
});

const NodeSelectorSchema = z.union([
  z.literal('all'),
  z.object({ constructType: z.string() }),
  z.object({ semanticIds: z.array(z.string()) }),
]);

const ArrangeConstraintSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('align'),
    axis: z.enum(['x', 'y']),
    nodes: NodeSelectorSchema.optional(),
    alignment: z.enum(['center', 'min', 'max']).optional(),
  }),
  z.object({
    type: z.literal('order'),
    axis: z.enum(['x', 'y']),
    by: z.enum(['field', 'alphabetical']),
    field: z.string().optional(),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('spacing'),
    min: z.number().optional(),
    equal: z.boolean().optional(),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('group'),
    by: z.enum(['constructType', 'field']),
    field: z.string().optional(),
    axis: z.enum(['x', 'y']).optional(),
    groupGap: z.number().optional(),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('distribute'),
    axis: z.enum(['x', 'y']),
    spacing: z.enum(['equal', 'packed']).optional(),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('position'),
    anchor: z.enum(['top', 'bottom', 'left', 'right', 'center']),
    nodes: NodeSelectorSchema.optional(),
    margin: z.number().optional(),
  }),
  z.object({
    type: z.literal('flow'),
    direction: z.enum(['TB', 'BT', 'LR', 'RL']).optional(),
    sourcePort: z.string().optional(),
    layerGap: z.number().optional(),
    nodeGap: z.number().optional(),
    nodes: NodeSelectorSchema.optional(),
  }),
]);

const ArrangeLayoutInput = z.object({
  strategy: z.enum(['grid', 'preserve', 'force']).optional(),
  constraints: z.array(ArrangeConstraintSchema),
  scope: z.union([z.literal('all'), z.array(z.string())]).optional(),
  nodeGap: z.number().optional(),
  forceIterations: z.number().optional(),
});

const PinConstraintInput = z.object({
  sourceOrganizerId: z.string(),
  targetOrganizerId: z.string(),
  direction: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
  gap: z.number().optional(),
});

const RemovePinConstraintInput = z.object({
  constraintId: z.string(),
});

const ApplyPinLayoutInput = z.object({
  gap: z.number().optional(),
});

// ============================================================
// Tool Definitions
// ============================================================

export const listConstructsTool: ToolDefinition = {
  name: 'list_constructs',
  description: 'List constructs in a document (compact summaries). Use carta_get_construct for full details. Optionally filter by constructType or target a specific page.',
  inputSchema: ListConstructsInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = ListConstructsInput.parse(params);
    const options = input.constructType ? { constructType: input.constructType } : undefined;
    const constructs = listConstructs(ydoc, pageId, options);
    const organizers = listOrganizers(ydoc, pageId);
    return { success: true, data: { constructs, organizers } };
  },
};

export const getConstructTool: ToolDefinition = {
  name: 'get_construct',
  description: 'Get a construct by semantic ID',
  inputSchema: GetConstructInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = GetConstructInput.parse(params);
    const construct = getConstruct(ydoc, pageId, input.semanticId);
    if (!construct) {
      return { success: false, error: `Construct not found: ${input.semanticId}` };
    }

    // Cross-reference values against schema to flag orphaned data
    const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
    const yschema = yschemas.get(construct.data.constructType);
    let orphanedValues: Record<string, unknown> | undefined;
    if (yschema) {
      const schema = yToPlain(yschema) as { fields?: Array<{ name: string }> };
      const fieldNames = new Set((schema.fields ?? []).map(f => f.name));
      const orphans: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(construct.data.values ?? {})) {
        if (!fieldNames.has(key)) {
          orphans[key] = value;
        }
      }
      if (Object.keys(orphans).length > 0) {
        orphanedValues = orphans;
      }
    }

    return {
      success: true,
      data: {
        construct,
        ...(orphanedValues ? { orphanedValues } : {}),
        ...(yschema ? {} : { warning: 'Schema not found for this construct type' }),
      },
    };
  },
};

export const createConstructTool: ToolDefinition = {
  name: 'create_construct',
  description: `Create a new construct instance. semanticId is auto-generated (type prefix + random suffix) — do not pass it.

values: Record keyed by field name from the target schema. Use carta_get_schema(type) to discover field names.
Example: for a schema with fields [{name: "file", ...}, {name: "layer", ...}], pass values: {"file": "Map.tsx", "layer": "canvas"}.

When parentId is set, x/y are relative to the organizer. Nodes without x/y default to (0,0). Optionally accepts pageId to target a specific page.`,
  inputSchema: CreateConstructInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = CreateConstructInput.parse(params);
    const position = (input.x !== undefined && input.y !== undefined)
      ? { x: input.x, y: input.y }
      : { x: 100, y: 100 };
    const construct = createConstruct(
      ydoc,
      pageId,
      input.constructType,
      input.values ?? {},
      position,
      input.parentId
    );
    return { success: true, data: { construct } };
  },
};

export const updateConstructTool: ToolDefinition = {
  name: 'update_construct',
  description: `Update an existing construct's field values or instance color.

values: Partial record keyed by field name from the schema — only include fields to change. Use carta_get_schema(type) to discover field names.
instanceColor: hex string or null to clear. Visual-only override for node background.`,
  inputSchema: UpdateConstructInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = UpdateConstructInput.parse(params);
    const updates: { values?: Record<string, unknown>; instanceColor?: string | null } = {};
    if (input.values !== undefined) updates.values = input.values;
    if (input.instanceColor !== undefined) updates.instanceColor = input.instanceColor;
    const construct = updateConstruct(
      ydoc,
      pageId,
      input.semanticId,
      updates
    );
    if (!construct) {
      return { success: false, error: `Construct not found: ${input.semanticId}` };
    }
    return { success: true, data: { construct } };
  },
};

export const deleteConstructTool: ToolDefinition = {
  name: 'delete_construct',
  description: 'Delete a construct',
  inputSchema: DeleteConstructInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = DeleteConstructInput.parse(params);
    const deleted = deleteConstruct(ydoc, pageId, input.semanticId);
    if (!deleted) {
      return { success: false, error: `Failed to delete construct: ${input.semanticId}` };
    }
    return { success: true, data: { deleted: true } };
  },
};

export const connectConstructsTool: ToolDefinition = {
  name: 'connect_constructs',
  description: 'Connect two constructs via ports. Optionally accepts pageId to target a specific page.',
  inputSchema: ConnectConstructsInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = ConnectConstructsInput.parse(params);
    const edge = connect(
      ydoc,
      pageId,
      input.sourceSemanticId,
      input.sourcePortId,
      input.targetSemanticId,
      input.targetPortId
    );
    if (!edge) {
      return { success: false, error: 'Failed to create connection' };
    }
    return { success: true, data: { edge } };
  },
};

export const disconnectConstructsTool: ToolDefinition = {
  name: 'disconnect_constructs',
  description: 'Disconnect two constructs. Optionally accepts pageId to target a specific page.',
  inputSchema: DisconnectConstructsInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = DisconnectConstructsInput.parse(params);
    const disconnected = disconnect(
      ydoc,
      pageId,
      input.sourceSemanticId,
      input.sourcePortId,
      input.targetSemanticId
    );
    return { success: true, data: { disconnected } };
  },
};

export const createConstructsTool: ToolDefinition = {
  name: 'create_constructs',
  description: `Create multiple constructs in a single transaction (all-or-nothing). semanticId is auto-generated for each — do not pass it.

Each construct object: { constructType, values?, x?, y?, parentId? }
values: Record keyed by field name from the schema for that constructType. Use carta_get_schema(type) to discover field names.

Nodes without x/y are auto-placed in a grid. Optionally accepts pageId to target a specific page.`,
  inputSchema: BulkCreateConstructsInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = BulkCreateConstructsInput.parse(params);
    const constructs = createConstructsBulk(ydoc, pageId, input.constructs);
    return { success: true, data: { constructs } };
  },
};

export const connectConstructsBulkTool: ToolDefinition = {
  name: 'connect_constructs_bulk',
  description: 'Connect multiple construct pairs in a single call. Best-effort: individual failures are reported, not aborted. Optionally accepts pageId to target a specific page.',
  inputSchema: BulkConnectInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = BulkConnectInput.parse(params);
    const results = connectBulk(ydoc, pageId, input.connections);
    return { success: true, data: { results } };
  },
};

export const moveConstructTool: ToolDefinition = {
  name: 'move_construct',
  description: 'Move a construct into or out of an organizer. Position is auto-converted between absolute and relative. Connections are preserved. Optionally accepts pageId to target a specific page.',
  inputSchema: MoveConstructInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = MoveConstructInput.parse(params);
    const position = (input.x !== undefined && input.y !== undefined)
      ? { x: input.x, y: input.y }
      : undefined;
    const result = moveConstruct(
      ydoc,
      pageId,
      input.semanticId,
      input.parentId,
      position
    );
    if (!result) {
      return { success: false, error: `Failed to move construct: ${input.semanticId}` };
    }
    return { success: true, data: result };
  },
};

export const deleteConstructsTool: ToolDefinition = {
  name: 'delete_constructs',
  description: 'Delete multiple constructs in a single transaction. Cleans up edges, connections, and attached wagons. Best-effort: per-item results. Optionally accepts pageId to target a specific page.',
  inputSchema: DeleteConstructsInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = DeleteConstructsInput.parse(params);
    const results = deleteConstructsBulk(ydoc, pageId, input.semanticIds);
    return { success: true, data: { results } };
  },
};

export const batchMutateTool: ToolDefinition = {
  name: 'batch_mutate',
  description: `Execute heterogeneous operations in a single transaction. Supports: create, update, delete, connect, disconnect, move. Optionally accepts pageId to target a specific page.

Use "@N" placeholder syntax to reference results from earlier operations in the same batch. Example:
  [
    { "op": "create", "constructType": "service", "values": { "name": "Auth" } },
    { "op": "create", "constructType": "service", "values": { "name": "Gateway" } },
    { "op": "connect", "sourceSemanticId": "@0", "sourcePortId": "flow-out", "targetSemanticId": "@1", "targetPortId": "flow-in" }
  ]
Here "@0" resolves to the semanticId generated by the create at index 0.

For create/update ops, values is a Record keyed by field name from the schema. Use carta_get_schema(type) to discover field names. semanticId is auto-generated for create ops; use "@N" placeholders to reference it in later ops.`,
  inputSchema: BatchMutateInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = BatchMutateInput.parse(params);
    const results = batchMutate(ydoc, pageId, input.operations as any[]);
    return { success: true, data: { results } };
  },
};

export const listOrganizersTool: ToolDefinition = {
  name: 'list_organizers',
  description: 'List all organizers on a page',
  inputSchema: z.object({}),
  needsPage: true,
  execute: (_params, ydoc, pageId) => {
    const organizers = listOrganizers(ydoc, pageId);
    return { success: true, data: { organizers } };
  },
};

export const createOrganizerTool: ToolDefinition = {
  name: 'create_organizer',
  description: 'Create an organizer node to visually group constructs. Use carta_create_construct with parentId to place constructs inside it. Optionally accepts pageId to target a specific page.',
  inputSchema: CreateOrganizerInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = CreateOrganizerInput.parse(params);
    const options: any = {
      name: input.name,
    };
    if (input.color) options.color = input.color;
    if (input.x !== undefined && input.y !== undefined) {
      options.position = { x: input.x, y: input.y };
    }
    if (input.width) options.width = input.width;
    if (input.height) options.height = input.height;
    if (input.layout) options.layout = input.layout;
    if (input.description) options.description = input.description;
    if (input.attachedToSemanticId) options.attachedToSemanticId = input.attachedToSemanticId;

    const organizer = createOrganizer(ydoc, pageId, options);
    return { success: true, data: { organizer } };
  },
};

export const updateOrganizerTool: ToolDefinition = {
  name: 'update_organizer',
  description: 'Update organizer properties (name, color, collapsed, layout, description)',
  inputSchema: UpdateOrganizerInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = UpdateOrganizerInput.parse(params);
    const { organizerId, ...updates } = input;
    const organizer = updateOrganizer(ydoc, pageId, organizerId, updates);
    if (!organizer) {
      return { success: false, error: `Organizer not found: ${organizerId}` };
    }
    return { success: true, data: { organizer } };
  },
};

export const deleteOrganizerTool: ToolDefinition = {
  name: 'delete_organizer',
  description: 'Delete an organizer. By default, detaches member constructs (converts to absolute positions). Set deleteMembers=true to also delete members.',
  inputSchema: DeleteOrganizerInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = DeleteOrganizerInput.parse(params);
    const deleted = deleteOrganizer(ydoc, pageId, input.organizerId, input.deleteMembers ?? false);
    if (!deleted) {
      return { success: false, error: `Failed to delete organizer: ${input.organizerId}` };
    }
    return { success: true, data: { deleted: true } };
  },
};

export const flowLayoutTool: ToolDefinition = {
  name: 'flow_layout',
  description: 'Arrange nodes in topological order along a flow direction. Uses port connections to determine hierarchy — nodes with no incoming flow edges become sources (layer 0). Supports TB/BT/LR/RL directions. Only affects top-level nodes (not inside organizers). Optionally accepts pageId to target a specific page.',
  inputSchema: FlowLayoutInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = FlowLayoutInput.parse(params);
    const options: any = {
      direction: input.direction,
    };
    if (input.sourcePort) options.sourcePort = input.sourcePort;
    if (input.sinkPort) options.sinkPort = input.sinkPort;
    if (input.layerGap) options.layerGap = input.layerGap;
    if (input.nodeGap) options.nodeGap = input.nodeGap;
    if (input.scope) options.scope = input.scope;

    const result = flowLayout(ydoc, pageId, options);
    return { success: true, data: result };
  },
};

export const arrangeTool: ToolDefinition = {
  name: 'arrange',
  description: 'Arrange nodes using declarative constraints. Strategies: "grid" (initial), "preserve" (adjust), "force" (organic spring layout). Constraints: align, order, spacing, group, distribute, position, flow (topological DAG layout). Constraints apply sequentially. Optionally accepts pageId to target a specific page.',
  inputSchema: ArrangeLayoutInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = ArrangeLayoutInput.parse(params);
    const options: any = {
      constraints: input.constraints,
    };
    if (input.strategy) options.strategy = input.strategy;
    if (input.scope) options.scope = input.scope;
    if (input.nodeGap) options.nodeGap = input.nodeGap;
    if (input.forceIterations) options.forceIterations = input.forceIterations;

    const result = arrangeLayout(ydoc, pageId, options);
    return { success: true, data: result };
  },
};

export const pinConstraintTool: ToolDefinition = {
  name: 'pin_constraint',
  description: 'Create a pin constraint between two organizers. Declares that sourceOrganizerId should be positioned relative to targetOrganizerId in the specified direction (N, NE, E, SE, S, SW, W, NW). The constraint is stored per-page and resolved on demand. Optionally accepts pageId to target a specific page.',
  inputSchema: PinConstraintInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = PinConstraintInput.parse(params);
    const options: any = {
      sourceOrganizerId: input.sourceOrganizerId,
      targetOrganizerId: input.targetOrganizerId,
      direction: input.direction,
    };
    if (input.gap !== undefined) options.gap = input.gap;

    const constraint = addPinConstraint(ydoc, pageId, options);
    return { success: true, data: { constraint } };
  },
};

export const listPinConstraintsTool: ToolDefinition = {
  name: 'list_pin_constraints',
  description: 'List all pin constraints for a page. Returns an array of constraints with their IDs, source/target organizer IDs, direction, and optional gap. Optionally accepts pageId to target a specific page.',
  inputSchema: z.object({}),
  needsPage: true,
  execute: (_params, ydoc, pageId) => {
    const constraints = listPinConstraints(ydoc, pageId);
    return { success: true, data: { constraints } };
  },
};

export const removePinConstraintTool: ToolDefinition = {
  name: 'remove_pin_constraint',
  description: 'Remove a pin constraint by ID. Returns success status. Optionally accepts pageId to target a specific page.',
  inputSchema: RemovePinConstraintInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = RemovePinConstraintInput.parse(params);
    const success = removePinConstraint(ydoc, pageId, input.constraintId);
    if (!success) {
      return { success: false, error: `Constraint not found: ${input.constraintId}` };
    }
    return { success: true, data: { success: true } };
  },
};

export const applyPinLayoutTool: ToolDefinition = {
  name: 'apply_pin_layout',
  description: 'Resolve and apply pin constraints to organizer positions. Uses topological sort to determine positioning order, detects cycles, and computes absolute positions from relative constraints. Returns the number of organizers updated and any warnings. Optionally accepts pageId to target a specific page.',
  inputSchema: ApplyPinLayoutInput,
  needsPage: true,
  execute: (params, ydoc, pageId) => {
    const input = ApplyPinLayoutInput.parse(params);
    const options = input.gap !== undefined ? { gap: input.gap } : undefined;
    const result = applyPinLayout(ydoc, pageId, options);
    return { success: true, data: result };
  },
};

export const rebuildPageTool: ToolDefinition = {
  name: 'rebuild_page',
  description: `Rebuild all Yjs data for a page by round-tripping through plain objects. Flushes corrupt Y.Map state, orphaned keys, and stale references while preserving node IDs, positions, fields, edges, and organizer membership. Debug tool — use when a page has rendering issues that don't appear on freshly-created pages.`,
  inputSchema: z.object({}),
  needsPage: true,
  execute: (_params, ydoc, pageId) => {
    const result = rebuildPage(ydoc, pageId);
    return { success: true, data: result };
  },
};

// ============================================================
// Export all page tools
// ============================================================

export const pageTools: ToolDefinition[] = [
  listConstructsTool,
  getConstructTool,
  createConstructTool,
  updateConstructTool,
  deleteConstructTool,
  connectConstructsTool,
  disconnectConstructsTool,
  createConstructsTool,
  connectConstructsBulkTool,
  moveConstructTool,
  deleteConstructsTool,
  batchMutateTool,
  listOrganizersTool,
  createOrganizerTool,
  updateOrganizerTool,
  deleteOrganizerTool,
  flowLayoutTool,
  arrangeTool,
  pinConstraintTool,
  listPinConstraintsTool,
  removePinConstraintTool,
  applyPinLayoutTool,
  rebuildPageTool,
];
