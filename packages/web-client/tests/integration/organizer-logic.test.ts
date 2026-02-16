import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  getAbsolutePosition,
  canNestInOrganizer,
  computeNewOrganizerBounds,
  computeDetachedNodes,
  collectDescendantIds,
} from '../../src/utils/organizerLogic';
import { toRelativePosition } from '@carta/domain';

// Helper to create a simple test node
function makeNode(id: string, opts: Partial<Node> = {}): Node {
  return {
    id,
    type: opts.type ?? 'construct',
    position: opts.position ?? { x: 0, y: 0 },
    data: opts.data ?? { constructType: 'Task', semanticId: id },
    ...opts,
  };
}

describe('organizerLogic', () => {
  describe('getAbsolutePosition', () => {
    it('should return node position when node has no parent', () => {
      const node = makeNode('node1', { position: { x: 100, y: 200 } });
      const result = getAbsolutePosition(node, [node]);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should return absolute position for child node', () => {
      const parent = makeNode('parent', { position: { x: 50, y: 50 } });
      const child = makeNode('child', {
        position: { x: 25, y: 75 },
        parentId: 'parent',
      });
      const result = getAbsolutePosition(child, [parent, child]);
      expect(result).toEqual({ x: 75, y: 125 });
    });

    it('should walk deeply nested parent chain', () => {
      const grandparent = makeNode('gp', { position: { x: 10, y: 10 } });
      const parent = makeNode('parent', {
        position: { x: 20, y: 30 },
        parentId: 'gp',
      });
      const child = makeNode('child', {
        position: { x: 5, y: 15 },
        parentId: 'parent',
      });
      const result = getAbsolutePosition(child, [grandparent, parent, child]);
      // 10 + 20 + 5 = 35, 10 + 30 + 15 = 55
      expect(result).toEqual({ x: 35, y: 55 });
    });

    it('should return node position when parent is not found', () => {
      const child = makeNode('child', {
        position: { x: 100, y: 200 },
        parentId: 'missing',
      });
      const result = getAbsolutePosition(child, [child]);
      expect(result).toEqual({ x: 100, y: 200 });
    });
  });

  describe('canNestInOrganizer', () => {
    it('should allow construct to nest in any organizer', () => {
      const construct = makeNode('c1', { type: 'construct' });
      const organizer = makeNode('org1', {
        type: 'organizer',
        data: { isOrganizer: true, name: 'Test Org' },
      });
      expect(canNestInOrganizer(construct, organizer, [construct, organizer])).toBe(true);
    });

    it('should reject non-wagon organizer nesting', () => {
      const org1 = makeNode('org1', {
        type: 'organizer',
        data: { isOrganizer: true, name: 'Organizer 1' },
      });
      const org2 = makeNode('org2', {
        type: 'organizer',
        data: { isOrganizer: true, name: 'Organizer 2' },
      });
      expect(canNestInOrganizer(org1, org2, [org1, org2])).toBe(false);
    });

    it('should allow wagon organizer if owner construct is a member', () => {
      const targetOrg = makeNode('targetOrg', {
        type: 'organizer',
        data: { isOrganizer: true, name: 'Target' },
      });
      const ownerConstruct = makeNode('owner', {
        type: 'construct',
        data: { semanticId: 'owner-semantic', constructType: 'Task' },
        parentId: 'targetOrg',
      });
      const wagonOrg = makeNode('wagon', {
        type: 'organizer',
        data: {
          isOrganizer: true,
          name: 'Wagon',
          attachedToSemanticId: 'owner-semantic',
        },
      });
      expect(canNestInOrganizer(wagonOrg, targetOrg, [targetOrg, ownerConstruct, wagonOrg])).toBe(true);
    });

    it('should reject wagon organizer if owner construct is not a member', () => {
      const targetOrg = makeNode('targetOrg', {
        type: 'organizer',
        data: { isOrganizer: true, name: 'Target' },
      });
      const ownerConstruct = makeNode('owner', {
        type: 'construct',
        data: { semanticId: 'owner-semantic', constructType: 'Task' },
        // Not a member of targetOrg
      });
      const wagonOrg = makeNode('wagon', {
        type: 'organizer',
        data: {
          isOrganizer: true,
          name: 'Wagon',
          attachedToSemanticId: 'owner-semantic',
        },
      });
      expect(canNestInOrganizer(wagonOrg, targetOrg, [targetOrg, ownerConstruct, wagonOrg])).toBe(false);
    });
  });

  describe('computeNewOrganizerBounds', () => {
    it('should compute bounds that enclose all selected nodes', () => {
      const node1 = makeNode('n1', {
        position: { x: 100, y: 100 },
        measured: { width: 200, height: 100 },
      });
      const node2 = makeNode('n2', {
        position: { x: 400, y: 300 },
        measured: { width: 200, height: 100 },
      });
      const bounds = computeNewOrganizerBounds([node1, node2], [node1, node2]);

      // Bounds should enclose both nodes with padding
      expect(bounds.x).toBeLessThanOrEqual(100);
      expect(bounds.y).toBeLessThanOrEqual(100);
      expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(600); // 400 + 200
      expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(400); // 300 + 100
    });

    it('should handle nodes without measured dimensions', () => {
      const node1 = makeNode('n1', { position: { x: 0, y: 0 } });
      const node2 = makeNode('n2', { position: { x: 300, y: 200 } });
      const bounds = computeNewOrganizerBounds([node1, node2], [node1, node2]);

      // Should use default dimensions (200x100)
      expect(bounds).toHaveProperty('x');
      expect(bounds).toHaveProperty('y');
      expect(bounds).toHaveProperty('width');
      expect(bounds).toHaveProperty('height');
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    });
  });

  describe('computeDetachedNodes', () => {
    it('should detach members and convert to absolute positions', () => {
      const organizer = makeNode('org', {
        type: 'organizer',
        position: { x: 100, y: 100 },
        data: { isOrganizer: true, name: 'Org' },
      });
      const member1 = makeNode('m1', {
        position: { x: 50, y: 50 }, // relative to organizer
        parentId: 'org',
      });
      const member2 = makeNode('m2', {
        position: { x: 100, y: 150 }, // relative to organizer
        parentId: 'org',
      });
      const outsider = makeNode('out', { position: { x: 500, y: 500 } });

      const result = computeDetachedNodes('org', organizer, [organizer, member1, member2, outsider]);

      expect(result).toHaveLength(3); // organizer is removed

      const detachedM1 = result.find(n => n.id === 'm1');
      expect(detachedM1?.position).toEqual({ x: 150, y: 150 }); // 100 + 50
      expect(detachedM1?.parentId).toBeUndefined();
      expect(detachedM1?.extent).toBeUndefined();

      const detachedM2 = result.find(n => n.id === 'm2');
      expect(detachedM2?.position).toEqual({ x: 200, y: 250 }); // 100 + 100, 100 + 150
      expect(detachedM2?.parentId).toBeUndefined();

      const untouched = result.find(n => n.id === 'out');
      expect(untouched?.position).toEqual({ x: 500, y: 500 }); // unchanged
      expect(untouched?.parentId).toBeUndefined();
    });
  });

  describe('collectDescendantIds', () => {
    it('should collect all descendants recursively', () => {
      const parent = makeNode('parent');
      const child1 = makeNode('c1', { parentId: 'parent' });
      const child2 = makeNode('c2', { parentId: 'parent' });
      const grandchild = makeNode('gc', { parentId: 'c1' });
      const outsider = makeNode('out');

      const ids = collectDescendantIds('parent', [parent, child1, child2, grandchild, outsider]);

      expect(ids.size).toBe(4);
      expect(ids.has('parent')).toBe(true);
      expect(ids.has('c1')).toBe(true);
      expect(ids.has('c2')).toBe(true);
      expect(ids.has('gc')).toBe(true);
      expect(ids.has('out')).toBe(false);
    });

    it('should respect max depth limit', () => {
      const nodes: Node[] = [];
      for (let i = 0; i < 25; i++) {
        nodes.push(makeNode(`n${i}`, { parentId: i > 0 ? `n${i - 1}` : undefined }));
      }

      const ids = collectDescendantIds('n0', nodes, 10);

      // Should stop at depth 10, which processes n0 (depth 0) through n11 (depth 10) = 12 nodes
      expect(ids.size).toBe(12);
      expect(ids.has('n0')).toBe(true);
      expect(ids.has('n11')).toBe(true);
      expect(ids.has('n12')).toBe(false);
    });

    it('should include only the parent if it has no children', () => {
      const parent = makeNode('parent');
      const outsider = makeNode('out');

      const ids = collectDescendantIds('parent', [parent, outsider]);

      expect(ids.size).toBe(1);
      expect(ids.has('parent')).toBe(true);
      expect(ids.has('out')).toBe(false);
    });
  });

  describe('round-trip position conversion', () => {
    it('should preserve absolute position after attach then detach', () => {
      const originalNode = makeNode('node', { position: { x: 100, y: 200 } });
      const organizer = makeNode('org', {
        type: 'organizer',
        position: { x: 50, y: 50 },
        data: { isOrganizer: true, name: 'Org' },
      });

      // Attach: convert to relative position
      const relativePos = toRelativePosition(originalNode.position, organizer.position);
      const attachedNode = makeNode('node', {
        position: relativePos,
        parentId: 'org',
      });

      // Detach: convert back to absolute
      const result = computeDetachedNodes('org', organizer, [organizer, attachedNode]);
      const detached = result.find(n => n.id === 'node');

      expect(detached?.position).toEqual({ x: 100, y: 200 });
      expect(detached?.parentId).toBeUndefined();
    });
  });
});
