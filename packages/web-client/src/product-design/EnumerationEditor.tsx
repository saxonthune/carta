import { useState, useRef } from 'react';
import { DotsSixVertical, Trash, Plus } from '@phosphor-icons/react';
import Input from '../components/ui/Input';
import type { EnumerationData, EnumerationValue } from './types';

export interface EnumerationEditorProps {
  /** The enumeration name, displayed in the header */
  name: string;
  /** The enumeration data */
  value: EnumerationData;
  /** Called when the data changes */
  onChange: (data: EnumerationData) => void;
}

interface EditingCell {
  index: number;
  field: 'key' | 'remark';
}

interface DragState {
  dragIndex: number;
  overIndex: number;
}

export function EnumerationEditor({ name, value, onChange }: EnumerationEditorProps): React.ReactElement {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const dragStartY = useRef<number>(0);
  const rowHeight = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleToggleKind(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ ...value, kind: value.kind === 'ordinal' ? 'nominal' : 'ordinal' });
  }

  function handleCellClick(e: React.MouseEvent, index: number, field: 'key' | 'remark') {
    e.stopPropagation();
    const currentValue = field === 'key' ? value.values[index].key : (value.values[index].remark ?? '');
    setEditingCell({ index, field });
    setEditValue(currentValue);
  }

  function commitEdit(index: number, field: 'key' | 'remark', newValue: string) {
    const newValues = [...value.values];
    if (field === 'key') {
      newValues[index] = { ...newValues[index], key: newValue };
    } else {
      newValues[index] = { ...newValues[index], remark: newValue || undefined };
    }
    onChange({ ...value, values: newValues });
    setEditingCell(null);
  }

  function handleInputKeyDown(e: React.KeyboardEvent, index: number, field: 'key' | 'remark') {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commitEdit(index, field, editValue);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }

  function handleInputBlur(index: number, field: 'key' | 'remark') {
    commitEdit(index, field, editValue);
  }

  function handleAddValue(e: React.MouseEvent) {
    e.stopPropagation();
    const newValues = [...value.values, { key: '' }];
    onChange({ ...value, values: newValues });
    const newIndex = newValues.length - 1;
    setEditingCell({ index: newIndex, field: 'key' });
    setEditValue('');
  }

  function handleDelete(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    const newValues = value.values.filter((_, i) => i !== index);
    onChange({ ...value, values: newValues });
    if (editingCell?.index === index) {
      setEditingCell(null);
    }
  }

  function handleDragPointerDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    e.preventDefault();
    dragStartY.current = e.clientY;
    // Estimate row height from container
    if (containerRef.current) {
      const rows = containerRef.current.querySelectorAll('[data-row]');
      if (rows.length > 0) {
        rowHeight.current = (rows[0] as HTMLElement).getBoundingClientRect().height;
      }
    }
    setDragState({ dragIndex: index, overIndex: index });
    const el = e.currentTarget as HTMLElement;
    if (el.setPointerCapture) {
      el.setPointerCapture(e.pointerId);
    }
  }

  function handleDragPointerMove(e: React.PointerEvent, index: number) {
    if (dragState === null || dragState.dragIndex !== index) return;
    e.stopPropagation();
    const dy = e.clientY - dragStartY.current;
    const rh = rowHeight.current || 40;
    const offset = Math.round(dy / rh);
    const newOver = Math.max(0, Math.min(value.values.length - 1, dragState.dragIndex + offset));
    if (newOver !== dragState.overIndex) {
      setDragState({ ...dragState, overIndex: newOver });
    }
  }

  function handleDragPointerUp(e: React.PointerEvent, index: number) {
    if (dragState === null || dragState.dragIndex !== index) return;
    e.stopPropagation();
    const { dragIndex, overIndex } = dragState;
    if (dragIndex !== overIndex) {
      const newValues = [...value.values];
      const [moved] = newValues.splice(dragIndex, 1);
      newValues.splice(overIndex, 0, moved);
      onChange({ ...value, values: newValues });
    }
    setDragState(null);
  }

  const displayValues: EnumerationValue[] = value.values;

  return (
    <div className="rounded-lg shadow-sm overflow-hidden select-none" onPointerDown={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="bg-surface-depth-2 rounded-t-lg px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-content">{name}</span>
        <button
          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface text-content-muted hover:bg-surface-alt transition-colors cursor-pointer border border-subtle"
          onClick={handleToggleKind}
          onPointerDown={(e) => e.stopPropagation()}
          title="Click to toggle kind"
        >
          {value.kind}
        </button>
      </div>

      {/* Table body */}
      <div ref={containerRef} className="bg-surface">
        {displayValues.map((row, index) => {
          const isOver = dragState !== null && dragState.overIndex === index && dragState.dragIndex !== index;
          const isDragging = dragState !== null && dragState.dragIndex === index;
          return (
            <div
              key={index}
              data-row={index}
              className={[
                'flex items-center gap-1 px-2 border-b border-subtle group transition-colors',
                isOver ? 'bg-accent/10' : '',
                isDragging ? 'opacity-50' : '',
                hoveredRow === index ? 'bg-surface-depth-1' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => setHoveredRow(index)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* Drag handle */}
              <div
                className="shrink-0 cursor-grab active:cursor-grabbing text-content-muted py-2 touch-none"
                onPointerDown={(e) => handleDragPointerDown(e, index)}
                onPointerMove={(e) => handleDragPointerMove(e, index)}
                onPointerUp={(e) => handleDragPointerUp(e, index)}
              >
                <DotsSixVertical weight="bold" size={14} />
              </div>

              {/* Key cell */}
              <div className="flex-1 min-w-0 py-1">
                {editingCell?.index === index && editingCell.field === 'key' ? (
                  <Input
                    size="sm"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleInputBlur(index, 'key')}
                    onKeyDown={(e) => handleInputKeyDown(e, index, 'key')}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="block px-1 py-1 text-sm text-content cursor-text hover:bg-surface-depth-1 rounded truncate"
                    onClick={(e) => handleCellClick(e, index, 'key')}
                  >
                    {row.key || <span className="text-content-muted italic">key</span>}
                  </span>
                )}
              </div>

              {/* Remark cell */}
              <div className="flex-[2] min-w-0 py-1">
                {editingCell?.index === index && editingCell.field === 'remark' ? (
                  <Input
                    size="sm"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleInputBlur(index, 'remark')}
                    onKeyDown={(e) => handleInputKeyDown(e, index, 'remark')}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="block px-1 py-1 text-sm text-content-muted cursor-text hover:bg-surface-depth-1 rounded truncate"
                    onClick={(e) => handleCellClick(e, index, 'remark')}
                  >
                    {row.remark || ''}
                  </span>
                )}
              </div>

              {/* Delete button */}
              <button
                className={[
                  'shrink-0 w-6 h-6 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt cursor-pointer border-none',
                  hoveredRow === index ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                ].join(' ')}
                onClick={(e) => handleDelete(e, index)}
                onPointerDown={(e) => e.stopPropagation()}
                title="Delete value"
              >
                <Trash weight="regular" size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-surface px-3 py-2 rounded-b-lg border-t border-subtle">
        <button
          className="flex items-center gap-1 text-sm text-content-muted hover:text-content transition-colors cursor-pointer border-none bg-transparent"
          onClick={handleAddValue}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Plus weight="bold" size={14} />
          Add value
        </button>
      </div>
    </div>
  );
}
