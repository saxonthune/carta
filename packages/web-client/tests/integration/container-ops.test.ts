import { describe, it, expect } from 'vitest';
import {
  resolveAbsolutePosition,
  computeAttach,
  computeDetach,
  computeContainerFit,
} from '../../src/canvas-engine/containerOps';
import type { ContainerNode } from '../../src/canvas-engine/containerOps';
import { DEFAULT_ORGANIZER_LAYOUT, type NodeGeometry } from '@carta/geometry';

// ===== HELPERS =====

function makeNode(id: string, x: number, y: number, parentId?: string): ContainerNode {
  return { id, position: { x, y }, parentId };
}

// ===== TESTS =====

describe('resolveAbsolutePosition', () => {
  it('returns position directly for root node', () => {
    const nodes = [makeNode('a', 100, 200)];
    expect(resolveAbsolutePosition('a', nodes)).toEqual({ x: 100, y: 200 });
  });

  it('walks parent chain for nested node', () => {
    const nodes = [
      makeNode('parent', 100, 100),
      makeNode('child', 50, 50, 'parent'),
    ];
    expect(resolveAbsolutePosition('child', nodes)).toEqual({ x: 150, y: 150 });
  });

  it('handles deeply nested nodes', () => {
    const nodes = [
      makeNode('grandparent', 10, 20),
      makeNode('parent', 30, 40, 'grandparent'),
      makeNode('child', 50, 60, 'parent'),
    ];
    // 10+30+50 = 90, 20+40+60 = 120
    expect(resolveAbsolutePosition('child', nodes)).toEqual({ x: 90, y: 120 });
  });
});

describe('computeAttach preserves absolute position', () => {
  it('relative position preserves canvas position for root node', () => {
    const nodes = [
      makeNode('container', 100, 100),
      makeNode('node', 250, 300),
    ];

    const beforeAbs = resolveAbsolutePosition('node', nodes);
    const relativePos = computeAttach('node', 'container', nodes);

    // After attach: node.position = relativePos, node.parentId = container
    const afterNodes = nodes.map(n =>
      n.id === 'node' ? { ...n, parentId: 'container', position: relativePos } : n
    );
    const afterAbs = resolveAbsolutePosition('node', afterNodes);

    expect(afterAbs.x).toBeCloseTo(beforeAbs.x, 5);
    expect(afterAbs.y).toBeCloseTo(beforeAbs.y, 5);
  });

  it('relative position preserves canvas position for nested node', () => {
    const nodes = [
      makeNode('old-parent', 50, 50),
      makeNode('new-parent', 200, 200),
      makeNode('node', 30, 30, 'old-parent'), // abs: 80, 80
    ];

    const beforeAbs = resolveAbsolutePosition('node', nodes);
    const relativePos = computeAttach('node', 'new-parent', nodes);

    const afterNodes = nodes.map(n =>
      n.id === 'node' ? { ...n, parentId: 'new-parent', position: relativePos } : n
    );
    const afterAbs = resolveAbsolutePosition('node', afterNodes);

    expect(afterAbs.x).toBeCloseTo(beforeAbs.x, 5);
    expect(afterAbs.y).toBeCloseTo(beforeAbs.y, 5);
  });
});

describe('computeDetach preserves absolute position', () => {
  it('absolute position equals resolved position', () => {
    const nodes = [
      makeNode('container', 100, 100),
      makeNode('node', 50, 50, 'container'), // abs: 150, 150
    ];

    const absolutePos = computeDetach('node', nodes);

    expect(absolutePos).toEqual({ x: 150, y: 150 });
  });
});

describe('attach→detach round-trip', () => {
  it('original position restored exactly', () => {
    const originalPos = { x: 250, y: 300 };
    const nodes = [
      makeNode('container', 100, 100),
      makeNode('node', originalPos.x, originalPos.y),
    ];

    // Attach
    const relativePos = computeAttach('node', 'container', nodes);
    const attachedNodes = nodes.map(n =>
      n.id === 'node' ? { ...n, parentId: 'container', position: relativePos } : n
    );

    // Detach
    const absolutePos = computeDetach('node', attachedNodes);

    expect(absolutePos.x).toBe(originalPos.x);
    expect(absolutePos.y).toBe(originalPos.y);
  });
});

describe('computeContainerFit', () => {
  it('container encloses all children after fit', () => {
    const children: NodeGeometry[] = [
      { position: { x: -20, y: -10 }, width: 200, height: 100 },
      { position: { x: 100, y: 150 }, width: 200, height: 100 },
    ];

    const fit = computeContainerFit(children);

    // After applying childPositionDelta, all children should be within bounds
    for (const child of children) {
      const adjX = child.position.x + fit.childPositionDelta.x;
      const adjY = child.position.y + fit.childPositionDelta.y;
      const w = child.width ?? 200;
      const h = child.height ?? 100;

      expect(adjX + w).toBeLessThanOrEqual(fit.size.width);
      expect(adjY + h).toBeLessThanOrEqual(fit.size.height);
    }
  });

  it('container shrinks to remaining members after detach', () => {
    const allChildren: NodeGeometry[] = [
      { position: { x: 20, y: 60 }, width: 200, height: 100 },
      { position: { x: 20, y: 180 }, width: 200, height: 100 },
      { position: { x: 20, y: 300 }, width: 200, height: 100 },
    ];

    const fitBefore = computeContainerFit(allChildren);

    // Remove last child
    const remaining = allChildren.slice(0, 2);
    const fitAfter = computeContainerFit(remaining);

    expect(fitAfter.size.height).toBeLessThan(fitBefore.size.height);
  });
});
