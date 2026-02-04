/**
 * Test: Group Geometry Pure Functions
 *
 * Unit tests for pure geometry functions used in visual group operations.
 * These functions are in @carta/domain and have no React/DOM dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  computeGroupBounds,
  toRelativePosition,
  toAbsolutePosition,
  computeMinGroupSize,
  sortParentsFirst,
  nodeOverlapsGroup,
  nodeContainedInGroup,
  DEFAULT_GROUP_LAYOUT,
  type NodeGeometry,
  type NodeWithParent,
} from '@carta/domain';

describe('Group Geometry Functions', () => {
  describe('computeGroupBounds', () => {
    it('computes correct bounds for multiple nodes', () => {
      const nodes: NodeGeometry[] = [
        { position: { x: 100, y: 100 }, width: 200, height: 100 },
        { position: { x: 400, y: 200 }, width: 200, height: 100 },
      ];

      const bounds = computeGroupBounds(nodes);

      // Min x = 100, Max x = 400 + 200 = 600
      // Min y = 100, Max y = 200 + 100 = 300
      // With padding 20 and header 40:
      // x = 100 - 20 = 80
      // y = 100 - 20 - 40 = 40
      // width = (600 - 100) + 40 = 540
      // height = (300 - 100) + 40 + 40 = 280
      expect(bounds.x).toBe(80);
      expect(bounds.y).toBe(40);
      expect(bounds.width).toBe(540);
      expect(bounds.height).toBe(280);
    });

    it('computes correct bounds for a single node', () => {
      const nodes: NodeGeometry[] = [
        { position: { x: 100, y: 100 }, width: 200, height: 100 },
      ];

      const bounds = computeGroupBounds(nodes);

      expect(bounds.x).toBe(80);  // 100 - 20
      expect(bounds.y).toBe(40);  // 100 - 20 - 40
      expect(bounds.width).toBe(240);  // 200 + 40
      expect(bounds.height).toBe(180);  // 100 + 40 + 40
    });

    it('handles empty array', () => {
      const bounds = computeGroupBounds([]);

      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      expect(bounds.width).toBe(DEFAULT_GROUP_LAYOUT.padding * 2);
      expect(bounds.height).toBe(DEFAULT_GROUP_LAYOUT.padding * 2 + DEFAULT_GROUP_LAYOUT.headerHeight);
    });

    it('uses measured dimensions when available', () => {
      const nodes: NodeGeometry[] = [
        {
          position: { x: 100, y: 100 },
          width: 200,
          height: 100,
          measured: { width: 250, height: 150 },
        },
      ];

      const bounds = computeGroupBounds(nodes);

      // Should use measured dimensions: 250x150
      expect(bounds.width).toBe(290);  // 250 + 40
      expect(bounds.height).toBe(230);  // 150 + 40 + 40
    });

    it('uses default dimensions when none specified', () => {
      const nodes: NodeGeometry[] = [
        { position: { x: 100, y: 100 } },  // No width/height
      ];

      const bounds = computeGroupBounds(nodes);

      // Defaults: 200x100
      expect(bounds.width).toBe(240);  // 200 + 40
      expect(bounds.height).toBe(180);  // 100 + 40 + 40
    });

    it('accepts custom layout config', () => {
      const nodes: NodeGeometry[] = [
        { position: { x: 100, y: 100 }, width: 200, height: 100 },
      ];

      const bounds = computeGroupBounds(nodes, { padding: 10, headerHeight: 20 });

      expect(bounds.x).toBe(90);   // 100 - 10
      expect(bounds.y).toBe(70);   // 100 - 10 - 20
      expect(bounds.width).toBe(220);   // 200 + 20
      expect(bounds.height).toBe(140);  // 100 + 20 + 20
    });
  });

  describe('toRelativePosition / toAbsolutePosition', () => {
    it('round-trips correctly', () => {
      const nodePos = { x: 150, y: 200 };
      const parentPos = { x: 100, y: 100 };

      const relative = toRelativePosition(nodePos, parentPos);
      const absolute = toAbsolutePosition(relative, parentPos);

      expect(absolute.x).toBe(nodePos.x);
      expect(absolute.y).toBe(nodePos.y);
    });

    it('computes correct relative position', () => {
      const nodePos = { x: 150, y: 200 };
      const parentPos = { x: 100, y: 100 };

      const relative = toRelativePosition(nodePos, parentPos);

      expect(relative.x).toBe(50);
      expect(relative.y).toBe(100);
    });

    it('computes correct absolute position', () => {
      const relativePos = { x: 50, y: 100 };
      const parentPos = { x: 100, y: 100 };

      const absolute = toAbsolutePosition(relativePos, parentPos);

      expect(absolute.x).toBe(150);
      expect(absolute.y).toBe(200);
    });

    it('handles negative positions', () => {
      const nodePos = { x: -50, y: -100 };
      const parentPos = { x: 100, y: 100 };

      const relative = toRelativePosition(nodePos, parentPos);
      expect(relative.x).toBe(-150);
      expect(relative.y).toBe(-200);

      const absolute = toAbsolutePosition(relative, parentPos);
      expect(absolute.x).toBe(nodePos.x);
      expect(absolute.y).toBe(nodePos.y);
    });

    it('handles zero positions', () => {
      const nodePos = { x: 0, y: 0 };
      const parentPos = { x: 0, y: 0 };

      const relative = toRelativePosition(nodePos, parentPos);
      expect(relative.x).toBe(0);
      expect(relative.y).toBe(0);

      const absolute = toAbsolutePosition(relative, parentPos);
      expect(absolute.x).toBe(0);
      expect(absolute.y).toBe(0);
    });
  });

  describe('computeMinGroupSize', () => {
    it('computes minimum size to contain children', () => {
      const children: NodeGeometry[] = [
        { position: { x: 20, y: 60 }, width: 200, height: 100 },
        { position: { x: 20, y: 180 }, width: 200, height: 100 },
      ];

      const size = computeMinGroupSize(children);

      // Max x = 20 + 200 = 220, Max y = 180 + 100 = 280
      // With padding: width = 220 + 20 = 240, height = 280 + 20 = 300
      expect(size.width).toBe(240);
      expect(size.height).toBe(300);
    });

    it('handles empty children array', () => {
      const size = computeMinGroupSize([]);

      expect(size.width).toBe(DEFAULT_GROUP_LAYOUT.padding * 2);
      expect(size.height).toBe(DEFAULT_GROUP_LAYOUT.padding * 2 + DEFAULT_GROUP_LAYOUT.headerHeight);
    });

    it('uses measured dimensions when available', () => {
      const children: NodeGeometry[] = [
        {
          position: { x: 20, y: 60 },
          width: 200,
          height: 100,
          measured: { width: 300, height: 150 },
        },
      ];

      const size = computeMinGroupSize(children);

      // Max x = 20 + 300 = 320, Max y = 60 + 150 = 210
      expect(size.width).toBe(340);  // 320 + 20
      expect(size.height).toBe(230); // 210 + 20
    });
  });

  describe('sortParentsFirst', () => {
    it('places parents before children', () => {
      const nodes: NodeWithParent[] = [
        { id: 'child', parentId: 'parent' },
        { id: 'parent' },
      ];

      const sorted = sortParentsFirst(nodes);

      expect(sorted.map(n => n.id)).toEqual(['parent', 'child']);
    });

    it('handles nested groups', () => {
      const nodes: NodeWithParent[] = [
        { id: 'grandchild', parentId: 'child' },
        { id: 'child', parentId: 'parent' },
        { id: 'parent' },
      ];

      const sorted = sortParentsFirst(nodes);

      expect(sorted.map(n => n.id)).toEqual(['parent', 'child', 'grandchild']);
    });

    it('handles flat list (no parents)', () => {
      const nodes: NodeWithParent[] = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ];

      const sorted = sortParentsFirst(nodes);

      expect(sorted.map(n => n.id)).toEqual(['a', 'b', 'c']);
    });

    it('handles multiple independent groups', () => {
      const nodes: NodeWithParent[] = [
        { id: 'child1', parentId: 'group1' },
        { id: 'child2', parentId: 'group2' },
        { id: 'group1' },
        { id: 'group2' },
      ];

      const sorted = sortParentsFirst(nodes);

      // Groups should come before their children
      const group1Idx = sorted.findIndex(n => n.id === 'group1');
      const child1Idx = sorted.findIndex(n => n.id === 'child1');
      const group2Idx = sorted.findIndex(n => n.id === 'group2');
      const child2Idx = sorted.findIndex(n => n.id === 'child2');

      expect(group1Idx).toBeLessThan(child1Idx);
      expect(group2Idx).toBeLessThan(child2Idx);
    });

    it('handles orphan children (parent not in list)', () => {
      const nodes: NodeWithParent[] = [
        { id: 'orphan', parentId: 'missing-parent' },
        { id: 'regular' },
      ];

      // Should not throw, just include all nodes
      const sorted = sortParentsFirst(nodes);

      expect(sorted.length).toBe(2);
      expect(sorted.map(n => n.id)).toContain('orphan');
      expect(sorted.map(n => n.id)).toContain('regular');
    });

    it('preserves extra properties on nodes', () => {
      interface ExtendedNode extends NodeWithParent {
        extra: string;
      }

      const nodes: ExtendedNode[] = [
        { id: 'child', parentId: 'parent', extra: 'child-data' },
        { id: 'parent', extra: 'parent-data' },
      ];

      const sorted = sortParentsFirst(nodes);

      expect(sorted[0].extra).toBe('parent-data');
      expect(sorted[1].extra).toBe('child-data');
    });
  });

  describe('nodeOverlapsGroup', () => {
    it('returns true when node overlaps group', () => {
      const result = nodeOverlapsGroup(
        { x: 150, y: 150 },  // node position
        { width: 100, height: 100 },  // node size
        { x: 100, y: 100 },  // group position
        { width: 200, height: 200 }  // group size
      );

      expect(result).toBe(true);
    });

    it('returns false when node is outside group', () => {
      const result = nodeOverlapsGroup(
        { x: 500, y: 500 },  // node position (far away)
        { width: 100, height: 100 },
        { x: 100, y: 100 },
        { width: 200, height: 200 }
      );

      expect(result).toBe(false);
    });

    it('returns true when node partially overlaps group', () => {
      const result = nodeOverlapsGroup(
        { x: 250, y: 250 },  // node starts at edge of group
        { width: 100, height: 100 },
        { x: 100, y: 100 },
        { width: 200, height: 200 }  // group ends at 300,300
      );

      expect(result).toBe(true);
    });

    it('returns false when nodes only touch at edge (no overlap)', () => {
      const result = nodeOverlapsGroup(
        { x: 300, y: 100 },  // node starts exactly where group ends
        { width: 100, height: 100 },
        { x: 100, y: 100 },
        { width: 200, height: 200 }  // group ends at x=300
      );

      expect(result).toBe(false);
    });
  });

  describe('nodeContainedInGroup', () => {
    it('returns true when node is fully inside group', () => {
      const result = nodeContainedInGroup(
        { x: 120, y: 120 },  // node position
        { width: 50, height: 50 },  // node size (fits inside)
        { x: 100, y: 100 },  // group position
        { width: 200, height: 200 }  // group size
      );

      expect(result).toBe(true);
    });

    it('returns false when node extends outside group', () => {
      const result = nodeContainedInGroup(
        { x: 200, y: 200 },  // node starts inside
        { width: 150, height: 150 },  // but extends outside (200+150=350 > 300)
        { x: 100, y: 100 },
        { width: 200, height: 200 }  // group ends at 300
      );

      expect(result).toBe(false);
    });

    it('returns false when node is completely outside', () => {
      const result = nodeContainedInGroup(
        { x: 500, y: 500 },
        { width: 100, height: 100 },
        { x: 100, y: 100 },
        { width: 200, height: 200 }
      );

      expect(result).toBe(false);
    });

    it('returns true when node exactly fits group', () => {
      const result = nodeContainedInGroup(
        { x: 100, y: 100 },
        { width: 200, height: 200 },
        { x: 100, y: 100 },
        { width: 200, height: 200 }
      );

      expect(result).toBe(true);
    });
  });
});
