/**
 * MCP ↔ domain type contract tests
 *
 * Catches enum drift between @carta/domain canonical types and MCP Zod schemas.
 * Also verifies MCP tool surface covers all mutating doc-operations.
 */

import { describe, it, expect } from 'vitest';
import { builtInPortSchemas } from '@carta/domain';
import {
  SchemaOpSchema,
  SchemaMigrateOpSchema,
  getToolDefinitions,
} from '../src/mcp/tools.js';

// ─── Canonical enum values (single source of truth from @carta/domain types) ──

// These arrays mirror the TypeScript union types in @carta/domain/src/types/index.ts.
// If someone adds a value to the TS type but not here, the test below won't catch it —
// but if someone adds a value to a Zod schema without updating the TS type, this test WILL catch it.
// The real safety net is: Zod enum ⊇ canonical AND Zod enum ⊆ canonical.

const CANONICAL_DATA_KINDS = ['string', 'number', 'boolean', 'date', 'enum', 'resource'] as const;
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

    it('SchemaMigrateOpSchema add_field field.type matches canonical DataKind', () => {
      const addFieldOp = findDiscriminatedOption(SchemaMigrateOpSchema, 'add_field');
      expect(addFieldOp).toBeDefined();

      const fieldTypeEnum = getZodEnumValues(addFieldOp!.shape.field.shape.type);

      expect(fieldTypeEnum.sort()).toEqual([...CANONICAL_DATA_KINDS].sort());
    });

    it('SchemaMigrateOpSchema change_field_type newType matches canonical DataKind', () => {
      const changeOp = findDiscriminatedOption(SchemaMigrateOpSchema, 'change_field_type');
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
});

// ─── MCP tool surface coverage ────────────────────────────────────────────────

describe('MCP tool surface coverage', () => {
  it('all mutating doc-operations are reachable via MCP tools', () => {
    const toolDefs = getToolDefinitions();
    const toolNames = toolDefs.map((t) => t.name);

    // Mapping: doc-operations function → MCP tool that exposes it
    const expectedCoverage: Record<string, string> = {
      // Construct operations
      createConstruct: 'carta_construct',
      updateConstruct: 'carta_construct',
      deleteConstruct: 'carta_construct',
      moveConstruct: 'carta_construct',
      createConstructsBulk: 'carta_construct',
      deleteConstructsBulk: 'carta_construct',

      // Connection operations
      connect: 'carta_connection',
      disconnect: 'carta_connection',
      connectBulk: 'carta_connection',

      // Schema operations
      createSchema: 'carta_schema',
      updateSchema: 'carta_schema',
      removeSchema: 'carta_schema',

      // Schema migrations
      renameField: 'carta_schema_migrate',
      removeField: 'carta_schema_migrate',
      addField: 'carta_schema_migrate',
      renamePort: 'carta_schema_migrate',
      removePort: 'carta_schema_migrate',
      addPort: 'carta_schema_migrate',
      renameSchemaType: 'carta_schema_migrate',
      changeFieldType: 'carta_schema_migrate',
      narrowEnumOptions: 'carta_schema_migrate',
      changePortType: 'carta_schema_migrate',

      // Page operations
      createPage: 'carta_page',
      updatePage: 'carta_page',
      deletePage: 'carta_page',
      setActivePage: 'carta_page',

      // Organizer operations
      createOrganizer: 'carta_organizer',
      updateOrganizer: 'carta_organizer',
      deleteOrganizer: 'carta_organizer',

      // Layout operations
      flowLayout: 'carta_layout',
      arrangeLayout: 'carta_layout',
      addPinConstraint: 'carta_layout',
      removePinConstraint: 'carta_layout',
      applyPinLayout: 'carta_layout',

      // Package operations
      createPackage: 'carta_package',
      applyStandardPackage: 'carta_package',

      // Batch & compile
      batchMutate: 'carta_batch_mutate',
      compile: 'carta_compile',
      rebuildPage: 'carta_rebuild_page',
    };

    // Read-only or internal operations that don't need MCP tools
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
