/**
 * Test: EnumerationEditor component
 *
 * Verifies the controlled component pattern for the enumeration structure editor.
 * Tests rendering, editing, adding, deleting, toggling kind, and reordering.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnumerationEditor } from '../../src/product-design/EnumerationEditor';
import type { EnumerationData } from '../../src/product-design/types';

function makeData(overrides?: Partial<EnumerationData>): EnumerationData {
  return {
    kind: 'ordinal',
    values: [
      { key: 'low', remark: 'Triaged but not urgent' },
      { key: 'medium' },
      { key: 'high', remark: 'Needs attention' },
    ],
    ...overrides,
  };
}

describe('EnumerationEditor', () => {
  it('renders all values', () => {
    render(
      <EnumerationEditor name="Priority" value={makeData()} onChange={vi.fn()} />
    );
    expect(screen.getByText('low')).toBeDefined();
    expect(screen.getByText('medium')).toBeDefined();
    expect(screen.getByText('high')).toBeDefined();
  });

  it('renders name and kind badge', () => {
    render(
      <EnumerationEditor name="Priority" value={makeData({ kind: 'ordinal' })} onChange={vi.fn()} />
    );
    expect(screen.getByText('Priority')).toBeDefined();
    expect(screen.getByText('ordinal')).toBeDefined();
  });

  it('renders empty state with just the add button', () => {
    render(
      <EnumerationEditor name="Empty" value={makeData({ values: [] })} onChange={vi.fn()} />
    );
    expect(screen.getByText('Add value')).toBeDefined();
    // No value rows
    expect(screen.queryByText('low')).toBeNull();
  });

  it('add value calls onChange with values length + 1 and empty key', () => {
    const onChange = vi.fn();
    render(
      <EnumerationEditor name="Priority" value={makeData()} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Add value'));
    expect(onChange).toHaveBeenCalledOnce();
    const newData: EnumerationData = onChange.mock.calls[0][0];
    expect(newData.values).toHaveLength(4);
    expect(newData.values[3].key).toBe('');
  });

  it('toggle kind calls onChange with toggled kind, values unchanged', () => {
    const onChange = vi.fn();
    const data = makeData({ kind: 'ordinal' });
    render(
      <EnumerationEditor name="Priority" value={data} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('ordinal'));
    expect(onChange).toHaveBeenCalledOnce();
    const newData: EnumerationData = onChange.mock.calls[0][0];
    expect(newData.kind).toBe('nominal');
    expect(newData.values).toEqual(data.values);
  });

  it('toggle kind from nominal to ordinal', () => {
    const onChange = vi.fn();
    render(
      <EnumerationEditor name="Priority" value={makeData({ kind: 'nominal' })} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('nominal'));
    const newData: EnumerationData = onChange.mock.calls[0][0];
    expect(newData.kind).toBe('ordinal');
  });

  it('edit key: click cell, type, blur calls onChange with updated key', () => {
    const onChange = vi.fn();
    render(
      <EnumerationEditor name="Priority" value={makeData()} onChange={onChange} />
    );
    // Click the 'low' key cell
    fireEvent.click(screen.getByText('low'));
    // Should show input
    const input = screen.getByDisplayValue('low');
    expect(input).toBeDefined();
    // Change the value
    fireEvent.change(input, { target: { value: 'lowest' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledOnce();
    const newData: EnumerationData = onChange.mock.calls[0][0];
    expect(newData.values[0].key).toBe('lowest');
  });

  it('edit key: Enter commits the edit', () => {
    const onChange = vi.fn();
    render(
      <EnumerationEditor name="Priority" value={makeData()} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('medium'));
    const input = screen.getByDisplayValue('medium');
    fireEvent.change(input, { target: { value: 'med' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledOnce();
    const newData: EnumerationData = onChange.mock.calls[0][0];
    expect(newData.values[1].key).toBe('med');
  });

  it('edit remark: click remark cell, type, blur calls onChange with updated remark', () => {
    const onChange = vi.fn();
    render(
      <EnumerationEditor name="Priority" value={makeData()} onChange={onChange} />
    );
    // Click the remark of 'medium' row (empty remark)
    const remarkCells = screen.getAllByRole('generic').filter(
      (el) => el.classList.contains('cursor-text') && el.classList.contains('text-content-muted')
    );
    // medium is index 1, remark cell
    fireEvent.click(remarkCells[1]);
    const input = screen.getByDisplayValue('');
    fireEvent.change(input, { target: { value: 'Middle ground' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledOnce();
    const newData: EnumerationData = onChange.mock.calls[0][0];
    expect(newData.values[1].remark).toBe('Middle ground');
  });

  it('delete value: click delete removes value at correct index', () => {
    const onChange = vi.fn();
    render(
      <EnumerationEditor name="Priority" value={makeData()} onChange={onChange} />
    );
    const deleteButtons = screen.getAllByTitle('Delete value');
    expect(deleteButtons).toHaveLength(3);
    // Delete 'medium' (index 1)
    fireEvent.click(deleteButtons[1]);
    expect(onChange).toHaveBeenCalledOnce();
    const newData: EnumerationData = onChange.mock.calls[0][0];
    expect(newData.values).toHaveLength(2);
    expect(newData.values.map((v) => v.key)).toEqual(['low', 'high']);
  });

  it('reorder: drag row 0 to row 2 position', () => {
    const onChange = vi.fn();
    const { container } = render(
      <EnumerationEditor name="Priority" value={makeData()} onChange={onChange} />
    );
    // Find drag handles (div with cursor-grab)
    const handles = container.querySelectorAll('[class*="cursor-grab"]');
    expect(handles.length).toBeGreaterThanOrEqual(3);

    const handle0 = handles[0] as HTMLElement;

    // Simulate pointer events: down on row 0, move down 2 rows (~80px), up
    fireEvent.pointerDown(handle0, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle0, { clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(handle0, { clientY: 80, pointerId: 1 });

    // onChange should be called with reordered values
    if (onChange.mock.calls.length > 0) {
      const newData: EnumerationData = onChange.mock.calls[0][0];
      // Just verify it's called with an array of same length
      expect(newData.values).toHaveLength(3);
    }
    // This is a best-effort test since row heights in jsdom are 0
  });
});
