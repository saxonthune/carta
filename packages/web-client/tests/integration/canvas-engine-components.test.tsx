/**
 * Test: Canvas Engine Component Rendering
 *
 * Component tests for canvas engine components. These test DOM structure
 * and basic interactions without needing d3-zoom or real browser dimensions.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectionHandle } from '../../src/canvas-engine/ConnectionHandle';

describe('ConnectionHandle', () => {
  it('renders target handle with data attributes', () => {
    const { container } = render(
      <ConnectionHandle type="target" id="body" nodeId="node-1" />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-connection-target')).toBe('true');
    expect(el.getAttribute('data-node-id')).toBe('node-1');
    expect(el.getAttribute('data-handle-id')).toBe('body');
  });

  it('renders source handle without target data attributes', () => {
    const { container } = render(
      <ConnectionHandle type="source" id="E" nodeId="node-1" />
    );
    const el = container.firstElementChild as HTMLElement;
    // Should NOT have target attributes
    expect(el.getAttribute('data-connection-target')).toBeNull();
    expect(el.getAttribute('data-node-id')).toBeNull();
    expect(el.getAttribute('data-handle-id')).toBeNull();
  });

  it('fires onStartConnection on pointerdown for source type', () => {
    const onStart = vi.fn();
    const { container } = render(
      <ConnectionHandle type="source" id="E" nodeId="node-1" onStartConnection={onStart} />
    );
    const el = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(el);
    expect(onStart).toHaveBeenCalledWith('node-1', 'E', expect.any(Number), expect.any(Number));
  });

  it('does NOT fire onStartConnection for target type', () => {
    const onStart = vi.fn();
    const { container } = render(
      <ConnectionHandle type="target" id="body" nodeId="node-1" onStartConnection={onStart} />
    );
    const el = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(el);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('renders children', () => {
    render(
      <ConnectionHandle type="source" id="E" nodeId="node-1">
        <span data-testid="child">Arrow</span>
      </ConnectionHandle>
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ConnectionHandle type="source" id="E" nodeId="node-1" className="custom-class" />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toBe('custom-class');
  });

  it('applies custom style', () => {
    const customStyle = { backgroundColor: 'red', width: '20px' };
    const { container } = render(
      <ConnectionHandle type="source" id="E" nodeId="node-1" style={customStyle} />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBe('red');
    expect(el.style.width).toBe('20px');
  });
});
