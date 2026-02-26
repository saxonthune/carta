import { describe, it, expect } from 'vitest';
import { computeFlowLayout, type FlowLayoutInput, type FlowLayoutEdge, type FlowLayoutOptions } from '@carta/geometry';

// Test helpers
function node(id: string, x = 0, y = 0): FlowLayoutInput {
  return { id, semanticId: `test-${id}`, x, y, width: 200, height: 100 };
}

function edge(sourceId: string, targetId: string): FlowLayoutEdge {
  return { sourceId, targetId, sourcePortId: 'flow-out', targetPortId: 'flow-in' };
}

const defaultOptions: FlowLayoutOptions = { direction: 'TB' };

describe('computeFlowLayout', () => {
  describe('basic layout', () => {
    it('should return empty result for empty input', () => {
      const result = computeFlowLayout([], [], defaultOptions);
      expect(result.positions.size).toBe(0);
      expect(result.layers.size).toBe(0);
      expect(result.layerOrder.size).toBe(0);
    });

    it('should handle single node', () => {
      const nodes = [node('A')];
      const result = computeFlowLayout(nodes, [], defaultOptions);
      expect(result.positions.size).toBe(1);
      expect(result.positions.has('A')).toBe(true);
      expect(result.layers.get('A')).toBe(0);
    });

    it('should layout linear chain in layers', () => {
      const nodes = [node('A'), node('B'), node('C')];
      const edges = [edge('A', 'B'), edge('B', 'C')];
      const result = computeFlowLayout(nodes, edges, defaultOptions);

      const posA = result.positions.get('A')!;
      const posB = result.positions.get('B')!;
      const posC = result.positions.get('C')!;

      // In TB direction, y increases with each layer
      expect(posA.y).toBeLessThan(posB.y);
      expect(posB.y).toBeLessThan(posC.y);

      // Check layers are assigned correctly
      expect(result.layers.get('A')).toBe(0);
      expect(result.layers.get('B')).toBe(1);
      expect(result.layers.get('C')).toBe(2);
    });

    it('should place converging sources in same layer', () => {
      const nodes = [node('A'), node('B'), node('C')];
      const edges = [edge('A', 'C'), edge('B', 'C')];
      const result = computeFlowLayout(nodes, edges, defaultOptions);

      // A and B should be in layer 0, C in layer 1
      expect(result.layers.get('A')).toBe(0);
      expect(result.layers.get('B')).toBe(0);
      expect(result.layers.get('C')).toBe(1);

      // A and B should have same y coordinate (TB direction)
      const posA = result.positions.get('A')!;
      const posB = result.positions.get('B')!;
      const posC = result.positions.get('C')!;
      expect(posA.y).toBe(posB.y);
      expect(posC.y).toBeGreaterThan(posA.y);
    });
  });

  describe('cycle handling', () => {
    it('should handle cycles without hanging', () => {
      const nodes = [node('A'), node('B'), node('C')];
      const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')];
      const result = computeFlowLayout(nodes, edges, defaultOptions);

      // Should return positions for all nodes despite cycle
      expect(result.positions.size).toBe(3);
      expect(result.positions.has('A')).toBe(true);
      expect(result.positions.has('B')).toBe(true);
      expect(result.positions.has('C')).toBe(true);
    });

    it('should handle self-loops', () => {
      const nodes = [node('A')];
      const edges = [edge('A', 'A')];
      const result = computeFlowLayout(nodes, edges, defaultOptions);

      // Should return position for node with self-loop
      expect(result.positions.size).toBe(1);
      expect(result.positions.has('A')).toBe(true);
    });
  });

  describe('centroid preservation', () => {
    it('should preserve centroid of input positions', () => {
      // Create nodes centered at (500, 500)
      const nodes = [
        node('A', 400, 400),
        node('B', 600, 400),
        node('C', 400, 600),
        node('D', 600, 600),
      ];
      const edges = [edge('A', 'B'), edge('C', 'D')];
      const result = computeFlowLayout(nodes, edges, defaultOptions);

      // Compute centroid of result
      let sumX = 0;
      let sumY = 0;
      for (const pos of result.positions.values()) {
        sumX += pos.x;
        sumY += pos.y;
      }
      const centroidX = sumX / result.positions.size;
      const centroidY = sumY / result.positions.size;

      // Original centroid is (500, 500)
      // Result centroid should be close to original (within ±50px tolerance)
      expect(Math.abs(centroidX - 500)).toBeLessThan(50);
      expect(Math.abs(centroidY - 500)).toBeLessThan(50);
    });
  });

  describe('direction', () => {
    it('should layout LR with x-axis layers', () => {
      const nodes = [node('A'), node('B')];
      const edges = [edge('A', 'B')];
      const result = computeFlowLayout(nodes, edges, { direction: 'LR' });

      const posA = result.positions.get('A')!;
      const posB = result.positions.get('B')!;

      // In LR direction, x increases with each layer
      expect(posA.x).toBeLessThan(posB.x);
    });
  });
});
