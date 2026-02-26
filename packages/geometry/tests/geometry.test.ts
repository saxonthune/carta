import { describe, it, expect } from 'vitest';
import {
  toAbsolutePosition,
  toRelativePosition,
  computeOrganizerFit,
  computeOrganizerBounds,
  computeBounds,
  DEFAULT_ORGANIZER_LAYOUT,
  type NodeGeometry,
} from '../src/index.js';

// ===== HELPERS =====

function makeGeometry(x: number, y: number, w = 200, h = 100): NodeGeometry {
  return { position: { x, y }, width: w, height: h };
}

function assertContainment(
  containerSize: { width: number; height: number },
  children: NodeGeometry[],
  childDelta: { x: number; y: number }
): void {
  for (const child of children) {
    const adjX = child.position.x + childDelta.x;
    const adjY = child.position.y + childDelta.y;
    const w = child.width ?? 200;
    const h = child.height ?? 100;

    expect(adjX).toBeGreaterThanOrEqual(0);
    expect(adjY).toBeGreaterThanOrEqual(0);
    expect(adjX + w).toBeLessThanOrEqual(containerSize.width);
    expect(adjY + h).toBeLessThanOrEqual(containerSize.height);
  }
}

// ===== TESTS =====

describe('Position round-trip', () => {
  const cases = [
    { pos: { x: 150, y: 200 }, parent: { x: 100, y: 100 } },
    { pos: { x: -50, y: -100 }, parent: { x: 200, y: 300 } },
    { pos: { x: 0, y: 0 }, parent: { x: 0, y: 0 } },
    { pos: { x: 1000, y: 1000 }, parent: { x: 500, y: 500 } },
  ];

  for (const { pos, parent } of cases) {
    it(`toAbsolute(toRelative(${JSON.stringify(pos)}, ${JSON.stringify(parent)})) === original`, () => {
      const relative = toRelativePosition(pos, parent);
      const absolute = toAbsolutePosition(relative, parent);
      expect(absolute.x).toBe(pos.x);
      expect(absolute.y).toBe(pos.y);
    });
  }
});

describe('computeOrganizerFit containment', () => {
  const config = DEFAULT_ORGANIZER_LAYOUT;

  it('after fit, all children within bounds + padding', () => {
    const children = [
      makeGeometry(-30, -10, 200, 100),
      makeGeometry(100, 200, 200, 100),
    ];
    const fit = computeOrganizerFit(children, config);
    assertContainment(fit.size, children, fit.childPositionDelta);
  });

  it('works with single child at negative position', () => {
    const children = [makeGeometry(-100, -50, 200, 100)];
    const fit = computeOrganizerFit(children, config);
    assertContainment(fit.size, children, fit.childPositionDelta);
  });

  it('works with many children', () => {
    const children = Array.from({ length: 20 }, (_, i) =>
      makeGeometry(i * 50 - 200, i * 30 - 100, 150, 80)
    );
    const fit = computeOrganizerFit(children, config);
    assertContainment(fit.size, children, fit.childPositionDelta);
  });
});

describe('computeOrganizerFit tightness', () => {
  const config = DEFAULT_ORGANIZER_LAYOUT;

  it('fit produces no excess space beyond padding', () => {
    const children = [
      makeGeometry(20, 60, 200, 100),
      makeGeometry(20, 180, 200, 100),
    ];
    const fit = computeOrganizerFit(children, config);

    // After adjustment, rightmost child edge + padding should equal width
    const adjustedChildren = children.map(c => ({
      x: c.position.x + fit.childPositionDelta.x,
      y: c.position.y + fit.childPositionDelta.y,
      w: c.width ?? 200,
      h: c.height ?? 100,
    }));

    const maxRight = Math.max(...adjustedChildren.map(c => c.x + c.w));
    const maxBottom = Math.max(...adjustedChildren.map(c => c.y + c.h));

    expect(fit.size.width).toBe(maxRight + config.padding);
    expect(fit.size.height).toBe(maxBottom + config.padding);
  });
});

describe('computeOrganizerFit deltas are inverse', () => {
  it('positionDelta + childPositionDelta = zero', () => {
    const children = [
      makeGeometry(-50, -20, 200, 100),
      makeGeometry(50, 80, 200, 100),
    ];
    const fit = computeOrganizerFit(children, DEFAULT_ORGANIZER_LAYOUT);
    expect(fit.positionDelta.x + fit.childPositionDelta.x).toBe(0);
    expect(fit.positionDelta.y + fit.childPositionDelta.y).toBe(0);
  });
});

describe('computeBounds', () => {
  it('encloses all input rects with padding', () => {
    const children = [
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 200, y: 150, width: 80, height: 60 },
    ];
    const bounds = computeBounds(children, { padding: 10 });

    for (const child of children) {
      expect(child.x).toBeGreaterThanOrEqual(bounds.x + 10);
      expect(child.y).toBeGreaterThanOrEqual(bounds.y + 10);
      expect(child.x + child.width).toBeLessThanOrEqual(bounds.x + bounds.width - 10);
      expect(child.y + child.height).toBeLessThanOrEqual(bounds.y + bounds.height - 10);
    }
  });

  it('respects minimum dimensions', () => {
    const bounds = computeBounds([], { minWidth: 200, minHeight: 150 });
    expect(bounds.width).toBeGreaterThanOrEqual(200);
    expect(bounds.height).toBeGreaterThanOrEqual(150);
  });
});
