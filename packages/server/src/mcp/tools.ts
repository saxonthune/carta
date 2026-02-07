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

const CreateLevelSchema = z.object({
  documentId: z.string().describe('The document ID'),
  name: z.string().describe('Name for the new level'),
  description: z.string().optional().describe('Optional level description'),
});

const RenameLevelSchema = z.object({
  documentId: z.string().describe('The document ID'),
  levelId: z.string().describe('The level ID to update'),
  name: z.string().optional().describe('New level name'),
  description: z.string().optional().describe('New level description'),
  order: z.number().optional().describe('New sort order'),
});

const DeleteLevelSchema = z.object({
  documentId: z.string().describe('The document ID'),
  levelId: z.string().describe('The level ID to delete'),
});

const SetActiveLevelSchema = z.object({
  documentId: z.string().describe('The document ID'),
  levelId: z.string().describe('The level ID to set as active'),
});

const ListSchemasSchema = z.object({
  documentId: z.string().describe('The document ID'),
  output: z.enum(['compact', 'full']).optional().describe('Output mode: "compact" returns {type, displayName, groupId} only. Default: "full"'),
  groupId: z.string().optional().describe('Filter schemas by groupId'),
});

const ListConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  constructType: z.string().optional().describe('Filter by construct type (e.g. "service", "api-endpoint")'),
  levelId: z.string().optional().describe('Target a specific level instead of the active level'),
});

const CreateConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  constructType: z.string().describe('The type of construct to create'),
  values: z.record(z.unknown()).optional().describe('Initial field values'),
  x: z.number().optional().describe('X position on canvas'),
  y: z.number().optional().describe('Y position on canvas'),
  parentId: z.string().optional().describe('Organizer node ID — when set, position is relative to the organizer'),
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
});

const ConnectConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  sourceSemanticId: z.string().describe('Source construct semantic ID'),
  sourcePortId: z.string().describe('Source port ID'),
  targetSemanticId: z.string().describe('Target construct semantic ID'),
  targetPortId: z.string().describe('Target port ID'),
});

const DisconnectConstructsSchema = z.object({
  documentId: z.string().describe('The document ID'),
  sourceSemanticId: z.string().describe('Source construct semantic ID'),
  sourcePortId: z.string().describe('Source port ID'),
  targetSemanticId: z.string().describe('Target construct semantic ID'),
});

const CreateOrganizerSchema = z.object({
  documentId: z.string().describe('The document ID'),
  name: z.string().describe('Organizer name'),
  color: z.string().optional().describe('Hex color (random from palette if omitted)'),
  x: z.number().optional().describe('X position on canvas'),
  y: z.number().optional().describe('Y position on canvas'),
  width: z.number().optional().describe('Width in pixels (default: 400)'),
  height: z.number().optional().describe('Height in pixels (default: 300)'),
  layout: z.enum(['freeform', 'stack', 'grid']).optional().describe('Layout strategy (default: freeform)'),
  description: z.string().optional().describe('Optional description'),
  attachedToSemanticId: z.string().optional().describe('Semantic ID of construct to attach this organizer to (creates a "wagon")'),
});

const UpdateOrganizerSchema = z.object({
  documentId: z.string().describe('The document ID'),
  organizerId: z.string().describe('The organizer node ID'),
  name: z.string().optional().describe('New name'),
  color: z.string().optional().describe('New hex color'),
  collapsed: z.boolean().optional().describe('Collapse/expand the organizer'),
  layout: z.enum(['freeform', 'stack', 'grid']).optional().describe('New layout strategy'),
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
});

const BulkConnectSchema = z.object({
  documentId: z.string().describe('The document ID'),
  connections: z.array(z.object({
    sourceSemanticId: z.string().describe('Source construct semantic ID'),
    sourcePortId: z.string().describe('Source port ID'),
    targetSemanticId: z.string().describe('Target construct semantic ID'),
    targetPortId: z.string().describe('Target port ID'),
  })).describe('Array of connections to create'),
});

const CreateSchemaInputSchema = z.object({
  documentId: z.string().describe('The document ID'),
  type: z.string().describe('Unique type identifier'),
  displayName: z.string().describe('Human-readable name'),
  color: z.string().describe('Hex color for the node'),
  semanticDescription: z.string().optional().describe('Description for AI context'),
  groupId: z.string().optional().describe('Schema group ID for organizing schemas'),
  backgroundColorPolicy: z.enum(['defaultOnly', 'tints', 'any']).optional().describe('Controls instance color picker: "defaultOnly" (no picker), "tints" (7 tint swatches), "any" (full color picker). Default: "defaultOnly"'),
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
        displayTier: z.enum(['pill', 'minimal', 'details', 'full']).optional().describe('Display tier: pill (node title), minimal (collapsed), details (expanded), full (modal only)'),
        displayOrder: z.number().optional().describe('Sort order within a tier (default 0)'),
      })
    )
    .describe('Field definitions'),
  ports: z
    .array(
      z.object({
        id: z.string(),
        portType: z.enum(['flow-in', 'flow-out', 'parent', 'child', 'symmetric', 'intercept', 'relay']),
        position: z.enum(['left', 'right', 'top', 'bottom']),
        offset: z.number(),
        label: z.string(),
        semanticDescription: z.string().optional(),
      })
    )
    .optional()
    .describe('Port configurations'),
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
    },
    {
      name: 'carta_list_documents',
      description: 'List all Carta documents',
      inputSchema: z.object({}).shape,
    },
    {
      name: 'carta_get_document',
      description: 'Get a Carta document by ID',
      inputSchema: DocumentIdSchema.shape,
    },
    {
      name: 'carta_create_document',
      description: 'Create a new Carta document',
      inputSchema: CreateDocumentSchema.shape,
    },
    {
      name: 'carta_delete_document',
      description: 'Delete a Carta document by ID',
      inputSchema: DeleteDocumentSchema.shape,
    },
    {
      name: 'carta_rename_document',
      description: 'Rename a Carta document',
      inputSchema: RenameDocumentSchema.shape,
    },
    {
      name: 'carta_list_levels',
      description: 'List all levels in a document (returns levels array and activeLevel ID)',
      inputSchema: DocumentIdSchema.shape,
    },
    {
      name: 'carta_create_level',
      description: 'Create a new level in a document',
      inputSchema: CreateLevelSchema.shape,
    },
    {
      name: 'carta_rename_level',
      description: 'Rename or update a level (name, description, order)',
      inputSchema: RenameLevelSchema.shape,
    },
    {
      name: 'carta_delete_level',
      description: 'Delete a level (document must have more than one level)',
      inputSchema: DeleteLevelSchema.shape,
    },
    {
      name: 'carta_set_active_level',
      description: 'Switch the active level. Construct and connection operations target the active level.',
      inputSchema: SetActiveLevelSchema.shape,
    },
    {
      name: 'carta_list_schemas',
      description: 'List all available construct schemas (built-in and custom). Use output="compact" to reduce token usage.',
      inputSchema: ListSchemasSchema.shape,
    },
    {
      name: 'carta_get_schema',
      description: 'Get a construct schema by type',
      inputSchema: z.object({
        documentId: z.string(),
        type: z.string(),
      }).shape,
    },
    {
      name: 'carta_create_schema',
      description: `Create a custom construct schema. Smart defaults:
- Primary fields (name, title, label, summary, condition) auto-get displayTier='minimal'
- If no ports specified, adds default ports: flow-in (left), flow-out (right), parent (bottom), child (top)
- backgroundColorPolicy defaults to 'defaultOnly' (no color picker); use 'tints' for 7 swatches or 'any' for full picker
- Use displayTier='pill' on a field to make it the node title (max 1 per schema)`,
      inputSchema: CreateSchemaInputSchema.shape,
    },
    {
      name: 'carta_list_constructs',
      description: 'List constructs in a document (compact summaries). Use carta_get_construct for full details. Optionally filter by constructType or target a specific level.',
      inputSchema: ListConstructsSchema.shape,
    },
    {
      name: 'carta_get_construct',
      description: 'Get a construct by semantic ID',
      inputSchema: GetConstructSchema.shape,
    },
    {
      name: 'carta_create_construct',
      description: 'Create a new construct instance. When parentId is set, position is relative to the organizer.',
      inputSchema: CreateConstructSchema.shape,
    },
    {
      name: 'carta_update_construct',
      description: 'Update an existing construct',
      inputSchema: UpdateConstructSchema.shape,
    },
    {
      name: 'carta_delete_construct',
      description: 'Delete a construct',
      inputSchema: DeleteConstructSchema.shape,
    },
    {
      name: 'carta_connect_constructs',
      description: 'Connect two constructs via ports',
      inputSchema: ConnectConstructsSchema.shape,
    },
    {
      name: 'carta_disconnect_constructs',
      description: 'Disconnect two constructs',
      inputSchema: DisconnectConstructsSchema.shape,
    },
    {
      name: 'carta_create_constructs',
      description: 'Create multiple constructs in a single transaction (all-or-nothing). Nodes without x/y are auto-placed in a grid.',
      inputSchema: BulkCreateConstructsSchema.shape,
    },
    {
      name: 'carta_connect_constructs_bulk',
      description: 'Connect multiple construct pairs in a single call. Best-effort: individual failures are reported, not aborted.',
      inputSchema: BulkConnectSchema.shape,
    },
    {
      name: 'carta_get_document_summary',
      description: 'Get a compact document summary with level/construct/edge counts. Use this for orientation instead of listing all constructs.',
      inputSchema: DocumentIdSchema.shape,
    },
    {
      name: 'carta_create_organizer',
      description: 'Create an organizer node to visually group constructs. Use carta_create_construct with parentId to place constructs inside it.',
      inputSchema: CreateOrganizerSchema.shape,
    },
    {
      name: 'carta_update_organizer',
      description: 'Update organizer properties (name, color, collapsed, layout, description)',
      inputSchema: UpdateOrganizerSchema.shape,
    },
    {
      name: 'carta_delete_organizer',
      description: 'Delete an organizer. By default, detaches member constructs (converts to absolute positions). Set deleteMembers=true to also delete members.',
      inputSchema: DeleteOrganizerSchema.shape,
    },
    {
      name: 'carta_list_port_types',
      description: 'List available port types and their compatibility rules',
      inputSchema: DocumentIdSchema.shape,
    },
    {
      name: 'carta_compile',
      description: 'Compile a document to AI-readable output',
      inputSchema: DocumentIdSchema.shape,
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
  carta_list_levels: ToolHandler;
  carta_create_level: ToolHandler;
  carta_rename_level: ToolHandler;
  carta_delete_level: ToolHandler;
  carta_set_active_level: ToolHandler;
  carta_list_schemas: ToolHandler;
  carta_get_schema: ToolHandler;
  carta_create_schema: ToolHandler;
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

    carta_list_levels: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ levels: unknown[]; activeLevel: string }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/levels`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_level: async (args) => {
      const { documentId, name, description } = CreateLevelSchema.parse(args);
      const result = await apiRequest<{ level: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/levels`,
        { name, description }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_rename_level: async (args) => {
      const { documentId, levelId, name, description, order } = RenameLevelSchema.parse(args);
      const result = await apiRequest<{ level: unknown }>(
        'PATCH',
        `/api/documents/${encodeURIComponent(documentId)}/levels/${encodeURIComponent(levelId)}`,
        { name, description, order }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_delete_level: async (args) => {
      const { documentId, levelId } = DeleteLevelSchema.parse(args);
      const result = await apiRequest<{ deleted: boolean }>(
        'DELETE',
        `/api/documents/${encodeURIComponent(documentId)}/levels/${encodeURIComponent(levelId)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_set_active_level: async (args) => {
      const { documentId, levelId } = SetActiveLevelSchema.parse(args);
      const result = await apiRequest<{ activeLevel: string }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/levels/active`,
        { levelId }
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
          backgroundColorPolicy: input.backgroundColorPolicy,
          fields: input.fields,
          ports: input.ports,
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_constructs: async (args) => {
      const { documentId, constructType, levelId } = ListConstructsSchema.parse(args);
      const params = new URLSearchParams();
      if (constructType) params.set('type', constructType);
      if (levelId) params.set('levelId', levelId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const result = await apiRequest<{ constructs: unknown[]; organizers: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/constructs${qs}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_get_construct: async (args) => {
      const { documentId, semanticId } = GetConstructSchema.parse(args);
      const result = await apiRequest<{ construct: unknown }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/${encodeURIComponent(semanticId)}`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_construct: async (args) => {
      const { documentId, constructType, values, x, y, parentId } = CreateConstructSchema.parse(args);
      const result = await apiRequest<{ construct: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/constructs`,
        { constructType, values, x, y, parentId }
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
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_constructs: async (args) => {
      const { documentId, constructs } = BulkCreateConstructsSchema.parse(args);
      const result = await apiRequest<{ constructs: unknown[] }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/bulk`,
        { constructs }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_connect_constructs_bulk: async (args) => {
      const { documentId, connections } = BulkConnectSchema.parse(args);
      const result = await apiRequest<{ results: unknown[] }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/connections/bulk`,
        { connections }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_get_document_summary: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<unknown>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/summary`
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
  };
}
