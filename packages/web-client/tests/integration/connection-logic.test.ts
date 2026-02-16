/**
 * Test: Connection Logic Pure Functions
 *
 * Unit tests for pure connection validation and normalization functions.
 * These functions are extracted from MapV2.tsx and have no React dependencies.
 */

import { describe, it, expect } from 'vitest';
import { validateConnection, normalizeConnection } from '../../src/utils/connectionLogic';
import type { ConstructSchema } from '@carta/domain';

// Test schemas with ports
const schemas: Record<string, ConstructSchema> = {
  Service: {
    type: 'Service',
    displayName: 'Service',
    color: '#3b82f6',
    semanticDescription: 'A service component',
    compilation: { format: 'json' },
    ports: [
      { id: 'flow-out', portType: 'flow-out', label: 'Flow Out', semanticDescription: 'Outgoing flow' },
      { id: 'flow-in', portType: 'flow-in', label: 'Flow In', semanticDescription: 'Incoming flow' },
    ],
    fields: [],
  },
  Database: {
    type: 'Database',
    displayName: 'Database',
    color: '#8b5cf6',
    semanticDescription: 'A database component',
    compilation: { format: 'json' },
    ports: [
      { id: 'child', portType: 'child', label: 'Tables', semanticDescription: 'Tables in this database' },
    ],
    fields: [],
  },
  Table: {
    type: 'Table',
    displayName: 'Table',
    color: '#8b5cf6',
    semanticDescription: 'A database table',
    compilation: { format: 'json' },
    ports: [
      { id: 'parent', portType: 'parent', label: 'Database', semanticDescription: 'Parent database' },
      { id: 'link-in', portType: 'flow-in', label: 'Referenced By', semanticDescription: 'References to this table' },
    ],
    fields: [],
  },
};

const mockGetSchema = (type: string) => schemas[type];

const mockNodes: Record<string, { type: string; data: Record<string, unknown> }> = {
  n1: { type: 'construct', data: { constructType: 'Service', semanticId: 'svc-1' } },
  n2: { type: 'construct', data: { constructType: 'Service', semanticId: 'svc-2' } },
  db1: { type: 'construct', data: { constructType: 'Database', semanticId: 'db-1' } },
  tbl1: { type: 'construct', data: { constructType: 'Table', semanticId: 'tbl-1' } },
  org1: { type: 'organizer', data: { name: 'Group' } },
};
const mockFindNode = (id: string) => mockNodes[id];

describe('validateConnection', () => {
  it('rejects self-connections', () => {
    expect(validateConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'n1', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    )).toBe(false);
  });

  it('rejects missing handles', () => {
    expect(validateConnection(
      { source: 'n1', sourceHandle: '', target: 'n2', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    )).toBe(false);
  });

  it('rejects empty target handle', () => {
    expect(validateConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'n2', targetHandle: '' },
      mockGetSchema, mockFindNode
    )).toBe(false);
  });

  it('rejects non-existent nodes', () => {
    expect(validateConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'nonexistent', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    )).toBe(false);
  });

  it('allows valid source→sink connection (flow-out to flow-in)', () => {
    expect(validateConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'n2', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    )).toBe(true);
  });

  it('allows valid parent→child connection', () => {
    expect(validateConnection(
      { source: 'db1', sourceHandle: 'child', target: 'tbl1', targetHandle: 'parent' },
      mockGetSchema, mockFindNode
    )).toBe(true);
  });

  it('allows connections between non-construct nodes', () => {
    expect(validateConnection(
      { source: 'org1', sourceHandle: 'any', target: 'n1', targetHandle: 'any' },
      mockGetSchema, mockFindNode
    )).toBe(true);
  });

  it('rejects incompatible port types', () => {
    // flow-out cannot connect to another flow-out
    expect(validateConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'n2', targetHandle: 'flow-out' },
      mockGetSchema, mockFindNode
    )).toBe(false);
  });

  it('strips handle prefixes before validation', () => {
    // With drawer: prefix
    expect(validateConnection(
      { source: 'n1', sourceHandle: 'drawer:flow-out', target: 'n2', targetHandle: 'drawer:flow-in' },
      mockGetSchema, mockFindNode
    )).toBe(true);
  });

  it('rejects connection when port not found in schema', () => {
    expect(validateConnection(
      { source: 'n1', sourceHandle: 'nonexistent-port', target: 'n2', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    )).toBe(false);
  });
});

describe('normalizeConnection', () => {
  it('returns null for non-construct nodes', () => {
    expect(normalizeConnection(
      { source: 'org1', sourceHandle: 'any', target: 'n1', targetHandle: 'any' },
      mockGetSchema, mockFindNode
    )).toBeNull();
  });

  it('returns null for non-existent nodes', () => {
    expect(normalizeConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'nonexistent', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    )).toBeNull();
  });

  it('returns null when schema not found', () => {
    const nodes = {
      n1: { type: 'construct', data: { constructType: 'UnknownType', semanticId: 'unknown' } },
      n2: { type: 'construct', data: { constructType: 'Service', semanticId: 'svc-2' } },
    };
    expect(normalizeConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'n2', targetHandle: 'flow-in' },
      mockGetSchema, (id) => nodes[id]
    )).toBeNull();
  });

  it('returns null when port not found in schema', () => {
    expect(normalizeConnection(
      { source: 'n1', sourceHandle: 'nonexistent-port', target: 'n2', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    )).toBeNull();
  });

  it('strips handle prefixes', () => {
    const result = normalizeConnection(
      { source: 'n1', sourceHandle: 'drawer:flow-out', target: 'n2', targetHandle: 'drawer:flow-in' },
      mockGetSchema, mockFindNode
    );
    expect(result).toEqual({
      source: 'n1',
      sourceHandle: 'flow-out',
      target: 'n2',
      targetHandle: 'flow-in',
    });
  });

  it('preserves direction for correct source→target (source port to sink port)', () => {
    // flow-out (source polarity) to flow-in (sink polarity) - no flip needed
    const result = normalizeConnection(
      { source: 'n1', sourceHandle: 'flow-out', target: 'n2', targetHandle: 'flow-in' },
      mockGetSchema, mockFindNode
    );
    expect(result).toEqual({
      source: 'n1',
      sourceHandle: 'flow-out',
      target: 'n2',
      targetHandle: 'flow-in',
    });
  });

  it('flips direction when source has sink port and target has source port', () => {
    // User drags from n2.flow-in (sink) to n1.flow-out (source)
    // Should flip so source is n1 (which has the source-polarity port)
    const result = normalizeConnection(
      { source: 'n2', sourceHandle: 'flow-in', target: 'n1', targetHandle: 'flow-out' },
      mockGetSchema, mockFindNode
    );
    expect(result).toEqual({
      source: 'n1',
      sourceHandle: 'flow-out',
      target: 'n2',
      targetHandle: 'flow-in',
    });
  });

  it('flips parent-child connections correctly', () => {
    // User drags from child port (tbl1) to parent port (db1)
    // Should flip so source is db1 (parent port has sink polarity, so no flip)
    // Actually: parent port has source polarity, child has sink
    // So dragging from tbl1.parent (sink) to db1.child (wait, this is backwards)
    // Let me check the actual port polarities:
    // parent port: polarity 'source'
    // child port: polarity 'sink'
    // So if user drags from tbl1.parent (source polarity) to db1.child (sink... wait no)
    // Looking at the schemas above:
    // Table has 'parent' port with portType 'parent' (source polarity)
    // Database has 'child' port with portType 'child' (sink polarity)
    // So if user drags from Table.parent to Database.child:
    // source=tbl1, sourceHandle=parent (source polarity), target=db1, targetHandle=child (sink polarity)
    // No flip needed because source already has source-polarity port
    const result = normalizeConnection(
      { source: 'tbl1', sourceHandle: 'parent', target: 'db1', targetHandle: 'child' },
      mockGetSchema, mockFindNode
    );
    expect(result).toEqual({
      source: 'tbl1',
      sourceHandle: 'parent',
      target: 'db1',
      targetHandle: 'child',
    });
  });

  it('flips when user drags backwards (from child to parent)', () => {
    // User drags from db1.child (sink polarity) to tbl1.parent (source polarity)
    // Should flip so source is tbl1 (which has the source-polarity port)
    const result = normalizeConnection(
      { source: 'db1', sourceHandle: 'child', target: 'tbl1', targetHandle: 'parent' },
      mockGetSchema, mockFindNode
    );
    expect(result).toEqual({
      source: 'tbl1',
      sourceHandle: 'parent',
      target: 'db1',
      targetHandle: 'child',
    });
  });
});
