import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  getAbsolutePosition,
  toRelativePosition,
  getTopLevelLayoutItems,
  getTopLevelEdges,
  convertToConstructPositions,
  ORGANIZER_CONTENT_TOP,
} from '../../src/hooks/useLayoutActions.js';
import { computeAlignment, computeDistribution } from '../../src/utils/layoutGeometry.js';

describe('Layout Geometry Helpers', () => {
  describe('getAbsolutePosition', () => {
    it('node without parent returns node.position', () => {
      const node: Node = {
        id: 'n1',
        type: 'default',
        position: { x: 100, y: 200 },
        data: {},
      };
      const allNodes: Node[] = [node];

      const result = getAbsolutePosition(node, allNodes);

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('node with parent returns parent.position + node.position', () => {
      const parent: Node = {
        id: 'parent',
        type: 'organizer',
        position: { x: 50, y: 75 },
        data: {},
      };
      const child: Node = {
        id: 'child',
        type: 'default',
        position: { x: 10, y: 20 },
        parentId: 'parent',
        data: {},
      };
      const allNodes: Node[] = [parent, child];

      const result = getAbsolutePosition(child, allNodes);

      expect(result).toEqual({ x: 60, y: 95 });
    });

    it('nested parents walks chain correctly', () => {
      const grandparent: Node = {
        id: 'gp',
        type: 'organizer',
        position: { x: 10, y: 10 },
        data: {},
      };
      const parent: Node = {
        id: 'parent',
        type: 'organizer',
        position: { x: 20, y: 30 },
        parentId: 'gp',
        data: {},
      };
      const child: Node = {
        id: 'child',
        type: 'default',
        position: { x: 5, y: 7 },
        parentId: 'parent',
        data: {},
      };
      const allNodes: Node[] = [grandparent, parent, child];

      const result = getAbsolutePosition(child, allNodes);

      // 10 + 20 + 5 = 35, 10 + 30 + 7 = 47
      expect(result).toEqual({ x: 35, y: 47 });
    });
  });

  describe('toRelativePosition', () => {
    it('round-trip: toRelativePosition(getAbsolutePosition(child)) ≈ child.position', () => {
      const parent: Node = {
        id: 'parent',
        type: 'organizer',
        position: { x: 100, y: 200 },
        data: {},
      };
      const child: Node = {
        id: 'child',
        type: 'default',
        position: { x: 25, y: 50 },
        parentId: 'parent',
        data: {},
      };
      const allNodes: Node[] = [parent, child];

      const absolutePos = getAbsolutePosition(child, allNodes);
      const parentAbsolutePos = getAbsolutePosition(parent, allNodes);
      const relativePos = toRelativePosition(absolutePos, parentAbsolutePos);

      expect(relativePos).toEqual({ x: 25, y: 50 });
    });
  });

  describe('getTopLevelLayoutItems', () => {
    it('filters to only top-level nodes (no parentId)', () => {
      const nodes: Node[] = [
        { id: 'top1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: 'top2', type: 'default', position: { x: 100, y: 100 }, data: {} },
        { id: 'child', type: 'default', position: { x: 10, y: 10 }, parentId: 'top1', data: {} },
      ];

      const computeLayoutUnits = (ids: string[]) => new Map([
        ['top1', { width: 100, height: 50 }],
        ['top2', { width: 80, height: 60 }],
      ]);

      const result = getTopLevelLayoutItems(nodes, computeLayoutUnits);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(['top1', 'top2']);
    });

    it('organizers use style width/height', () => {
      const nodes: Node[] = [
        {
          id: 'org1',
          type: 'organizer',
          position: { x: 0, y: 0 },
          data: {},
          style: { width: 300, height: 200 },
        },
      ];

      const computeLayoutUnits = () => new Map();

      const result = getTopLevelLayoutItems(nodes, computeLayoutUnits);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'org1',
        width: 300,
        height: 200,
      });
    });
  });

  describe('getTopLevelEdges', () => {
    it('edges between top-level nodes pass through', () => {
      const nodes: Node[] = [
        { id: 'n1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'default', position: { x: 100, y: 0 }, data: {} },
      ];
      const edges = [
        { source: 'n1', target: 'n2' },
      ];
      const topLevelIds = new Set(['n1', 'n2']);

      const result = getTopLevelEdges(nodes, edges, topLevelIds);

      expect(result).toEqual([{ source: 'n1', target: 'n2' }]);
    });

    it('edges between children of same organizer are dropped (internal)', () => {
      const nodes: Node[] = [
        { id: 'org1', type: 'organizer', position: { x: 0, y: 0 }, data: {} },
        { id: 'child1', type: 'default', position: { x: 10, y: 10 }, parentId: 'org1', data: {} },
        { id: 'child2', type: 'default', position: { x: 20, y: 20 }, parentId: 'org1', data: {} },
      ];
      const edges = [
        { source: 'child1', target: 'child2' },
      ];
      const topLevelIds = new Set(['org1']);

      const result = getTopLevelEdges(nodes, edges, topLevelIds);

      expect(result).toEqual([]);
    });

    it('edges from child to external node map to organizer ID', () => {
      const nodes: Node[] = [
        { id: 'org1', type: 'organizer', position: { x: 0, y: 0 }, data: {} },
        { id: 'child1', type: 'default', position: { x: 10, y: 10 }, parentId: 'org1', data: {} },
        { id: 'n2', type: 'default', position: { x: 200, y: 0 }, data: {} },
      ];
      const edges = [
        { source: 'child1', target: 'n2' },
      ];
      const topLevelIds = new Set(['org1', 'n2']);

      const result = getTopLevelEdges(nodes, edges, topLevelIds);

      expect(result).toEqual([{ source: 'org1', target: 'n2' }]);
    });

    it('duplicate edges are deduplicated', () => {
      const nodes: Node[] = [
        { id: 'org1', type: 'organizer', position: { x: 0, y: 0 }, data: {} },
        { id: 'child1', type: 'default', position: { x: 10, y: 10 }, parentId: 'org1', data: {} },
        { id: 'child2', type: 'default', position: { x: 20, y: 20 }, parentId: 'org1', data: {} },
        { id: 'n2', type: 'default', position: { x: 200, y: 0 }, data: {} },
      ];
      const edges = [
        { source: 'child1', target: 'n2' },
        { source: 'child2', target: 'n2' },
      ];
      const topLevelIds = new Set(['org1', 'n2']);

      const result = getTopLevelEdges(nodes, edges, topLevelIds);

      // Both edges map to org1->n2, should be deduplicated
      expect(result).toEqual([{ source: 'org1', target: 'n2' }]);
    });
  });

  describe('convertToConstructPositions', () => {
    it('subtracts offsets from positions correctly', () => {
      const newPositions = new Map([
        ['n1', { x: 100, y: 200 }],
        ['n2', { x: 150, y: 250 }],
      ]);
      const offsets = new Map([
        ['n1', { x: 10, y: 20 }],
        ['n2', { x: 5, y: 15 }],
      ]);

      const result = convertToConstructPositions(newPositions, offsets);

      expect(result.get('n1')).toEqual({ x: 90, y: 180 });
      expect(result.get('n2')).toEqual({ x: 145, y: 235 });
    });

    it('missing offset defaults to (0, 0)', () => {
      const newPositions = new Map([
        ['n1', { x: 100, y: 200 }],
      ]);
      const offsets = new Map();

      const result = convertToConstructPositions(newPositions, offsets);

      expect(result.get('n1')).toEqual({ x: 100, y: 200 });
    });
  });
});

describe('Layout Geometry Functions', () => {
  describe('computeAlignment', () => {
    const nodes = [
      { id: 'n1', x: 10, y: 20, width: 50, height: 30 },
      { id: 'n2', x: 100, y: 50, width: 60, height: 40 },
      { id: 'n3', x: 50, y: 80, width: 70, height: 35 },
    ];

    it('left - all nodes share minimum x', () => {
      const result = computeAlignment(nodes, 'left');

      const minX = 10;
      expect(result.get('n1')?.x).toBe(minX);
      expect(result.get('n2')?.x).toBe(minX);
      expect(result.get('n3')?.x).toBe(minX);
      // y values unchanged
      expect(result.get('n1')?.y).toBe(20);
      expect(result.get('n2')?.y).toBe(50);
      expect(result.get('n3')?.y).toBe(80);
    });

    it('center - all node centers share same x (average of original centers)', () => {
      const result = computeAlignment(nodes, 'center');

      // Calculate average center X
      const avgCenterX = (
        (10 + 50/2) + (100 + 60/2) + (50 + 70/2)
      ) / 3;
      // avgCenterX = (35 + 130 + 85) / 3 = 250/3 ≈ 83.333...

      // Check all centers align to avgCenterX
      expect(result.get('n1')!.x + 50/2).toBeCloseTo(avgCenterX);
      expect(result.get('n2')!.x + 60/2).toBeCloseTo(avgCenterX);
      expect(result.get('n3')!.x + 70/2).toBeCloseTo(avgCenterX);

      // y values unchanged
      expect(result.get('n1')?.y).toBe(20);
      expect(result.get('n2')?.y).toBe(50);
      expect(result.get('n3')?.y).toBe(80);
    });

    it('right - all right edges share maximum right edge', () => {
      const result = computeAlignment(nodes, 'right');

      const maxRight = Math.max(10+50, 100+60, 50+70); // 160
      expect(result.get('n1')!.x + 50).toBe(maxRight);
      expect(result.get('n2')!.x + 60).toBe(maxRight);
      expect(result.get('n3')!.x + 70).toBe(maxRight);

      // y values unchanged
      expect(result.get('n1')?.y).toBe(20);
      expect(result.get('n2')?.y).toBe(50);
      expect(result.get('n3')?.y).toBe(80);
    });

    it('top - all nodes share minimum y', () => {
      const result = computeAlignment(nodes, 'top');

      const minY = 20;
      expect(result.get('n1')?.y).toBe(minY);
      expect(result.get('n2')?.y).toBe(minY);
      expect(result.get('n3')?.y).toBe(minY);

      // x values unchanged
      expect(result.get('n1')?.x).toBe(10);
      expect(result.get('n2')?.x).toBe(100);
      expect(result.get('n3')?.x).toBe(50);
    });

    it('middle - all node centers share same y (average of original centers)', () => {
      const result = computeAlignment(nodes, 'middle');

      // Calculate average center Y
      const avgCenterY = (
        (20 + 30/2) + (50 + 40/2) + (80 + 35/2)
      ) / 3;
      // avgCenterY = (35 + 70 + 97.5) / 3 = 202.5/3 = 67.5

      // Check all centers align to avgCenterY
      expect(result.get('n1')!.y + 30/2).toBeCloseTo(avgCenterY);
      expect(result.get('n2')!.y + 40/2).toBeCloseTo(avgCenterY);
      expect(result.get('n3')!.y + 35/2).toBeCloseTo(avgCenterY);

      // x values unchanged
      expect(result.get('n1')?.x).toBe(10);
      expect(result.get('n2')?.x).toBe(100);
      expect(result.get('n3')?.x).toBe(50);
    });

    it('bottom - all bottom edges share maximum bottom edge', () => {
      const result = computeAlignment(nodes, 'bottom');

      const maxBottom = Math.max(20+30, 50+40, 80+35); // 115
      expect(result.get('n1')!.y + 30).toBe(maxBottom);
      expect(result.get('n2')!.y + 40).toBe(maxBottom);
      expect(result.get('n3')!.y + 35).toBe(maxBottom);

      // x values unchanged
      expect(result.get('n1')?.x).toBe(10);
      expect(result.get('n2')?.x).toBe(100);
      expect(result.get('n3')?.x).toBe(50);
    });
  });

  describe('computeDistribution', () => {
    it('horizontal with 3 nodes - first and last stay put, middle is centered between them', () => {
      const nodes = [
        { id: 'n1', x: 0, y: 50, width: 50, height: 30 },
        { id: 'n2', x: 100, y: 50, width: 60, height: 30 },
        { id: 'n3', x: 300, y: 50, width: 70, height: 30 },
      ];

      const result = computeDistribution(nodes, 'horizontal');

      // First stays at x=0
      expect(result.get('n1')).toEqual({ x: 0, y: 50 });

      // Last stays at x=300
      expect(result.get('n3')).toEqual({ x: 300, y: 50 });

      // Calculate expected middle position
      // span = (300 + 70) - 0 = 370
      // totalWidth = 50 + 60 + 70 = 180
      // gap = (370 - 180) / 2 = 95
      // n2 should be at: 0 + 50 + 95 = 145
      expect(result.get('n2')).toEqual({ x: 145, y: 50 });
    });

    it('vertical with 3 nodes - same property vertically', () => {
      const nodes = [
        { id: 'n1', x: 100, y: 0, width: 50, height: 40 },
        { id: 'n2', x: 100, y: 150, width: 50, height: 50 },
        { id: 'n3', x: 100, y: 400, width: 50, height: 60 },
      ];

      const result = computeDistribution(nodes, 'vertical');

      // First stays at y=0
      expect(result.get('n1')).toEqual({ x: 100, y: 0 });

      // Last stays at y=400
      expect(result.get('n3')).toEqual({ x: 100, y: 400 });

      // Calculate expected middle position
      // span = (400 + 60) - 0 = 460
      // totalHeight = 40 + 50 + 60 = 150
      // gap = (460 - 150) / 2 = 155
      // n2 should be at: 0 + 40 + 155 = 195
      expect(result.get('n2')).toEqual({ x: 100, y: 195 });
    });

    it('equal-sized nodes - gaps are uniform', () => {
      const nodes = [
        { id: 'n1', x: 0, y: 0, width: 50, height: 50 },
        { id: 'n2', x: 100, y: 0, width: 50, height: 50 },
        { id: 'n3', x: 200, y: 0, width: 50, height: 50 },
      ];

      const result = computeDistribution(nodes, 'horizontal');

      // span = (200 + 50) - 0 = 250
      // totalWidth = 150
      // gap = (250 - 150) / 2 = 50

      expect(result.get('n1')).toEqual({ x: 0, y: 0 });
      expect(result.get('n2')).toEqual({ x: 100, y: 0 }); // 0 + 50 + 50
      expect(result.get('n3')).toEqual({ x: 200, y: 0 }); // 100 + 50 + 50
    });
  });

  describe('ORGANIZER_CONTENT_TOP constant', () => {
    it('is exported and is a number', () => {
      expect(typeof ORGANIZER_CONTENT_TOP).toBe('number');
      expect(ORGANIZER_CONTENT_TOP).toBeGreaterThan(0);
    });
  });
});
