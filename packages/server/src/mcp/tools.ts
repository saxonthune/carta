/**
 * MCP Tool definitions for Carta
 *
 * All tools communicate with the collab server via HTTP REST API.
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

const CreateConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  constructType: z.string().describe('The type of construct to create'),
  values: z.record(z.unknown()).optional().describe('Initial field values'),
  x: z.number().optional().describe('X position on canvas'),
  y: z.number().optional().describe('Y position on canvas'),
});

const UpdateConstructSchema = z.object({
  documentId: z.string().describe('The document ID'),
  semanticId: z.string().describe('The semantic ID of the construct'),
  values: z.record(z.unknown()).optional().describe('Field values to update'),
  deployableId: z.string().nullable().optional().describe('Deployable ID to assign'),
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

const CreateSchemaInputSchema = z.object({
  documentId: z.string().describe('The document ID'),
  type: z.string().describe('Unique type identifier'),
  displayName: z.string().describe('Human-readable name'),
  color: z.string().describe('Hex color for the node'),
  semanticDescription: z.string().optional().describe('Description for AI context'),
  displayField: z.string().optional().describe('Field to use as node title'),
  groupId: z.string().optional().describe('Schema group ID for organizing schemas'),
  backgroundColorPolicy: z.enum(['defaultOnly', 'tints', 'any']).optional().describe('Controls instance color picker: "defaultOnly" (no picker), "tints" (7 tint swatches), "any" (full color picker). Default: "defaultOnly"'),
  portDisplayPolicy: z.enum(['inline', 'collapsed']).optional().describe('Controls port display: "inline" (visible handles), "collapsed" (hidden, click icon to reveal). Default: "inline"'),
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
        showInMinimalDisplay: z.boolean().optional().describe('Show this field when node is collapsed (auto-set for primary fields)'),
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

const CreateDeployableSchema = z.object({
  documentId: z.string().describe('The document ID'),
  name: z.string().describe('Deployable name'),
  description: z.string().describe('Deployable description'),
  color: z.string().optional().describe('Hex color'),
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
      name: 'carta_list_schemas',
      description: 'List all available construct schemas (built-in and custom)',
      inputSchema: DocumentIdSchema.shape,
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
- Primary fields (name, title, label, summary, condition) auto-get showInMinimalDisplay=true
- If no ports specified, adds default ports: flow-in (left), flow-out (right), parent (bottom), child (top)
- backgroundColorPolicy defaults to 'defaultOnly' (no color picker); use 'tints' for 7 swatches or 'any' for full picker
- portDisplayPolicy defaults to 'inline' (visible handles); use 'collapsed' for hidden ports with click-to-reveal
- For multiple related schemas, create them sequentially and consider grouping them with carta_create_deployable`,
      inputSchema: CreateSchemaInputSchema.shape,
    },
    {
      name: 'carta_list_constructs',
      description: 'List all constructs in a document',
      inputSchema: DocumentIdSchema.shape,
    },
    {
      name: 'carta_get_construct',
      description: 'Get a construct by semantic ID',
      inputSchema: GetConstructSchema.shape,
    },
    {
      name: 'carta_create_construct',
      description: 'Create a new construct instance',
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
      name: 'carta_list_port_types',
      description: 'List available port types and their compatibility rules',
      inputSchema: DocumentIdSchema.shape,
    },
    {
      name: 'carta_list_deployables',
      description: 'List deployables in a document',
      inputSchema: DocumentIdSchema.shape,
    },
    {
      name: 'carta_create_deployable',
      description: 'Create a deployable grouping',
      inputSchema: CreateDeployableSchema.shape,
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
  carta_list_port_types: ToolHandler;
  carta_list_deployables: ToolHandler;
  carta_create_deployable: ToolHandler;
  carta_compile: ToolHandler;
  [key: string]: ToolHandler;
}

/**
 * Options for creating tool handlers
 */
export interface ToolHandlerOptions {
  collabApiUrl?: string;
}

/**
 * Create tool handlers that communicate via HTTP with the collab server
 */
export function createToolHandlers(options: ToolHandlerOptions = {}): ToolHandlers {
  const apiUrl = options.collabApiUrl || process.env.CARTA_COLLAB_API_URL || 'http://localhost:1234';

  /**
   * Make HTTP request to collab server API
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
        error: `Failed to connect to collab server at ${apiUrl}. Is it running?`,
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
        return { error: result.error, hint: 'Start the collab server with: npm run collab-server' };
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

    carta_list_schemas: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ schemas: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/schemas`
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
          displayField: input.displayField,
          backgroundColorPolicy: input.backgroundColorPolicy,
          portDisplayPolicy: input.portDisplayPolicy,
          fields: input.fields,
          ports: input.ports,
        }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_constructs: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ constructs: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/constructs`
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
      const { documentId, constructType, values, x, y } = CreateConstructSchema.parse(args);
      const result = await apiRequest<{ construct: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/constructs`,
        { constructType, values, x, y }
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_update_construct: async (args) => {
      const { documentId, semanticId, values, deployableId, instanceColor } = UpdateConstructSchema.parse(args);
      const result = await apiRequest<{ construct: unknown }>(
        'PATCH',
        `/api/documents/${encodeURIComponent(documentId)}/constructs/${encodeURIComponent(semanticId)}`,
        { values, deployableId, instanceColor }
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

    carta_list_port_types: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ portTypes: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/port-types`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_list_deployables: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const result = await apiRequest<{ deployables: unknown[] }>(
        'GET',
        `/api/documents/${encodeURIComponent(documentId)}/deployables`
      );
      if (result.error) return { error: result.error };
      return result.data;
    },

    carta_create_deployable: async (args) => {
      const { documentId, name, description, color } = CreateDeployableSchema.parse(args);
      const result = await apiRequest<{ deployable: unknown }>(
        'POST',
        `/api/documents/${encodeURIComponent(documentId)}/deployables`,
        { name, description, color }
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
