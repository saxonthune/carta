/**
 * Test: Layout Action Glue Functions
 *
 * Integration tests for the wagon-aware glue functions that translate CartaNode
 * trees into geometry inputs for layout algorithms.
 *
 * Tests: getChildLayoutUnits, getChildVisualFootprints, convertToConstructPositions
 * Does NOT re-test: computeLayoutUnitBounds, computeLayoutUnitSizes, or any @carta/geometry primitives.
 */

import { describe, it, expect } from 'vitest';
import { makeConstruct, makeOrganizer, makeWagon } from '../helpers/scenario-builder';
import {
  getChildLayoutUnits,
  getChildVisualFootprints,
  convertToConstructPositions,
} from '../../src/hooks/useLayoutActions';

// Default construct dims from getNodeDimensions fallback
const DEFAULT_CONSTRUCT_W = 280;
const DEFAULT_CONSTRUCT_H = 100;

// Default organizer dims from getNodeDimensions fallback
const DEFAULT_ORGANIZER_W = 400;
const DEFAULT_ORGANIZER_H = 300;

describe('getChildLayoutUnits', () => {
  describe('empty organizer', () => {
    it('returns empty items and empty offsets map', () => {
      const org = makeOrganizer('org1');
      const { items, offsets } = getChildLayoutUnits([org], 'org1');
      expect(items).toHaveLength(0);
      expect(offsets.size).toBe(0);
    });
  });

  describe('children without wagons', () => {
    it('item count equals direct children count', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const c2 = makeConstruct('c2', { parentId: 'org1', position: { x: 20, y: 180 }, width: 200, height: 100 });

      const { items, offsets } = getChildLayoutUnits([org, c1, c2], 'org1');

      expect(items).toHaveLength(2);
      expect(offsets.size).toBe(2);
    });

    it('all offsets are {x:0, y:0}', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const c2 = makeConstruct('c2', { parentId: 'org1', position: { x: 20, y: 180 }, width: 200, height: 100 });

      const { offsets } = getChildLayoutUnits([org, c1, c2], 'org1');

      expect(offsets.get('c1')).toEqual({ x: 0, y: 0 });
      expect(offsets.get('c2')).toEqual({ x: 0, y: 0 });
    });

    it('item dimensions match explicit node dimensions', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', width: 200, height: 100 });

      const { items } = getChildLayoutUnits([org, c1], 'org1');

      const item = items.find(i => i.id === 'c1');
      expect(item?.width).toBe(200);
      expect(item?.height).toBe(100);
    });

    it('item dimensions use type-based defaults when no dimensions specified', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1' }); // no width/height

      const { items, offsets } = getChildLayoutUnits([org, c1], 'org1');

      const item = items.find(i => i.id === 'c1');
      expect(item?.width).toBe(DEFAULT_CONSTRUCT_W);
      expect(item?.height).toBe(DEFAULT_CONSTRUCT_H);
      expect(offsets.get('c1')).toEqual({ x: 0, y: 0 });
    });

    it('every child ID appears in both items and offsets', () => {
      const org = makeOrganizer('org1');
      const children = [
        makeConstruct('c1', { parentId: 'org1', width: 200, height: 100 }),
        makeConstruct('c2', { parentId: 'org1', width: 200, height: 100 }),
        makeConstruct('c3', { parentId: 'org1', width: 200, height: 100 }),
      ];
      const allNodes = [org, ...children];

      const { items, offsets } = getChildLayoutUnits(allNodes, 'org1');

      const itemIds = new Set(items.map(i => i.id));
      for (const child of children) {
        expect(itemIds.has(child.id)).toBe(true);
        expect(offsets.has(child.id)).toBe(true);
      }
    });
  });

  describe('child with a wagon to the right', () => {
    it('item width is expanded beyond construct base dimensions', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      // Wagon to the right: x=210 (beyond construct right edge at 200)
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 150, height: 80 },
      });

      const { items, offsets } = getChildLayoutUnits([org, c1, w1], 'org1');

      expect(items).toHaveLength(1);
      const item = items[0];
      // Expanded width = max(200, 210+150) = 360 > 200
      expect(item.width).toBeGreaterThan(200);
      // Width is exactly construct.width + wagon right edge
      expect(item.width).toBe(360);
      // Wagon is to the right (non-negative x), so offsetX = 0
      expect(offsets.get('c1')?.x).toBe(0);
      expect(offsets.get('c1')?.y).toBe(0);
    });

    it('item height unchanged when wagon is narrower and lower', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 150, height: 80 },  // wagon is shorter (80 < 100)
      });

      const { items } = getChildLayoutUnits([org, c1, w1], 'org1');

      const item = items[0];
      // height = max(100, 0+80) = 100 (construct height wins)
      expect(item.height).toBe(100);
    });
  });

  describe('child with a wagon above (negative y offset)', () => {
    it('offset Y is negative when wagon extends above construct', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      // Wagon above: y=-80 (above construct top)
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 0, y: -80 },
        style: { width: 150, height: 50 },
      });

      const { items, offsets } = getChildLayoutUnits([org, c1, w1], 'org1');

      const offset = offsets.get('c1');
      expect(offset?.y).toBe(-80);
      // Item y is shifted: child.position.y + offsetY = 60 + (-80) = -20
      expect(items[0].y).toBe(-20);
      // Height expanded to include wagon above: max(100, -80+50 = -30 → bottom unchanged)
      // minTop = -80, maxBottom = 100, height = 100 - (-80) = 180
      expect(items[0].height).toBe(180);
    });
  });

  describe('child with nested wagons', () => {
    it('recursively expands bounds through wagon chain', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', width: 200, height: 100 });
      // w1 attached to c1, to the right
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 100, height: 80 },
      });
      // w2 attached to w1 (nested wagon), further right
      const w2 = makeWagon('w2', {
        parentId: 'w1',
        attachedToSemanticId: 'c1',
        position: { x: 110, y: 0 },  // relative to w1
        style: { width: 100, height: 80 },
      });

      const { items } = getChildLayoutUnits([org, c1, w1, w2], 'org1');

      const item = items[0];
      // c1: [0,200], w1: [210, 310], w2: [210+110, 210+110+100] = [320, 420]
      // maxRight = max(200, 310, 420) = 420
      expect(item.width).toBe(420);
    });
  });

  describe('mixed: some children with wagons, some without', () => {
    it('only wagon-bearing children get expanded dimensions', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const c2 = makeConstruct('c2', { parentId: 'org1', position: { x: 20, y: 180 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 150, height: 80 },
      });

      const { items, offsets } = getChildLayoutUnits([org, c1, c2, w1], 'org1');

      expect(items).toHaveLength(2);

      const c1Item = items.find(i => i.id === 'c1')!;
      const c2Item = items.find(i => i.id === 'c2')!;

      // c1 has a wagon → expanded
      expect(c1Item.width).toBeGreaterThan(200);
      // c2 has no wagon → base dimensions
      expect(c2Item.width).toBe(200);
      expect(c2Item.height).toBe(100);

      // c2 offset is zero
      expect(offsets.get('c2')).toEqual({ x: 0, y: 0 });
    });
  });

  describe('round-trip: convertToConstructPositions', () => {
    it('recovers original child positions when layout positions are the item positions', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const c2 = makeConstruct('c2', { parentId: 'org1', position: { x: 20, y: 180 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 150, height: 80 },
      });

      const { items, offsets } = getChildLayoutUnits([org, c1, c2, w1], 'org1');

      // Use item positions as "layout result" (no actual layout applied)
      const layoutPositions = new Map(items.map(item => [item.id, { x: item.x, y: item.y }]));
      const constructPositions = convertToConstructPositions(layoutPositions, offsets);

      // c1's construct position should be recovered exactly
      expect(constructPositions.get('c1')).toEqual({ x: c1.position.x, y: c1.position.y });
      // c2's construct position should be recovered exactly
      expect(constructPositions.get('c2')).toEqual({ x: c2.position.x, y: c2.position.y });
    });

    it('recovers positions when wagon has negative offset', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 50, y: 100 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 0, y: -60 },
        style: { width: 100, height: 40 },
      });

      const { items, offsets } = getChildLayoutUnits([org, c1, w1], 'org1');

      const layoutPositions = new Map(items.map(item => [item.id, { x: item.x, y: item.y }]));
      const constructPositions = convertToConstructPositions(layoutPositions, offsets);

      expect(constructPositions.get('c1')).toEqual({ x: 50, y: 100 });
    });
  });
});

describe('getChildVisualFootprints', () => {
  describe('empty organizer', () => {
    it('returns empty array', () => {
      const org = makeOrganizer('org1');
      const footprints = getChildVisualFootprints([org], 'org1');
      expect(footprints).toHaveLength(0);
    });
  });

  describe('children without wagons', () => {
    it('footprint count equals direct children count', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const c2 = makeConstruct('c2', { parentId: 'org1', position: { x: 20, y: 180 }, width: 200, height: 100 });

      const footprints = getChildVisualFootprints([org, c1, c2], 'org1');

      expect(footprints).toHaveLength(2);
    });

    it('footprints exactly match child position and dimensions', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });

      const footprints = getChildVisualFootprints([org, c1], 'org1');

      expect(footprints[0].position).toEqual({ x: 20, y: 60 });
      expect(footprints[0].width).toBe(200);
      expect(footprints[0].height).toBe(100);
    });

    it('footprint bounding box equals child rect when no wagon', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 50, y: 80 }, width: 150, height: 80 });

      const footprints = getChildVisualFootprints([org, c1], 'org1');
      const fp = footprints[0];

      // Footprint should match the child exactly
      expect(fp.position.x).toBe(50);
      expect(fp.position.y).toBe(80);
      expect(fp.width).toBe(150);
      expect(fp.height).toBe(80);
    });
  });

  describe('child with a wagon to the right', () => {
    it('footprint width is expanded beyond construct alone', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 150, height: 80 },
      });

      const footprints = getChildVisualFootprints([org, c1, w1], 'org1');

      expect(footprints).toHaveLength(1);
      const fp = footprints[0];
      // Footprint width must be >= construct width
      expect(fp.width).toBeGreaterThan(200);
      // Expanded: 210 + 150 = 360
      expect(fp.width).toBe(360);
      // Position unchanged (wagon is to the right, no negative offset)
      expect(fp.position).toEqual({ x: 20, y: 60 });
    });

    it('footprint bounding box encloses the child original rect', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 150, height: 80 },
      });

      const footprints = getChildVisualFootprints([org, c1, w1], 'org1');
      const fp = footprints[0];

      // Footprint must contain original construct rect
      expect(fp.position.x).toBeLessThanOrEqual(20);
      expect(fp.position.y).toBeLessThanOrEqual(60);
      expect(fp.position.x + fp.width).toBeGreaterThanOrEqual(20 + 200);
      expect(fp.position.y + fp.height).toBeGreaterThanOrEqual(60 + 100);
    });
  });

  describe('child with a wagon above (negative y)', () => {
    it('footprint position y shifts up when wagon is above construct', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 100 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 0, y: -80 },
        style: { width: 150, height: 50 },
      });

      const footprints = getChildVisualFootprints([org, c1, w1], 'org1');

      const fp = footprints[0];
      // offsetY = -80, so fp.position.y = 100 + (-80) = 20
      expect(fp.position.y).toBe(20);
      // height = 100 - (-80) = 180
      expect(fp.height).toBe(180);
    });

    it('footprint bounding box encloses both construct and wagon above', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 100 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 0, y: -80 },
        style: { width: 150, height: 50 },
      });

      const footprints = getChildVisualFootprints([org, c1, w1], 'org1');
      const fp = footprints[0];

      // Footprint must contain original construct rect
      expect(fp.position.x).toBeLessThanOrEqual(20);
      expect(fp.position.y).toBeLessThanOrEqual(100);
      expect(fp.position.x + fp.width).toBeGreaterThanOrEqual(20 + 200);
      expect(fp.position.y + fp.height).toBeGreaterThanOrEqual(100 + 100);

      // Footprint must also contain wagon rect (absolute: x=20, y=100+(-80)=20, w=150, h=50)
      expect(fp.position.x).toBeLessThanOrEqual(20);
      expect(fp.position.y).toBeLessThanOrEqual(20);
      expect(fp.position.x + fp.width).toBeGreaterThanOrEqual(20 + 150);
      expect(fp.position.y + fp.height).toBeGreaterThanOrEqual(20 + 50);
    });
  });

  describe('invariant: footprint bounding box can only grow, never shrink', () => {
    it('footprint area is always >= construct area', () => {
      const org = makeOrganizer('org1');
      const c1 = makeConstruct('c1', { parentId: 'org1', position: { x: 20, y: 60 }, width: 200, height: 100 });
      const w1 = makeWagon('w1', {
        parentId: 'c1',
        attachedToSemanticId: 'c1',
        position: { x: 210, y: 0 },
        style: { width: 150, height: 80 },
      });

      const footprints = getChildVisualFootprints([org, c1, w1], 'org1');
      const fp = footprints[0];

      expect(fp.width * fp.height).toBeGreaterThanOrEqual(200 * 100);
    });
  });
});
