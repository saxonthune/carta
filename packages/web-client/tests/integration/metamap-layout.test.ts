/**
 * Test: Metamap Layout Logic
 *
 * Verifies that computeMetamapLayout produces correct node/edge structures:
 * - Empty input returns empty arrays
 * - Ungrouped schemas with sparse edges use grid layout
 * - Schemas inside groups get correct parentId
 * - Collapsed groups remap edges to group node
 * - Nested groups (group inside group) are handled correctly
 *
 * This tests the pure computeMetamapLayout function without React.
 */

import { describe, it, expect } from 'vitest';
import { computeMetamapLayout, SCHEMA_NODE_WIDTH, COLLAPSED_GROUP_WIDTH } from '../../src/utils/metamapLayout';
import type { ConstructSchema, SchemaGroup } from '@carta/domain';

// Helper to create minimal schema
function createSchema(type: string, groupId?: string, suggestedRelated?: ConstructSchema['suggestedRelated']): ConstructSchema {
  return {
    type,
    displayName: type,
    color: '#000000',
    fields: [],
    ports: [],
    groupId,
    suggestedRelated,
  };
}

// Helper to create minimal schema group
function createGroup(id: string, name: string, parentId?: string): SchemaGroup {
  return {
    id,
    name,
    color: '#6366f1',
    parentId,
  };
}

describe('computeMetamapLayout', () => {
  it('returns empty arrays for empty input', () => {
    const result = computeMetamapLayout({
      schemas: [],
      schemaGroups: [],
    });

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.schemaToCollapsedGroup.size).toBe(0);
  });

  it('positions ungrouped schemas in grid when many with sparse edges', () => {
    // Create 8 ungrouped schemas (> 6 threshold) with no edges between them
    const schemas: ConstructSchema[] = [];
    for (let i = 0; i < 8; i++) {
      schemas.push(createSchema(`schema-${i}`));
    }

    const result = computeMetamapLayout({
      schemas,
      schemaGroups: [],
    });

    expect(result.nodes).toHaveLength(8);
    expect(result.edges).toHaveLength(0);

    // All nodes should be schema-node type with no parentId
    for (const node of result.nodes) {
      expect(node.type).toBe('schema-node');
      expect(node.parentId).toBeUndefined();
    }

    // Grid layout should position in 4 columns
    // Check that x positions follow grid pattern (columns 0-3)
    const xPositions = result.nodes.map(n => n.position.x);
    const uniqueXPositions = new Set(xPositions);
    // With 8 nodes in 4 columns, we expect 4 unique x positions
    expect(uniqueXPositions.size).toBe(4);
  });

  it('nests schemas inside their groups with correct parentId', () => {
    const schemas = [
      createSchema('service', 'backend-group'),
      createSchema('database', 'backend-group'),
      createSchema('ui-component'), // ungrouped
    ];

    const schemaGroups = [
      createGroup('backend-group', 'Backend'),
    ];

    const result = computeMetamapLayout({
      schemas,
      schemaGroups,
    });

    // Should have: 1 group node + 2 schema nodes inside + 1 ungrouped schema
    expect(result.nodes).toHaveLength(4);

    // Find the group node
    const groupNode = result.nodes.find(n => n.id === 'group:backend-group');
    expect(groupNode).toBeDefined();
    expect(groupNode!.type).toBe('schema-group');
    expect(groupNode!.parentId).toBeUndefined();

    // Find schemas in the group
    const serviceNode = result.nodes.find(n => n.id === 'service');
    const databaseNode = result.nodes.find(n => n.id === 'database');
    expect(serviceNode).toBeDefined();
    expect(databaseNode).toBeDefined();
    expect(serviceNode!.parentId).toBe('group:backend-group');
    expect(databaseNode!.parentId).toBe('group:backend-group');

    // Ungrouped schema has no parent
    const uiNode = result.nodes.find(n => n.id === 'ui-component');
    expect(uiNode).toBeDefined();
    expect(uiNode!.parentId).toBeUndefined();
  });

  it('collapses groups and remaps edges to group node', () => {
    const schemas = [
      createSchema('service', 'backend-group', [
        { constructType: 'client', label: 'serves' },
      ]),
      createSchema('client'), // ungrouped, has edge from service
    ];

    const schemaGroups = [
      createGroup('backend-group', 'Backend'),
    ];

    // All groups expanded
    const expandedResult = computeMetamapLayout({
      schemas,
      schemaGroups,
      expandedGroups: new Set(['backend-group']),
    });

    // Edge should go from 'service' to 'client'
    expect(expandedResult.edges).toHaveLength(1);
    expect(expandedResult.edges[0].source).toBe('service');
    expect(expandedResult.edges[0].target).toBe('client');

    // Group collapsed
    const collapsedResult = computeMetamapLayout({
      schemas,
      schemaGroups,
      expandedGroups: new Set(), // nothing expanded
    });

    // Edge should be remapped: 'group:backend-group' -> 'client'
    expect(collapsedResult.edges).toHaveLength(1);
    expect(collapsedResult.edges[0].source).toBe('group:backend-group');
    expect(collapsedResult.edges[0].target).toBe('client');

    // Collapsed group should have smaller bounds
    const collapsedGroup = collapsedResult.nodes.find(n => n.id === 'group:backend-group');
    expect(collapsedGroup).toBeDefined();
    expect(collapsedGroup!.style?.width).toBe(COLLAPSED_GROUP_WIDTH);

    // Schema inside collapsed group should NOT be emitted
    const serviceNode = collapsedResult.nodes.find(n => n.id === 'service');
    expect(serviceNode).toBeUndefined();

    // schemaToCollapsedGroup should map service -> backend-group
    expect(collapsedResult.schemaToCollapsedGroup.get('service')).toBe('backend-group');
  });

  it('handles nested groups (group inside group)', () => {
    const schemas = [
      createSchema('api-gateway', 'api-group'),
      createSchema('auth-service', 'auth-group'),
      createSchema('user-db', 'auth-group'),
    ];

    const schemaGroups = [
      createGroup('backend-group', 'Backend'), // root group
      createGroup('api-group', 'API Layer', 'backend-group'), // child of backend
      createGroup('auth-group', 'Auth', 'backend-group'), // child of backend
    ];

    const result = computeMetamapLayout({
      schemas,
      schemaGroups,
      expandedGroups: new Set(['backend-group', 'api-group', 'auth-group']),
    });

    // Should have: 3 group nodes + 3 schema nodes
    expect(result.nodes).toHaveLength(6);

    // Root group has no parent
    const rootGroup = result.nodes.find(n => n.id === 'group:backend-group');
    expect(rootGroup).toBeDefined();
    expect(rootGroup!.parentId).toBeUndefined();

    // Child groups have root as parent
    const apiGroup = result.nodes.find(n => n.id === 'group:api-group');
    const authGroup = result.nodes.find(n => n.id === 'group:auth-group');
    expect(apiGroup).toBeDefined();
    expect(authGroup).toBeDefined();
    expect(apiGroup!.parentId).toBe('group:backend-group');
    expect(authGroup!.parentId).toBe('group:backend-group');

    // Schemas have their direct group as parent
    const apiGateway = result.nodes.find(n => n.id === 'api-gateway');
    const authService = result.nodes.find(n => n.id === 'auth-service');
    const userDb = result.nodes.find(n => n.id === 'user-db');
    expect(apiGateway!.parentId).toBe('group:api-group');
    expect(authService!.parentId).toBe('group:auth-group');
    expect(userDb!.parentId).toBe('group:auth-group');

    // Group data should have correct depth
    expect((rootGroup!.data as { depth: number }).depth).toBe(0);
    expect((apiGroup!.data as { depth: number }).depth).toBe(1);
    expect((authGroup!.data as { depth: number }).depth).toBe(1);
  });
});
