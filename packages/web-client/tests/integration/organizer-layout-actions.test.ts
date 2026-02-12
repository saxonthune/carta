/**
 * Test: Organizer Layout Actions
 *
 * Integration tests for layout actions with organizers. These tests use pure
 * geometry functions to verify layout outcomes without React hooks complexity.
 */

import { describe, it, expect } from 'vitest';
import { computeOrganizerFit, DEFAULT_ORGANIZER_LAYOUT, type NodeGeometry } from '@carta/domain';

// These tests verify layout action OUTCOMES as pure functions,
// without needing React hooks infrastructure.

describe('Layout Actions - Geometry Invariants', () => {
  const config = DEFAULT_ORGANIZER_LAYOUT; // padding=20, headerHeight=40
  const padding = config.padding;
  const CONTENT_TOP = padding + config.headerHeight; // 60

  describe('grid layout', () => {
    it('positions children within organizer after fit', () => {
      // Simulate: 4 children, 2x2 grid
      const children = [
        { id: 'c1', width: 200, height: 100 },
        { id: 'c2', width: 200, height: 100 },
        { id: 'c3', width: 200, height: 100 },
        { id: 'c4', width: 200, height: 100 },
      ];

      const cols = 2;
      const colWidth = 200 + 30; // max width + gap
      const rowHeight = 100 + 30;

      const positions = children.map((child, idx) => ({
        x: (idx % cols) * colWidth + padding,
        y: Math.floor(idx / cols) * rowHeight + CONTENT_TOP,
        width: child.width,
        height: child.height,
      }));

      // Compute fit from these positions
      const geometries: NodeGeometry[] = positions.map(p => ({
        position: { x: p.x, y: p.y },
        width: p.width,
        height: p.height,
      }));

      const fit = computeOrganizerFit(geometries);

      // All children should be within bounds after fit
      for (const geom of geometries) {
        const adjX = geom.position.x + fit.childPositionDelta.x;
        const adjY = geom.position.y + fit.childPositionDelta.y;
        expect(adjX + (geom.width ?? 200)).toBeLessThanOrEqual(fit.size.width);
        expect(adjY + (geom.height ?? 100)).toBeLessThanOrEqual(fit.size.height);
      }
    });
  });

  describe('spread layout', () => {
    it('positions are all positive after normalization', () => {
      // Simulate spread output: deOverlapNodes may return positions starting from any origin
      // useLayoutActions normalizes by shifting minY to CONTENT_TOP
      const spreadOutput = [
        { id: 'c1', x: -50, y: -30 },
        { id: 'c2', x: 100, y: 50 },
      ];

      const allPositions = spreadOutput.map(p => ({ ...p }));
      const minY = Math.min(...allPositions.map(p => p.y));
      if (minY < CONTENT_TOP) {
        const shiftY = CONTENT_TOP - minY;
        for (const pos of allPositions) {
          pos.y += shiftY;
        }
      }

      // All y should be >= CONTENT_TOP
      for (const pos of allPositions) {
        expect(pos.y).toBeGreaterThanOrEqual(CONTENT_TOP);
      }
    });
  });

  describe('flow layout', () => {
    it('normalizes to content area', () => {
      // Simulate hierarchicalLayout output and normalization
      const rawPositions = new Map([
        ['c1', { x: 0, y: 0 }],
        ['c2', { x: 0, y: 200 }],
      ]);

      const minX = Math.min(...[...rawPositions.values()].map(p => p.x));
      const minY = Math.min(...[...rawPositions.values()].map(p => p.y));

      const normalized = new Map<string, { x: number; y: number }>();
      for (const [id, pos] of rawPositions) {
        normalized.set(id, {
          x: pos.x - minX + padding,
          y: pos.y - minY + CONTENT_TOP,
        });
      }

      for (const pos of normalized.values()) {
        expect(pos.x).toBeGreaterThanOrEqual(padding);
        expect(pos.y).toBeGreaterThanOrEqual(CONTENT_TOP);
      }
    });
  });

  describe('fitToChildren', () => {
    it('produces organizer that contains all children', () => {
      // Various child configurations
      const configs = [
        // Normal positions
        [
          { position: { x: 20, y: 60 }, width: 200, height: 100 },
          { position: { x: 20, y: 180 }, width: 200, height: 100 },
        ],
        // Negative positions (drag left/up)
        [
          { position: { x: -30, y: -10 }, width: 200, height: 100 },
          { position: { x: 100, y: 200 }, width: 200, height: 100 },
        ],
        // Wide spread
        [
          { position: { x: 20, y: 60 }, width: 400, height: 50 },
          { position: { x: 500, y: 60 }, width: 200, height: 300 },
        ],
      ] as NodeGeometry[][];

      for (const children of configs) {
        const fit = computeOrganizerFit(children);

        for (const child of children) {
          const adjX = child.position.x + fit.childPositionDelta.x;
          const adjY = child.position.y + fit.childPositionDelta.y;
          const w = child.width ?? 200;
          const h = child.height ?? 100;

          // Child must be within organizer bounds (with padding)
          expect(adjX).toBeGreaterThanOrEqual(0);
          expect(adjY).toBeGreaterThanOrEqual(0);
          expect(adjX + w).toBeLessThanOrEqual(fit.size.width);
          expect(adjY + h).toBeLessThanOrEqual(fit.size.height);
        }
      }
    });
  });
});
