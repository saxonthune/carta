/**
 * Test: Canvas Engine Geometry Pure Functions
 *
 * Unit tests for pure geometry functions used in canvas engine operations.
 * These functions are in LayoutMap.tsx and have no React/DOM dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  getHandlePosition,
  VALID_SOURCE_HANDLES,
  type LocalNode,
} from '../../src/components/canvas/LayoutMap';

describe('getHandlePosition', () => {
  const node: LocalNode = {
    id: 'test',
    position: { x: 100, y: 200 },
    data: { name: 'Test', color: '#000' },
    style: { width: 400, height: 300 },
  };

  it('N returns top center', () => {
    expect(getHandlePosition(node, 'N')).toEqual({ x: 300, y: 200 });
  });

  it('NE returns top right', () => {
    expect(getHandlePosition(node, 'NE')).toEqual({ x: 500, y: 200 });
  });

  it('E returns center right', () => {
    expect(getHandlePosition(node, 'E')).toEqual({ x: 500, y: 350 });
  });

  it('SE returns bottom right', () => {
    expect(getHandlePosition(node, 'SE')).toEqual({ x: 500, y: 500 });
  });

  it('S returns bottom center', () => {
    expect(getHandlePosition(node, 'S')).toEqual({ x: 300, y: 500 });
  });

  it('SW returns bottom left', () => {
    expect(getHandlePosition(node, 'SW')).toEqual({ x: 100, y: 500 });
  });

  it('W returns center left', () => {
    expect(getHandlePosition(node, 'W')).toEqual({ x: 100, y: 350 });
  });

  it('NW returns top left', () => {
    expect(getHandlePosition(node, 'NW')).toEqual({ x: 100, y: 200 });
  });

  it('body/unknown returns center', () => {
    expect(getHandlePosition(node, 'body')).toEqual({ x: 300, y: 350 });
    expect(getHandlePosition(node, null)).toEqual({ x: 300, y: 350 });
    expect(getHandlePosition(node, undefined)).toEqual({ x: 300, y: 350 });
  });

  it('uses default dimensions when style is missing', () => {
    const minimal: LocalNode = {
      id: 'min',
      position: { x: 0, y: 0 },
      data: { name: 'Min', color: '' },
    };
    // Default width=400, height=300
    expect(getHandlePosition(minimal, 'E')).toEqual({ x: 400, y: 150 });
    expect(getHandlePosition(minimal, 'S')).toEqual({ x: 200, y: 300 });
  });
});

describe('VALID_SOURCE_HANDLES', () => {
  it('contains all 8 compass directions', () => {
    expect(VALID_SOURCE_HANDLES.size).toBe(8);
    for (const dir of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) {
      expect(VALID_SOURCE_HANDLES.has(dir)).toBe(true);
    }
  });

  it('does not contain body', () => {
    expect(VALID_SOURCE_HANDLES.has('body')).toBe(false);
  });
});
