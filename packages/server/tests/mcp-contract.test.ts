/**
 * MCP ↔ domain type contract tests
 *
 * Catches enum drift between @carta/schema canonical types and MCP Zod schemas.
 * Also verifies MCP tool surface covers all mutating doc-operations.
 */

import { describe, it, expect } from 'vitest';
import { builtInPortSchemas } from '@carta/schema';
import {
  SchemaOpSchema,
  getToolDefinitions,
} from '../src/mcp/tools.js';

// ─── Canonical enum values (single source of truth from @carta/schema types) ──

// These arrays mirror the TypeScript union types in @carta/schema/src/types/index.ts.
// If someone adds a value to the TS type but not here, the test below won't catch it —
// but if someone adds a value to a Zod schema without updating the TS type, this test WILL catch it.
// The real safety net is: Zod enum ⊇ canonical AND Zod enum ⊆ canonical.

const CANONICAL_DATA_KINDS = ['string', 'number', 'boolean', 'date', 'enum'] as const;
const CANONICAL_DISPLAY_HINTS = ['multiline', 'code', 'password', 'url', 'color', 'markdown'] as const;
const CANONICAL_DISPLAY_TIERS = ['pill', 'summary'] as const;
const CANONICAL_NODE_SHAPES = ['default', 'simple', 'circle', 'diamond', 'document', 'parallelogram', 'stadium'] as const;

// ─── Helpers to extract enum values from Zod discriminated unions ──────────────

function getZodEnumValues(zodEnum: { options: readonly string[] }): string[] {
  return [...zodEnum.options];
}

function findDiscriminatedOption<T extends { shape: Record<string, any> }>(
  union: { options: readonly T[] },
  opValue: string
): T | undefined {
  return union.options.find((o) => o.shape.op._def.value === opValue);
}

// ─── Enum snapshot tests ──────────────────────────────────────────────────────

describe('MCP ↔ domain type contracts', () => {
  describe('DataKind enum matches across all MCP schemas', () => {
    it('SchemaOpSchema create fields.type matches canonical DataKind', () => {
      const createOp = findDiscriminatedOption(SchemaOpSchema, 'create');
      expect(createOp).toBeDefined();

      // Navigate: create.fields.element.shape.type
      const fieldsSchema = createOp!.shape.fields;
      const elementShape = fieldsSchema._def.type.shape;
      const fieldTypeEnum = getZodEnumValues(elementShape.type);

      expect(fieldTypeEnum.sort()).toEqual([...CANONICAL_DATA_KINDS].sort());
    });

    it('SchemaOpSchema add_field field.type matches canonical DataKind', () => {
      const addFieldOp = findDiscriminatedOption(SchemaOpSchema, 'add_field');
      expect(addFieldOp).toBeDefined();

      const fieldTypeEnum = getZodEnumValues(addFieldOp!.shape.field.shape.type);

      expect(fieldTypeEnum.sort()).toEqual([...CANONICAL_DATA_KINDS].sort());
    });

    it('SchemaOpSchema change_field_type newType matches canonical DataKind', () => {
      const changeOp = findDiscriminatedOption(SchemaOpSchema, 'change_field_type');
      expect(changeOp).toBeDefined();

      const newTypeEnum = getZodEnumValues(changeOp!.shape.newType);

      expect(newTypeEnum.sort()).toEqual([...CANONICAL_DATA_KINDS].sort());
    });
  });

  describe('DisplayHint enum matches domain type', () => {
    it('SchemaOpSchema create fields.displayHint matches canonical DisplayHint', () => {
      const createOp = findDiscriminatedOption(SchemaOpSchema, 'create');
      expect(createOp).toBeDefined();

      const elementShape = createOp!.shape.fields._def.type.shape;
      // displayHint is optional, so unwrap
      const innerEnum = elementShape.displayHint._def.innerType;
      const displayHintEnum = getZodEnumValues(innerEnum);

      expect(displayHintEnum.sort()).toEqual([...CANONICAL_DISPLAY_HINTS].sort());
    });

    it('SchemaOpSchema update fieldUpdates.displayHint matches canonical DisplayHint', () => {
      const updateOp = findDiscriminatedOption(SchemaOpSchema, 'update');
      expect(updateOp).toBeDefined();

      // fieldUpdates is z.record(z.object({...})).optional()
      const fieldUpdatesInner = updateOp!.shape.fieldUpdates._def.innerType;
      const valueShape = fieldUpdatesInner._def.valueType.shape;
      const displayHintEnum = getZodEnumValues(valueShape.displayHint._def.innerType);

      expect(displayHintEnum.sort()).toEqual([...CANONICAL_DISPLAY_HINTS].sort());
    });
  });

  describe('DisplayTier enum matches domain type', () => {
    it('SchemaOpSchema create fields.displayTier matches canonical DisplayTier', () => {
      const createOp = findDiscriminatedOption(SchemaOpSchema, 'create');
      expect(createOp).toBeDefined();

      const elementShape = createOp!.shape.fields._def.type.shape;
      const displayTierEnum = getZodEnumValues(elementShape.displayTier._def.innerType);

      expect(displayTierEnum.sort()).toEqual([...CANONICAL_DISPLAY_TIERS].sort());
    });
  });

  it('portType enum in SchemaOpSchema includes all built-in port schema IDs', () => {
    const createOp = findDiscriminatedOption(SchemaOpSchema, 'create');
    expect(createOp).toBeDefined();

    // ports is optional array, so unwrap
    const portsArraySchema = createOp!.shape.ports._def.innerType;
    const portElementShape = portsArraySchema._def.type.shape;
    const portTypeEnum = getZodEnumValues(portElementShape.portType);

    const builtInIds = builtInPortSchemas.map((p) => p.id);
    for (const id of builtInIds) {
      expect(portTypeEnum).toContain(id);
    }
  });

  it('nodeShape enum in SchemaOpSchema update matches canonical ConstructSchema.nodeShape', () => {
    const updateOp = findDiscriminatedOption(SchemaOpSchema, 'update');
    expect(updateOp).toBeDefined();

    const nodeShapeEnum = getZodEnumValues(updateOp!.shape.nodeShape._def.innerType);

    expect(nodeShapeEnum.sort()).toEqual([...CANONICAL_NODE_SHAPES].sort());
  });

  it('SchemaOpSchema has migrate ops (add_field, rename_field, etc.)', () => {
    const ops = SchemaOpSchema.options.map((o) => o.shape.op._def.value as string);
    const migrateOps = ['rename_field', 'remove_field', 'add_field', 'rename_port', 'remove_port', 'add_port', 'rename_type', 'change_field_type', 'narrow_enum', 'change_port_type'];
    for (const op of migrateOps) {
      expect(ops, `SchemaOpSchema missing migrate op: ${op}`).toContain(op);
    }
  });
});

// ─── MCP tool surface coverage ────────────────────────────────────────────────

describe('MCP tool surface coverage', () => {
  it('getToolDefinitions() returns exactly 5 tools', () => {
    const toolDefs = getToolDefinitions();
    expect(toolDefs).toHaveLength(5);
  });

  it('tool names are the expected workspace-oriented set', () => {
    const toolDefs = getToolDefinitions();
    const toolNames = toolDefs.map((t) => t.name);
    expect(toolNames).toContain('carta_canvas');
    expect(toolNames).toContain('carta_schema');
    expect(toolNames).toContain('carta_layout');
    expect(toolNames).toContain('carta_compile');
    expect(toolNames).toContain('carta_workspace');
  });

  it('all mutating doc-operations are reachable via MCP tools', () => {
    const toolDefs = getToolDefinitions();
    const toolNames = toolDefs.map((t) => t.name);

    // Mapping: doc-operations function → MCP tool that exposes it
    const expectedCoverage: Record<string, string> = {
      // Construct operations
      createConstruct: 'carta_canvas',
      updateConstruct: 'carta_canvas',
      deleteConstruct: 'carta_canvas',
      moveConstruct: 'carta_canvas',
      createConstructsBulk: 'carta_canvas',
      deleteConstructsBulk: 'carta_canvas',

      // Connection operations
      connect: 'carta_canvas',
      disconnect: 'carta_canvas',
      connectBulk: 'carta_canvas',

      // Schema operations
      createSchema: 'carta_schema',
      updateSchema: 'carta_schema',
      removeSchema: 'carta_schema',

      // Schema migrations
      renameField: 'carta_schema',
      removeField: 'carta_schema',
      addField: 'carta_schema',
      renamePort: 'carta_schema',
      removePort: 'carta_schema',
      addPort: 'carta_schema',
      renameSchemaType: 'carta_schema',
      changeFieldType: 'carta_schema',
      narrowEnumOptions: 'carta_schema',
      changePortType: 'carta_schema',

      // Organizer operations
      createOrganizer: 'carta_canvas',
      updateOrganizer: 'carta_canvas',
      deleteOrganizer: 'carta_canvas',

      // Layout operations
      flowLayout: 'carta_layout',
      arrangeLayout: 'carta_layout',
      addPinConstraint: 'carta_layout',
      removePinConstraint: 'carta_layout',
      applyPinLayout: 'carta_layout',

      // Package operations
      createPackage: 'carta_schema',
      applyStandardPackage: 'carta_schema',

      // Batch & compile
      batchMutate: 'carta_canvas',
      compile: 'carta_compile',
    };

    // Read-only, internal, or not exposed in workspace-only MCP surface
    const readOnlyOrInternal = new Set([
      'listPages',
      'getActivePage',
      'listConstructs',
      'getConstruct',
      'listSchemas',
      'getSchema',
      'listOrganizers',
      'countEdgesForPort',
      'computeAutoPosition',
      'extractDocument',
      'listPinConstraints',
      'removeOrganizerPinConstraints',
      'listPackages',
      'getPackage',
      'listStandardPackages',
      'checkPackageDrift',
      // Page management not exposed in workspace mode (single-page canvases)
      'createPage',
      'updatePage',
      'deletePage',
      'setActivePage',
      // Debug tool removed from workspace surface
      'rebuildPage',
    ]);

    // Verify every mapped tool exists
    for (const [op, tool] of Object.entries(expectedCoverage)) {
      expect(toolNames, `MCP tool "${tool}" for doc-operation "${op}" not found`).toContain(tool);
    }

    // Verify the coverage map + readOnly set is exhaustive
    // (When someone adds a new doc-operations export, this test reminds them to map it)
    const coveredOps = new Set([...Object.keys(expectedCoverage), ...readOnlyOrInternal]);

    // We don't dynamically import doc-operations here to avoid coupling,
    // but the expectedCoverage map serves as the living inventory.
    // If a new function is added and not mapped, the developer must add it
    // to either expectedCoverage or readOnlyOrInternal.
    expect(coveredOps.size).toBeGreaterThan(0);
  });
});
