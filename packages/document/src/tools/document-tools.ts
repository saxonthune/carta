/**
 * Document-level tool definitions.
 *
 * These tools operate at document scope and do NOT require a pageId parameter.
 * Includes: schema operations, pages, packages, library, compilation.
 */

import { z } from 'zod';
import {
  listSchemas,
  getSchema,
  createSchema,
  updateSchema,
  removeSchema,
  renameField,
  removeField,
  addField,
  renamePort,
  removePort,
  addPort,
  changePortType,
  renameSchemaType,
  changeFieldType,
  narrowEnumOptions,
  listPages,
  createPage,
  updatePage,
  deletePage,
  setActivePage,
  compile,
  getActivePage,
  listPackages,
  createPackage,
  publishPackage,
  listLibrary,
  applyLibraryEntry,
} from '../doc-operations.js';
import type { ToolDefinition } from './types.js';
import type { ConstructSchema } from '@carta/domain';

// ============================================================
// Zod Schemas (copied from MCP tools, minus documentId)
// ============================================================

const ListSchemasInput = z.object({
  output: z.enum(['compact', 'full']).optional(),
  groupId: z.string().optional(),
});

const GetSchemaInput = z.object({
  type: z.string(),
});

const CreateSchemaInput = z.object({
  type: z.string().describe('Unique type identifier'),
  displayName: z.string().describe('Human-readable name'),
  color: z.string().describe('Hex color for the node'),
  semanticDescription: z.string().optional().describe('Description for AI context'),
  groupId: z.string().optional().describe('Schema group ID for organizing schemas'),
  packageId: z.string().optional().describe('Schema package ID to assign this schema to'),
  backgroundColorPolicy: z.enum(['defaultOnly', 'tints', 'any']).optional().describe('Controls instance color picker'),
  enumIconField: z.string().optional().describe('Field name (type enum) that drives icon marker on nodes'),
  enumIconMap: z.record(z.string()).optional().describe('Enum value → Unicode character mapping'),
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
        displayTier: z.enum(['pill', 'summary']).optional(),
        displayOrder: z.number().optional(),
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

const UpdateSchemaInput = z.object({
  type: z.string().describe('The schema type to update'),
  displayName: z.string().optional(),
  color: z.string().optional(),
  semanticDescription: z.string().optional(),
  groupId: z.string().optional(),
  packageId: z.string().nullable().optional(),
  backgroundColorPolicy: z.enum(['defaultOnly', 'tints', 'any']).optional(),
  nodeShape: z.enum(['default', 'simple', 'circle', 'diamond', 'document']).optional(),
  colorMode: z.enum(['default', 'instance', 'enum']).optional(),
  enumColorField: z.string().optional(),
  enumColorMap: z.record(z.string()).optional(),
  enumIconField: z.string().optional(),
  enumIconMap: z.record(z.string()).optional(),
  fieldUpdates: z.record(z.object({
    label: z.string().optional(),
    semanticDescription: z.string().optional(),
    displayHint: z.enum(['multiline', 'code', 'password', 'url', 'color']).optional(),
    displayTier: z.enum(['pill', 'summary']).optional(),
    displayOrder: z.number().optional(),
    placeholder: z.string().optional(),
  })).optional(),
});

const DeleteSchemaInput = z.object({
  type: z.string(),
});

const RenameFieldInput = z.object({
  schemaType: z.string(),
  oldName: z.string(),
  newName: z.string(),
});

const RemoveFieldInput = z.object({
  schemaType: z.string(),
  fieldName: z.string(),
});

const AddFieldInput = z.object({
  schemaType: z.string(),
  field: z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'enum', 'url']),
    options: z.array(z.string()).optional(),
    label: z.string().optional(),
    displayTier: z.enum(['pill', 'summary']).optional(),
    semanticDescription: z.string().optional(),
  }),
  defaultValue: z.unknown().optional(),
});

const RenamePortInput = z.object({
  schemaType: z.string(),
  oldPortId: z.string(),
  newPortId: z.string(),
});

const RemovePortInput = z.object({
  schemaType: z.string(),
  portId: z.string(),
});

const AddPortInput = z.object({
  schemaType: z.string(),
  portConfig: z.object({
    id: z.string(),
    portType: z.string(),
    label: z.string(),
    suggestedTypes: z.array(z.string()).optional(),
  }),
});

const ChangePortTypeInput = z.object({
  schemaType: z.string(),
  portId: z.string(),
  newPortType: z.string(),
});

const RenameSchemaTypeInput = z.object({
  schemaType: z.string(),
  newType: z.string(),
});

const ChangeFieldTypeInput = z.object({
  schemaType: z.string(),
  fieldName: z.string(),
  newType: z.enum(['string', 'number', 'boolean', 'date', 'enum']),
  force: z.boolean().optional(),
  enumOptions: z.array(z.string()).optional(),
});

const NarrowEnumOptionsInput = z.object({
  schemaType: z.string(),
  fieldName: z.string(),
  newOptions: z.array(z.string()),
  valueMapping: z.record(z.string()).optional(),
});

const CreatePageInput = z.object({
  name: z.string(),
  description: z.string().optional(),
});

const RenamePageInput = z.object({
  pageId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  order: z.number().optional(),
});

const DeletePageInput = z.object({
  pageId: z.string(),
});

const SetActivePageInput = z.object({
  pageId: z.string().optional(),
  pageName: z.string().optional(),
});

const CreatePackageInput = z.object({
  name: z.string(),
  description: z.string().optional(),
  color: z.string(),
});

const GetPackageInput = z.object({
  packageId: z.string(),
});

const PublishPackageInput = z.object({
  packageId: z.string(),
  changelog: z.string().optional(),
});

const GetLibraryEntryInput = z.object({
  entryId: z.string(),
  version: z.number().optional(),
});

const ApplyLibraryEntryInput = z.object({
  entryId: z.string(),
  version: z.number().optional(),
});

// ============================================================
// Tool Definitions
// ============================================================

export const listSchemasTool: ToolDefinition = {
  name: 'list_schemas',
  description: 'List all available construct schemas (built-in and custom). Use output="compact" to reduce token usage.',
  inputSchema: ListSchemasInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = ListSchemasInput.parse(params);
    const schemas = listSchemas(ydoc);

    // Apply filtering
    let filtered = schemas;
    if (input.groupId) {
      filtered = filtered.filter(s => s.groupId === input.groupId);
    }

    // Apply compact mode
    if (input.output === 'compact') {
      const compact = filtered.map(s => ({
        type: s.type,
        displayName: s.displayName,
        groupId: s.groupId,
      }));
      return { success: true, data: { schemas: compact } };
    }

    return { success: true, data: { schemas: filtered } };
  },
};

export const getSchemaTool: ToolDefinition = {
  name: 'get_schema',
  description: 'Get a construct schema by type',
  inputSchema: GetSchemaInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = GetSchemaInput.parse(params);
    const schema = getSchema(ydoc, input.type);
    if (!schema) {
      return { success: false, error: `Schema not found: ${input.type}` };
    }
    return { success: true, data: { schema } };
  },
};

export const createSchemaTool: ToolDefinition = {
  name: 'create_schema',
  description: `Create a custom construct schema.

Required top-level params: type (string, unique identifier), displayName (string), color (string, hex).
Optional top-level params: semanticDescription (string), groupId (string), backgroundColorPolicy ('defaultOnly'|'tints'|'any', default 'defaultOnly'), enumIconField (string, field name), enumIconMap (object, enum value → Unicode char).

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
- backgroundColorPolicy defaults to 'defaultOnly' (no color picker); use 'tints' for 7 swatches or 'any' for full picker`,
  inputSchema: CreateSchemaInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = CreateSchemaInput.parse(params);
    const schema = createSchema(ydoc, input as unknown as ConstructSchema);
    if (!schema) {
      return { success: false, error: `Failed to create schema: ${input.type}` };
    }
    return { success: true, data: { schema } };
  },
};

export const updateSchemaTool: ToolDefinition = {
  name: 'update_schema',
  description: 'Update non-breaking properties of a custom schema (color, displayName, nodeShape, etc). Cannot change type, fields array, or ports array — use migration operations for structural changes. Supports field metadata updates via fieldUpdates map.',
  inputSchema: UpdateSchemaInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = UpdateSchemaInput.parse(params);
    const { type, ...updates } = input;
    const schema = updateSchema(ydoc, type, updates);
    if (!schema) {
      return { success: false, error: `Schema not found: ${type}` };
    }
    return { success: true, data: { schema } };
  },
};

export const deleteSchemaTool: ToolDefinition = {
  name: 'delete_schema',
  description: 'Delete a custom construct schema by type',
  inputSchema: DeleteSchemaInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = DeleteSchemaInput.parse(params);
    const deleted = removeSchema(ydoc, input.type);
    if (!deleted) {
      return { success: false, error: `Failed to delete schema: ${input.type}` };
    }
    return { success: true, data: { deleted: true } };
  },
};

export const renameFieldTool: ToolDefinition = {
  name: 'rename_field',
  description: 'Rename a field in a schema and migrate all instance values to the new name. Updates displayField reference if needed.',
  inputSchema: RenameFieldInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = RenameFieldInput.parse(params);
    renameField(ydoc, input.schemaType, input.oldName, input.newName);
    return { success: true, data: { updated: true } };
  },
};

export const removeFieldTool: ToolDefinition = {
  name: 'remove_field',
  description: 'Remove a field from a schema and delete its values from all instances. Clears displayField reference if needed.',
  inputSchema: RemoveFieldInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = RemoveFieldInput.parse(params);
    removeField(ydoc, input.schemaType, input.fieldName);
    return { success: true, data: { removed: true } };
  },
};

export const addFieldTool: ToolDefinition = {
  name: 'add_field',
  description: 'Add a new field to a schema. Optionally populate existing instances with a default value.',
  inputSchema: AddFieldInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = AddFieldInput.parse(params);
    addField(ydoc, input.schemaType, input.field as any, input.defaultValue);
    return { success: true, data: { added: true } };
  },
};

export const renamePortTool: ToolDefinition = {
  name: 'rename_port',
  description: 'Rename a port in a schema and update all edge connections to use the new port ID.',
  inputSchema: RenamePortInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = RenamePortInput.parse(params);
    renamePort(ydoc, input.schemaType, input.oldPortId, input.newPortId);
    return { success: true, data: { updated: true } };
  },
};

export const removePortTool: ToolDefinition = {
  name: 'remove_port',
  description: 'Remove a port from a schema and delete all edges connected through it.',
  inputSchema: RemovePortInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = RemovePortInput.parse(params);
    const edgesRemoved = removePort(ydoc, input.schemaType, input.portId);
    return { success: true, data: { removed: true, edgesRemoved } };
  },
};

export const addPortTool: ToolDefinition = {
  name: 'add_port',
  description: 'Add a new port to a schema. No instance fixup needed.',
  inputSchema: AddPortInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = AddPortInput.parse(params);
    addPort(ydoc, input.schemaType, input.portConfig as any);
    return { success: true, data: { added: true } };
  },
};

export const changePortTypeTool: ToolDefinition = {
  name: 'change_port_type',
  description: 'Change a port\'s type reference. Disconnects edges that become incompatible with the new port type.',
  inputSchema: ChangePortTypeInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = ChangePortTypeInput.parse(params);
    const edgesDisconnected = changePortType(ydoc, input.schemaType, input.portId, input.newPortType);
    return { success: true, data: { updated: true, edgesDisconnected } };
  },
};

export const renameSchemaTypeTool: ToolDefinition = {
  name: 'rename_schema_type',
  description: 'Rename a schema type. Updates all instances and cross-references in other schemas.',
  inputSchema: RenameSchemaTypeInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = RenameSchemaTypeInput.parse(params);
    renameSchemaType(ydoc, input.schemaType, input.newType);
    return { success: true, data: { renamed: true } };
  },
};

export const changeFieldTypeTool: ToolDefinition = {
  name: 'change_field_type',
  description: 'Change a field\'s data type. Returns a dry-run preview by default showing how many instances would lose data. Set force=true to execute.',
  inputSchema: ChangeFieldTypeInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = ChangeFieldTypeInput.parse(params);
    const result = changeFieldType(
      ydoc,
      input.schemaType,
      input.fieldName,
      input.newType,
      { force: input.force, enumOptions: input.enumOptions }
    );
    return { success: true, data: result };
  },
};

export const narrowEnumOptionsTool: ToolDefinition = {
  name: 'narrow_enum_options',
  description: 'Update enum field options. Remaps values via valueMapping or clears orphaned values.',
  inputSchema: NarrowEnumOptionsInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = NarrowEnumOptionsInput.parse(params);
    const result = narrowEnumOptions(
      ydoc,
      input.schemaType,
      input.fieldName,
      input.newOptions,
      input.valueMapping
    );
    return { success: true, data: result };
  },
};

export const listPagesTool: ToolDefinition = {
  name: 'list_pages',
  description: 'List all pages in a document (returns pages array and activePage ID)',
  inputSchema: z.object({}),
  needsPage: false,
  execute: (_params, ydoc, _pageId) => {
    const pages = listPages(ydoc);
    const activePage = getActivePage(ydoc);
    return { success: true, data: { pages, activePage } };
  },
};

export const createPageTool: ToolDefinition = {
  name: 'create_page',
  description: 'Create a new page in a document',
  inputSchema: CreatePageInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = CreatePageInput.parse(params);
    const page = createPage(ydoc, input.name, input.description);
    return { success: true, data: { page } };
  },
};

export const renamePageTool: ToolDefinition = {
  name: 'rename_page',
  description: 'Rename or update a page (name, description, order)',
  inputSchema: RenamePageInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = RenamePageInput.parse(params);
    const updates: any = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.order !== undefined) updates.order = input.order;

    const page = updatePage(ydoc, input.pageId, updates);
    if (!page) {
      return { success: false, error: `Page not found: ${input.pageId}` };
    }
    return { success: true, data: { page } };
  },
};

export const deletePageTool: ToolDefinition = {
  name: 'delete_page',
  description: 'Delete a page (document must have more than one page)',
  inputSchema: DeletePageInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = DeletePageInput.parse(params);
    const deleted = deletePage(ydoc, input.pageId);
    if (!deleted) {
      return { success: false, error: `Failed to delete page: ${input.pageId}` };
    }
    return { success: true, data: { deleted: true } };
  },
};

export const setActivePageTool: ToolDefinition = {
  name: 'set_active_page',
  description: 'Switch the active page. Returns enriched context: page info, constructs, organizers, edge count, and custom schemas — so you can orient in a single call. Accepts pageName as alternative to pageId.',
  inputSchema: SetActivePageInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = SetActivePageInput.parse(params);

    // Resolve pageId from pageName if needed
    let targetPageId = input.pageId;
    if (!targetPageId && input.pageName) {
      const pages = listPages(ydoc);
      const page = pages.find(p => p.name.toLowerCase() === input.pageName!.toLowerCase());
      if (!page) {
        return { success: false, error: `Page not found: ${input.pageName}` };
      }
      targetPageId = page.id;
    }

    if (!targetPageId) {
      return { success: false, error: 'Either pageId or pageName must be provided' };
    }

    setActivePage(ydoc, targetPageId);

    // Return enriched context (matching MCP behavior)
    const pages = listPages(ydoc);
    const page = pages.find(p => p.id === targetPageId);

    return {
      success: true,
      data: {
        activePage: targetPageId,
        page,
      },
    };
  },
};

export const compileTool: ToolDefinition = {
  name: 'compile',
  description: 'Compile a document to AI-readable output',
  inputSchema: z.object({}),
  needsPage: false,
  execute: (_params, ydoc, pageId) => {
    // compile() needs a pageId - use active page if not provided
    const activePage = pageId || getActivePage(ydoc);
    const output = compile(ydoc, activePage);
    return { success: true, data: { output } };
  },
};

export const listPackagesTool: ToolDefinition = {
  name: 'list_packages',
  description: 'List schema packages with member schema counts.',
  inputSchema: z.object({}),
  needsPage: false,
  execute: (_params, ydoc, _pageId) => {
    const packages = listPackages(ydoc);
    return { success: true, data: { packages } };
  },
};

export const createPackageTool: ToolDefinition = {
  name: 'create_package',
  description: 'Create a schema package for grouping related schemas. Schemas can be assigned to the package via packageId.',
  inputSchema: CreatePackageInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = CreatePackageInput.parse(params);
    const pkg = createPackage(ydoc, {
      name: input.name,
      color: input.color,
      description: input.description,
    });
    return { success: true, data: { package: pkg } };
  },
};

export const getPackageTool: ToolDefinition = {
  name: 'get_package',
  description: 'Get a schema package with its member schemas, port schemas, groups, and relationships.',
  inputSchema: GetPackageInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = GetPackageInput.parse(params);
    // Note: doc-operations doesn't have getPackage, need to implement via listPackages
    const packages = listPackages(ydoc);
    const pkg = packages.find(p => p.id === input.packageId);
    if (!pkg) {
      return { success: false, error: `Package not found: ${input.packageId}` };
    }
    return { success: true, data: pkg };
  },
};

export const publishPackageTool: ToolDefinition = {
  name: 'publish_package',
  description: 'Publish an active package to the in-document library. Creates a versioned snapshot. If published before, bumps the version.',
  inputSchema: PublishPackageInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = PublishPackageInput.parse(params);
    const result = publishPackage(ydoc, {
      packageId: input.packageId,
      changelog: input.changelog,
    });
    return { success: true, data: result };
  },
};

export const listLibraryTool: ToolDefinition = {
  name: 'list_library',
  description: 'List library entries with version summaries.',
  inputSchema: z.object({}),
  needsPage: false,
  execute: (_params, ydoc, _pageId) => {
    const entries = listLibrary(ydoc);
    return { success: true, data: { entries } };
  },
};

export const getLibraryEntryTool: ToolDefinition = {
  name: 'get_library_entry',
  description: 'Get a library entry with its full snapshot at a specific version (or latest).',
  inputSchema: GetLibraryEntryInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = GetLibraryEntryInput.parse(params);

    // Read directly from Yjs to get full entry with snapshots
    const ylibraryEntries = ydoc.getMap('library-entries');
    const yentry = ylibraryEntries.get(input.entryId);
    if (!yentry) {
      return { success: false, error: `Library entry not found: ${input.entryId}` };
    }

    // Convert to plain object
    const entry = JSON.parse(JSON.stringify(yentry)) as any;

    // Get specific version or latest
    if (input.version !== undefined) {
      const versionData = entry.versions?.find((v: any) => v.version === input.version);
      if (!versionData) {
        return { success: false, error: `Version ${input.version} not found for entry ${input.entryId}` };
      }
      return { success: true, data: { entry: { ...entry, snapshot: versionData.snapshot } } };
    }

    // Return latest version
    const latestVersion = entry.versions?.[entry.versions.length - 1];
    return { success: true, data: { entry: { ...entry, snapshot: latestVersion?.snapshot } } };
  },
};

export const applyLibraryEntryTool: ToolDefinition = {
  name: 'apply_library_entry',
  description: 'Apply a library entry to the document as an active package. Creates or updates the package with fork ancestry.',
  inputSchema: ApplyLibraryEntryInput,
  needsPage: false,
  execute: (params, ydoc, _pageId) => {
    const input = ApplyLibraryEntryInput.parse(params);
    const result = applyLibraryEntry(ydoc, {
      entryId: input.entryId,
      version: input.version,
    });
    return { success: true, data: result };
  },
};

// ============================================================
// Export all document tools
// ============================================================

export const documentTools: ToolDefinition[] = [
  listSchemasTool,
  getSchemaTool,
  createSchemaTool,
  updateSchemaTool,
  deleteSchemaTool,
  renameFieldTool,
  removeFieldTool,
  addFieldTool,
  renamePortTool,
  removePortTool,
  addPortTool,
  changePortTypeTool,
  renameSchemaTypeTool,
  changeFieldTypeTool,
  narrowEnumOptionsTool,
  listPagesTool,
  createPageTool,
  renamePageTool,
  deletePageTool,
  setActivePageTool,
  compileTool,
  listPackagesTool,
  createPackageTool,
  getPackageTool,
  publishPackageTool,
  listLibraryTool,
  getLibraryEntryTool,
  applyLibraryEntryTool,
];
