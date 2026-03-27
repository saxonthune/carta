/**
 * Test: FileContainer Component
 *
 * Presentational wrapper for product design structure editors on the canvas.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileContainer } from '../../src/product-design/FileContainer';

describe('FileContainer', () => {
  it('renders filename in the tab', () => {
    render(<FileContainer filename="test.md"><div /></FileContainer>);
    expect(screen.getByText('test.md')).toBeDefined();
  });

  it('renders children', () => {
    render(
      <FileContainer filename="test.md">
        <div data-testid="child">Content</div>
      </FileContainer>
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('renders multiple children stacked', () => {
    render(
      <FileContainer filename="test.md">
        <div data-testid="child-1">First</div>
        <div data-testid="child-2">Second</div>
      </FileContainer>
    );
    expect(screen.getByTestId('child-1')).toBeDefined();
    expect(screen.getByTestId('child-2')).toBeDefined();
  });

  it('applies selected ring class when selected is true', () => {
    const { container } = render(
      <FileContainer filename="test.md" selected={true}>
        <div />
      </FileContainer>
    );
    const body = container.querySelector('.ring-2') as HTMLElement;
    expect(body).not.toBeNull();
    expect(body.className).toContain('ring-accent/30');
  });

  it('does not apply accent ring class when not selected', () => {
    const { container } = render(
      <FileContainer filename="test.md" selected={false}>
        <div />
      </FileContainer>
    );
    const body = container.querySelector('.ring-2');
    expect(body).toBeNull();
  });

  it('does not apply accent ring class when selected is omitted', () => {
    const { container } = render(
      <FileContainer filename="test.md">
        <div />
      </FileContainer>
    );
    const body = container.querySelector('.ring-2');
    expect(body).toBeNull();
  });

  it('outer element has data-no-pan="true"', () => {
    const { container } = render(
      <FileContainer filename="test.md"><div /></FileContainer>
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.getAttribute('data-no-pan')).toBe('true');
  });

  it('forwards onPointerDown to outer element', () => {
    const onPointerDown = vi.fn();
    const { container } = render(
      <FileContainer filename="test.md" onPointerDown={onPointerDown}>
        <div />
      </FileContainer>
    );
    const outer = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(outer);
    expect(onPointerDown).toHaveBeenCalled();
  });

  it('forwards onContextMenu to outer element', () => {
    const onContextMenu = vi.fn();
    const { container } = render(
      <FileContainer filename="test.md" onContextMenu={onContextMenu}>
        <div />
      </FileContainer>
    );
    const outer = container.firstElementChild as HTMLElement;
    fireEvent.contextMenu(outer);
    expect(onContextMenu).toHaveBeenCalled();
  });

  it('applies custom className to outer element', () => {
    const { container } = render(
      <FileContainer filename="test.md" className="custom">
        <div />
      </FileContainer>
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain('custom');
  });
});
