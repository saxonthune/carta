/**
 * MCP Tool definitions for Carta
 */

import { z } from 'zod';
import { portRegistry as defaultPortRegistry } from '@carta/core';
import type { DocumentService } from '../documents/index.js';

// Schemas for tool inputs
const DocumentIdSchema = z.object({
  documentId: z.string().describe('The document ID'),
});

const CreateDocumentSchema = z.object({
  title: z.string().describe('Document title'),
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
  description: z.string().optional().describe('Description for AI context'),
  displayField: z.string().optional().describe('Field to use as node title'),
  fields: z
    .array(
      z.object({
        name: z.string(),
        label: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'date', 'enum']),
        description: z.string().optional(),
        options: z.array(z.string()).optional(),
        default: z.unknown().optional(),
        placeholder: z.string().optional(),
      })
    )
    .describe('Field definitions'),
  ports: z
    .array(
      z.object({
        id: z.string(),
        portType: z.enum(['flow-in', 'flow-out', 'parent', 'child', 'symmetric']),
        position: z.enum(['left', 'right', 'top', 'bottom']),
        offset: z.number(),
        label: z.string(),
        description: z.string().optional(),
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
      name: 'carta_list_active_rooms',
      description: 'List rooms with active browser connections (Yjs collaboration mode only)',
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
      description: 'Create a custom construct schema',
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
      inputSchema: z.object({}).shape,
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
  carta_list_active_rooms: ToolHandler;
  carta_list_documents: ToolHandler;
  carta_get_document: ToolHandler;
  carta_create_document: ToolHandler;
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
 * Create tool handlers
 */
export function createToolHandlers(
  documentService: DocumentService,
  options: ToolHandlerOptions = {}
): ToolHandlers {
  const collabApiUrl = options.collabApiUrl || process.env.CARTA_COLLAB_API_URL || 'http://localhost:1234';

  return {
    carta_list_active_rooms: async () => {
      try {
        const response = await fetch(`${collabApiUrl}/rooms`);
        if (!response.ok) {
          return { error: `Failed to fetch rooms: ${response.statusText}` };
        }
        const { rooms } = (await response.json()) as {
          rooms: Array<{ roomId: string; clientCount: number }>;
        };
        return { rooms };
      } catch (error) {
        return {
          error: `Failed to connect to collab server at ${collabApiUrl}. Is it running?`,
          hint: 'Start the collab server with: npm run collab-server',
        };
      }
    },

    carta_list_documents: async () => {
      const documents = await documentService.listDocuments();
      return { documents };
    },

    carta_get_document: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const document = await documentService.getDocument(documentId);
      if (!document) {
        return { error: `Document not found: ${documentId}` };
      }
      return { document };
    },

    carta_create_document: async (args) => {
      const { title } = CreateDocumentSchema.parse(args);
      const document = await documentService.createDocument(title);
      return { document };
    },

    carta_list_schemas: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const schemas = await documentService.listSchemas(documentId);
      return { schemas };
    },

    carta_get_schema: async (args) => {
      const { documentId, type } = z
        .object({
          documentId: z.string(),
          type: z.string(),
        })
        .parse(args);
      const schema = await documentService.getSchema(documentId, type);
      if (!schema) {
        return { error: `Schema not found: ${type}` };
      }
      return { schema };
    },

    carta_create_schema: async (args) => {
      const input = CreateSchemaInputSchema.parse(args);
      const schema = await documentService.createSchema(input.documentId, {
        type: input.type,
        displayName: input.displayName,
        color: input.color,
        description: input.description,
        displayField: input.displayField,
        fields: input.fields,
        ports: input.ports,
        compilation: { format: 'json' },
      });
      if (!schema) {
        return { error: 'Failed to create schema (document not found or type exists)' };
      }
      return { schema };
    },

    carta_list_constructs: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const constructs = await documentService.listConstructs(documentId);
      return { constructs: constructs.map((c) => c.data) };
    },

    carta_get_construct: async (args) => {
      const { documentId, semanticId } = GetConstructSchema.parse(args);
      const construct = await documentService.getConstruct(documentId, semanticId);
      if (!construct) {
        return { error: `Construct not found: ${semanticId}` };
      }
      return { construct: construct.data };
    },

    carta_create_construct: async (args) => {
      const { documentId, constructType, values, x, y } = CreateConstructSchema.parse(args);
      const construct = await documentService.createConstruct(
        documentId,
        constructType,
        values || {},
        { x: x || 100, y: y || 100 }
      );
      if (!construct) {
        return { error: 'Failed to create construct (document not found)' };
      }
      return { construct: construct.data };
    },

    carta_update_construct: async (args) => {
      const { documentId, semanticId, values, deployableId } = UpdateConstructSchema.parse(args);
      const updates: Record<string, unknown> = {};
      if (values !== undefined) updates.values = values;
      if (deployableId !== undefined) updates.deployableId = deployableId;

      const construct = await documentService.updateConstruct(documentId, semanticId, updates);
      if (!construct) {
        return { error: `Construct not found: ${semanticId}` };
      }
      return { construct: construct.data };
    },

    carta_delete_construct: async (args) => {
      const { documentId, semanticId } = DeleteConstructSchema.parse(args);
      const deleted = await documentService.deleteConstruct(documentId, semanticId);
      return { deleted };
    },

    carta_connect_constructs: async (args) => {
      const input = ConnectConstructsSchema.parse(args);
      const edge = await documentService.connectConstructs(
        input.documentId,
        input.sourceSemanticId,
        input.sourcePortId,
        input.targetSemanticId,
        input.targetPortId
      );
      if (!edge) {
        return { error: 'Failed to connect constructs' };
      }
      return { edge };
    },

    carta_disconnect_constructs: async (args) => {
      const input = DisconnectConstructsSchema.parse(args);
      const disconnected = await documentService.disconnectConstructs(
        input.documentId,
        input.sourceSemanticId,
        input.sourcePortId,
        input.targetSemanticId
      );
      return { disconnected };
    },

    carta_list_port_types: async () => {
      const portTypes = defaultPortRegistry.getAll();
      return { portTypes };
    },

    carta_list_deployables: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const deployables = await documentService.listDeployables(documentId);
      return { deployables };
    },

    carta_create_deployable: async (args) => {
      const { documentId, name, description, color } = CreateDeployableSchema.parse(args);
      const deployable = await documentService.createDeployable(documentId, name, description, color);
      if (!deployable) {
        return { error: 'Failed to create deployable (document not found)' };
      }
      return { deployable };
    },

    carta_compile: async (args) => {
      const { documentId } = DocumentIdSchema.parse(args);
      const output = await documentService.compile(documentId);
      if (output === null) {
        return { error: 'Failed to compile (document not found)' };
      }
      return { output };
    },
  };
}
