import React, { useState } from 'react';
import { ConnectionHandle } from '../../canvas-engine/index.js';
import { type ConstructSchema, type ConstructNodeData, getFieldsForSummary, resolveNodeColor, type DocumentAdapter, canConnect } from '@carta/schema';
import type { LodBand } from './lod/lodPolicy.js';
import ColorPicker from '../ui/ColorPicker.js';
import { SimpleMarkdown } from '../ui/SimpleMarkdown.js';

// Field list component with editing state
function MapV2FieldList({ schema, constructData, adapter, nodeId }: {
  schema: ConstructSchema;
  constructData: ConstructNodeData;
  adapter: DocumentAdapter;
  nodeId: string;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const fields = getFieldsForSummary(schema);

  if (fields.length === 0) return null;

  return (
    <div style={{ padding: '2px 8px 6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {fields.map(field => {
        const value = constructData.values[field.name] ?? field.default;
        const isMultiline = field.displayHint === 'multiline' || field.displayHint === 'code';

        const commitValue = (newValue: unknown) => {
          adapter.updateNode(nodeId, { values: { ...constructData.values, [field.name]: newValue } });
          setEditingField(null);
        };

        if (editingField === field.name) {
          return (
            <div key={field.name} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 10, color: 'var(--color-content-subtle)' }}>{field.label}</div>
              {field.type === 'boolean' ? (
                <input type="checkbox" checked={!!value} onChange={(e) => commitValue(e.target.checked)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus style={{ width: 16, height: 16, cursor: 'pointer' }} />
              ) : field.type === 'enum' && field.options ? (
                <select
                  style={{ width: '100%', padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, fontSize: 11, color: 'var(--color-content)', border: '1px solid var(--color-accent)', outline: 'none' }}
                  value={String(value ?? '')}
                  onChange={(e) => commitValue(e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                >
                  <option value="">Select...</option>
                  {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.value}</option>)}
                </select>
              ) : isMultiline ? (
                <textarea
                  style={{ width: '100%', padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, fontSize: 11, color: 'var(--color-content)', border: '1px solid var(--color-accent)', outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'monospace' }}
                  defaultValue={String(value ?? '')}
                  onBlur={(e) => commitValue(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  style={{ width: '100%', padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, fontSize: 11, color: 'var(--color-content)', border: '1px solid var(--color-accent)', outline: 'none' }}
                  defaultValue={String(value ?? '')}
                  onBlur={(e) => commitValue(field.type === 'number' ? Number(e.target.value) : e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLElement).blur(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                />
              )}
            </div>
          );
        }

        const display = value != null ? String(value) : '';
        return (
          <div
            key={field.name}
            onClick={(e) => { e.stopPropagation(); setEditingField(field.name); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer', minWidth: 0 }}
          >
            {isMultiline ? (
              <>
                <div style={{ fontSize: 10, color: 'var(--color-content-subtle)' }}>{field.label}:</div>
                <div style={{ fontSize: 11, color: 'var(--color-content)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>{display}</div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--color-content-subtle)', flexShrink: 0 }}>{field.label}:</span>
                <span style={{ fontSize: 11, color: 'var(--color-content)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {field.type === 'boolean' ? (value ? 'Yes' : 'No') : display}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Shape rendering helper interface
interface ShapeRenderProps {
  nodeId: string;
  absX: number;
  absY: number;
  width: number;
  height: number;
  selected: boolean;
  color: string;
  label: string;
  schema: ConstructSchema;
  constructData: ConstructNodeData;
  dimmed: boolean;
  sequenceBadge: number | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  // Port rendering
  node: any;
  hoveredNodeId: string | null;
  connectionDrag: any;
  sourcePortType: string | null;
  getPortSchema: (type: string) => any;
  startConnection: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
  showNarrative: (state: any) => void;
  hideNarrative: () => void;
}

function ResizeHandle({ selected, onResizePointerDown }: { selected: boolean; onResizePointerDown: (e: React.PointerEvent) => void }) {
  if (!selected) return null;
  return (
    <div
      style={{
        position: 'absolute', bottom: 0, right: 0, width: 10, height: 10,
        cursor: 'se-resize', backgroundColor: 'var(--color-accent, #3b82f6)',
        opacity: 0.5, borderRadius: '2px 0 6px 0',
      }}
      onPointerDown={onResizePointerDown}
    />
  );
}

function renderCircleNode(props: ShapeRenderProps) {
  const { nodeId, absX, absY, width, selected, label, schema, constructData, dimmed, onPointerDown, onPointerEnter, onPointerLeave, onContextMenu, onDoubleClick, onResizePointerDown } = props;
  const resolvedColor = resolveNodeColor(schema, constructData);
  return (
    <div key={nodeId} data-node-id={nodeId} data-no-pan="true"
      onPointerDown={onPointerDown} onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave} onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute', left: absX, top: absY,
        width: Math.max(width, 80), aspectRatio: '1 / 1',
        borderRadius: '50%',
        backgroundColor: `color-mix(in srgb, ${resolvedColor} 25%, var(--color-surface))`,
        border: `2px solid ${resolvedColor}`,
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'grab', overflow: 'hidden',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
      }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-content)', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {label}
      </span>
      <ResizeHandle selected={selected} onResizePointerDown={onResizePointerDown} />
    </div>
  );
}

function renderDiamondNode(props: ShapeRenderProps) {
  const { nodeId, absX, absY, width, selected, label, schema, constructData, dimmed, onPointerDown, onPointerEnter, onPointerLeave, onContextMenu, onDoubleClick, onResizePointerDown } = props;
  const resolvedColor = resolveNodeColor(schema, constructData);
  const size = Math.max(width, 100);
  return (
    <div key={nodeId} data-node-id={nodeId} data-no-pan="true"
      onPointerDown={onPointerDown} onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave} onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute', left: absX, top: absY,
        width: size, height: size,
        cursor: 'grab',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
      }}>
      {/* Rotated square */}
      <div style={{
        position: 'absolute', inset: 0,
        transform: 'rotate(45deg)',
        backgroundColor: `color-mix(in srgb, ${resolvedColor} 25%, var(--color-surface))`,
        border: `2px solid ${resolvedColor}`,
        borderRadius: 4,
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
      }} />
      {/* Content overlay (not rotated) */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-content)', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
          {label}
        </span>
      </div>
      <ResizeHandle selected={selected} onResizePointerDown={onResizePointerDown} />
    </div>
  );
}

function renderDocumentNode(props: ShapeRenderProps) {
  const { nodeId, absX, absY, width, selected, label, schema, constructData, dimmed, onPointerDown, onPointerEnter, onPointerLeave, onContextMenu, onDoubleClick, onResizePointerDown } = props;
  const resolvedColor = resolveNodeColor(schema, constructData);
  return (
    <div key={nodeId} data-node-id={nodeId} data-no-pan="true"
      onPointerDown={onPointerDown} onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave} onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute', left: absX, top: absY,
        width, cursor: 'grab',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
      }}>
      <div style={{
        backgroundColor: `color-mix(in srgb, ${resolvedColor} 25%, var(--color-surface))`,
        border: `2px solid ${resolvedColor}`,
        borderBottom: 'none',
        borderRadius: '4px 4px 0 0',
        minHeight: 60, padding: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-content)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {label}
        </span>
      </div>
      <svg viewBox="0 0 200 20" preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 12 }}>
        <path
          d="M0,0 L0,10 Q50,20 100,10 Q150,0 200,10 L200,0 Z"
          fill={`color-mix(in srgb, ${resolvedColor} 25%, var(--color-surface))`}
          stroke={resolvedColor} strokeWidth="2" vectorEffect="non-scaling-stroke"
        />
      </svg>
      <ResizeHandle selected={selected} onResizePointerDown={onResizePointerDown} />
    </div>
  );
}

function renderParallelogramNode(props: ShapeRenderProps) {
  const { nodeId, absX, absY, width, selected, label, schema, constructData, dimmed, onPointerDown, onPointerEnter, onPointerLeave, onContextMenu, onDoubleClick, onResizePointerDown } = props;
  const resolvedColor = resolveNodeColor(schema, constructData);
  const W = Math.max(width, 120);
  const H = 60;
  const S = W * 0.2;
  return (
    <div key={nodeId} data-node-id={nodeId} data-no-pan="true"
      onPointerDown={onPointerDown} onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave} onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute', left: absX, top: absY,
        width: W, height: H,
        cursor: 'grab',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
      }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
        <path
          d={`M${S},0 L${W},0 L${W - S},${H} L0,${H} Z`}
          fill={`color-mix(in srgb, ${resolvedColor} 25%, var(--color-surface))`}
          stroke={resolvedColor} strokeWidth="2"
          style={{ filter: selected ? 'drop-shadow(var(--node-shadow-selected))' : 'drop-shadow(var(--node-shadow))' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-content)', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
          {label}
        </span>
      </div>
      <ResizeHandle selected={selected} onResizePointerDown={onResizePointerDown} />
    </div>
  );
}

function renderStadiumNode(props: ShapeRenderProps) {
  const { nodeId, absX, absY, width, selected, label, schema, constructData, dimmed, onPointerDown, onPointerEnter, onPointerLeave, onContextMenu, onDoubleClick, onResizePointerDown } = props;
  const resolvedColor = resolveNodeColor(schema, constructData);
  return (
    <div key={nodeId} data-node-id={nodeId} data-no-pan="true"
      onPointerDown={onPointerDown} onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave} onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute', left: absX, top: absY,
        width: Math.max(width, 120), minHeight: 60,
        borderRadius: 9999,
        backgroundColor: `color-mix(in srgb, ${resolvedColor} 25%, var(--color-surface))`,
        border: `2px solid ${resolvedColor}`,
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'grab', overflow: 'hidden',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
      }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-content)', textAlign: 'center', padding: '0 16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {label}
      </span>
      <ResizeHandle selected={selected} onResizePointerDown={onResizePointerDown} />
    </div>
  );
}

function getAdaptiveTextColor(bg: string, schemaColor: string): string {
  // If bg is a color-mix expression, we can't parse it in JS.
  // Use the schema color as the reference — at 30% mix with white-ish surface,
  // the result is always lighter than the schema color, so the schema color
  // is a conservative (darker) proxy for contrast decisions.
  const hex = bg.startsWith('#') ? bg : schemaColor;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // WCAG relative luminance
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
}

function SimpleNode(props: ShapeRenderProps & { adapter: DocumentAdapter }) {
  const { nodeId, absX, absY, width, height, selected, schema, constructData, dimmed, onPointerDown, onPointerEnter, onPointerLeave, onContextMenu, onResizePointerDown, adapter,
    node, hoveredNodeId, connectionDrag, sourcePortType, getPortSchema, startConnection, showNarrative, hideNarrative,
  } = props;
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const resolvedColor = resolveNodeColor(schema, constructData);
  const bgColor = resolvedColor !== schema.color
    ? resolvedColor
    : `color-mix(in srgb, ${schema.color} 30%, var(--color-surface))`;
  const adaptiveTextColor = getAdaptiveTextColor(bgColor, schema.color);

  // All visible fields (any displayTier set), sorted by displayOrder
  const visibleFields = (schema.fields ?? [])
    .filter(f => f.displayTier != null)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const commitValue = (fieldName: string, newValue: unknown) => {
    adapter.updateNode(nodeId, { values: { ...constructData.values, [fieldName]: newValue } });
    setEditingField(null);
  };

  return (
    <div key={nodeId} data-node-id={nodeId} data-no-pan="true"
      onPointerDown={onPointerDown} onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave} onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const firstEmpty = visibleFields.find(f => !constructData.values?.[f.name]);
        if (firstEmpty) setEditingField(firstEmpty.name);
        else if (visibleFields.length > 0) setEditingField(visibleFields[0].name);
      }}
      style={{
        position: 'absolute', left: absX, top: absY,
        width: Math.max(width, 200), minHeight: Math.max(height, 100),
        backgroundColor: bgColor,
        borderRadius: 8,
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        cursor: 'grab', padding: 0,
        display: 'flex', flexDirection: 'column',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
      }}>
      {/* Drag header strip */}
      <div style={{
        height: 28,
        borderRadius: '8px 8px 0 0',
        cursor: 'grab',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
      }}>
        {schema.instanceColors && (
          <div style={{ position: 'relative' }}>
            <div
              onClick={(e) => { e.stopPropagation(); setShowPicker(p => !p); }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                backgroundColor: resolvedColor,
                cursor: 'pointer',
                border: '2px solid rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
            />
            {showPicker && (
              <div
                style={{ position: 'absolute', top: 22, left: 0, zIndex: 100 }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ColorPicker
                  value={constructData.instanceColor}
                  onChange={(color) => {
                    adapter.updateNode(nodeId, { instanceColor: color ?? undefined });
                    setShowPicker(false);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content area with padding */}
      <div style={{ padding: '4px 12px 20px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, color: adaptiveTextColor }}>
      {visibleFields.map((field, index) => {
        const isTitle = index === 0;
        const value = constructData.values?.[field.name] ?? '';
        const isMultiline = field.displayHint === 'multiline' || field.displayHint === 'markdown';

        if (editingField === field.name) {
          return (
            <div key={field.name} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              style={{ flex: isMultiline ? 1 : undefined, display: isMultiline ? 'flex' : undefined,
                backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, padding: '2px 4px', margin: '-2px -4px' }}>
              {isMultiline ? (
                <textarea
                  style={{ width: '100%', flex: 1, padding: 0, backgroundColor: 'transparent', border: 'none', outline: 'none', resize: 'none',
                    fontSize: isTitle ? 15 : 13, fontWeight: isTitle ? 600 : 400, color: 'inherit', fontFamily: 'inherit', minHeight: 40 }}
                  defaultValue={String(value)}
                  placeholder={field.placeholder ?? ''}
                  onBlur={(e) => commitValue(field.name, e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  style={{ width: '100%', padding: 0, backgroundColor: 'transparent', border: 'none', outline: 'none',
                    fontSize: isTitle ? 15 : 13, fontWeight: isTitle ? 600 : 400, color: 'inherit', fontFamily: 'inherit' }}
                  defaultValue={String(value)}
                  placeholder={field.placeholder ?? ''}
                  onBlur={(e) => commitValue(field.name, e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLElement).blur(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                />
              )}
            </div>
          );
        }

        return (
          <div
            key={field.name}
            onClick={(e) => { e.stopPropagation(); setEditingField(field.name); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              flex: isMultiline ? 1 : undefined,
              fontSize: isTitle ? 15 : 13,
              fontWeight: isTitle ? 600 : 400,
              color: 'inherit',
              cursor: 'text',
              whiteSpace: isMultiline ? 'pre-wrap' : undefined,
              overflow: 'hidden',
              minHeight: isMultiline ? 40 : isTitle ? 20 : undefined,
              backgroundColor: 'rgba(0,0,0,0.05)',
              borderRadius: 4,
              padding: '2px 4px',
              margin: '-2px -4px',
            }}
          >
            {value ? (
              field.displayHint === 'markdown'
                ? <SimpleMarkdown content={String(value)} />
                : String(value)
            ) : (
              <span style={{ opacity: 0.4, fontWeight: 400 }}>{field.placeholder ?? ''}</span>
            )}
          </div>
        );
      })}

      </div>

      {/* Resize handle — visible on hover, prominent on select */}
      <div
        style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 12, height: 12,
          cursor: 'se-resize',
          opacity: selected ? 0.6 : (hoveredNodeId === node.id ? 0.3 : 0),
          transition: 'opacity 150ms ease',
          background: `linear-gradient(135deg, transparent 50%, ${adaptiveTextColor} 50%)`,
          borderRadius: 2,
          zIndex: 5,
        }}
        onPointerDown={onResizePointerDown}
      />

      {/* Port drawer - collapsed state (dots strip) */}
      {schema?.ports && schema.ports.length > 0 && !connectionDrag && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          backgroundColor: 'var(--color-surface-alt, rgba(0,0,0,0.1))',
          borderRadius: '0 0 6px 6px',
        }}>
          {schema.ports.map((port: any) => {
            const portSchema = getPortSchema(port.portType);
            return (
              <div key={port.id} style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: portSchema?.color ?? '#888',
              }} />
            );
          })}
        </div>
      )}

      {/* Port drawer - expanded state (during drag or hover) */}
      {schema?.ports && schema.ports.length > 0 && (connectionDrag || hoveredNodeId === node.id) && (
        <div style={{
          position: 'absolute',
          top: '100%', left: 0, right: 0,
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          borderRadius: '0 0 6px 6px',
          padding: '4px 0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 30,
        }}>
          {schema.ports.map((port: any) => {
            const portSchema = getPortSchema(port.portType);
            const portColor = portSchema?.color ?? '#888';
            const polarity = port.polarity ?? 'any';
            const isSource = polarity === 'output' || polarity === 'inout' || polarity === 'any';

            // During drag: show as target
            if (connectionDrag) {
              // Check compatibility for dimming and narrator feedback
              const isCompatible = sourcePortType ? canConnect(sourcePortType, port.portType) : false;
              const opacity = isCompatible ? 1 : 0.3;

              const handlePortHover = (e: React.PointerEvent) => {
                if (isCompatible) {
                  showNarrative({
                    kind: 'hint',
                    text: `Connect ${connectionDrag.sourceHandle} → ${port.label ?? port.id}`,
                    variant: 'valid-connection',
                    position: { x: e.clientX, y: e.clientY },
                  });
                } else {
                  showNarrative({
                    kind: 'hint',
                    text: `Incompatible port types`,
                    variant: 'invalid-connection',
                    position: { x: e.clientX, y: e.clientY },
                  });
                }
              };

              return (
                <div
                  key={port.id}
                  onPointerEnter={handlePortHover}
                  onPointerLeave={() => hideNarrative()}
                  style={{ opacity }}
                >
                  <ConnectionHandle
                    type="target"
                    id={port.id}
                    nodeId={node.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      minHeight: 36,
                      cursor: 'crosshair',
                      borderRadius: 4,
                      margin: '0 4px',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      backgroundColor: portColor,
                      border: '2px solid var(--color-surface)',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 12, color: 'var(--color-content)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {port.label ?? port.id}
                    </span>
                  </ConnectionHandle>
                </div>
              );
            }

            // No drag: show as source
            if (isSource) {
              return (
                <ConnectionHandle
                  key={port.id}
                  type="source"
                  id={port.id}
                  nodeId={node.id}
                  onStartConnection={startConnection}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    minHeight: 36,
                    cursor: 'crosshair',
                    borderRadius: 4,
                    margin: '0 4px',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    backgroundColor: portColor,
                    border: '2px solid var(--color-surface)',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 12, color: 'var(--color-content)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {port.label ?? port.id}
                  </span>
                </ConnectionHandle>
              );
            }

            // Non-source port (input-only), show as label
            return (
              <div key={port.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', minHeight: 36,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: portColor, flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: 'var(--color-content)' }}>
                  {port.label ?? port.id}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface MapV2ConstructNodeProps {
  node: any;
  absX: number;
  absY: number;
  width: number;
  height: number;
  selected: boolean;
  label: string;
  color: string;
  schema: ConstructSchema;
  constructData: ConstructNodeData;
  dimmed: boolean;
  sequenceBadge: number | null;
  lodBand: LodBand;
  isCovered: boolean;
  adapter: DocumentAdapter;
  // Interaction
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  // Port rendering
  hoveredNodeId: string | null;
  connectionDrag: any;
  sourcePortType: string | null;
  getPortSchema: (type: string) => any;
  startConnection: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
  // Narrative
  showNarrative: (state: any) => void;
  hideNarrative: () => void;
}

export function MapV2ConstructNode({
  node,
  absX,
  absY,
  width,
  height,
  selected,
  label,
  color,
  schema,
  constructData,
  dimmed,
  sequenceBadge,
  lodBand,
  isCovered,
  adapter,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onContextMenu,
  onDoubleClick,
  onResizePointerDown,
  hoveredNodeId,
  connectionDrag,
  sourcePortType,
  getPortSchema,
  startConnection,
  showNarrative,
  hideNarrative,
}: MapV2ConstructNodeProps) {
  // Marker mode (LOD) rendering
  if (lodBand === 'marker' && !isCovered) {
    const resolvedColor = resolveNodeColor(schema, constructData);
    return (
      <div
        key={node.id}
        data-node-id={node.id}
        data-no-pan="true"
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        style={{
          position: 'absolute',
          left: absX,
          top: absY,
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: `color-mix(in srgb, ${resolvedColor} 25%, var(--color-surface))`,
          borderRadius: 8,
          padding: '8px 16px',
          boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
          minWidth: 180, maxWidth: 500,
          overflow: 'hidden',
          cursor: 'grab',
          opacity: dimmed ? 0.2 : 1,
          pointerEvents: dimmed ? 'none' : 'auto',
          transition: 'opacity 150ms ease',
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: resolvedColor, flexShrink: 0 }} />
        {sequenceBadge != null && (
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, lineHeight: 1,
            backgroundColor: 'var(--color-surface-alt)',
            color: 'var(--color-content)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            border: '1px solid var(--color-border)',
            flexShrink: 0,
          }}>
            {sequenceBadge}
          </div>
        )}
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-content)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
    );
  }

  // Shape-based rendering
  const shapeMode = schema.nodeShape;
  const shapeProps = {
    nodeId: node.id, absX, absY, width, height, selected,
    color, label, schema, constructData, dimmed, sequenceBadge,
    onPointerDown, onPointerEnter, onPointerLeave, onContextMenu, onDoubleClick, onResizePointerDown,
    node, hoveredNodeId, connectionDrag, sourcePortType, getPortSchema, startConnection, showNarrative, hideNarrative,
  };
  if (shapeMode === 'circle') {
    return renderCircleNode(shapeProps);
  }
  if (shapeMode === 'diamond') {
    return renderDiamondNode(shapeProps);
  }
  if (shapeMode === 'document') {
    return renderDocumentNode(shapeProps);
  }
  if (shapeMode === 'simple') {
    return <SimpleNode {...shapeProps} adapter={adapter} />;
  }
  if (shapeMode === 'parallelogram') {
    return renderParallelogramNode(shapeProps);
  }
  if (shapeMode === 'stadium') {
    return renderStadiumNode(shapeProps);
  }

  // Default card rendering
  return (
    <div
      key={node.id}
      data-node-id={node.id}
      data-no-pan="true"
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute',
        left: absX,
        top: absY,
        width,
        minHeight: height,
        backgroundColor: 'var(--color-surface)',
        borderLeft: `2px solid color-mix(in srgb, ${color} 70%, var(--color-surface-alt))`,
        borderRadius: 8,
        boxShadow: selected ? 'var(--node-shadow-selected), 0 0 0 2px rgba(99,102,241,0.3)' : 'var(--node-shadow)',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--color-content)',
        fontSize: 12,
        fontWeight: 500,
        overflow: 'visible',
        cursor: 'grab',
        minWidth: 180,
        maxWidth: 280,
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transition: 'opacity 150ms ease',
      }}
    >
      {/* Sequence badge */}
      {sequenceBadge != null && lodBand !== 'marker' && (
        <div style={{
          position: 'absolute', top: -8, left: -8, zIndex: 10,
          width: 20, height: 20, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600, lineHeight: 1, pointerEvents: 'none',
          backgroundColor: 'var(--color-surface-alt)',
          color: 'var(--color-content)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          border: '1px solid var(--color-border)',
        }}>
          {sequenceBadge}
        </div>
      )}

      {/* Selection dot */}
      {selected && (
        <div style={{
          position: 'absolute', top: -4, right: -4, width: 8, height: 8,
          borderRadius: '50%', backgroundColor: 'var(--color-accent, #6366f1)',
          boxShadow: '0 0 0 2px var(--color-surface)',
        }} />
      )}

      {/* Header with schema badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        padding: '4px 8px',
        cursor: 'move',
        backgroundColor: 'var(--color-surface-alt)',
        borderRadius: '8px 8px 0 0',
        userSelect: 'none',
      }}>
        <span style={{ fontSize: 11, color: 'var(--color-content-muted)' }}>
          {schema.displayName}
        </span>
      </div>

      {/* Display name */}
      <div style={{
        padding: '6px 8px 2px',
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--color-content)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </div>

      {/* Fields */}
      <MapV2FieldList schema={schema} constructData={constructData} adapter={adapter} nodeId={node.id} />

      {/* Palette picker — shown when instanceColors is enabled and node is selected */}
      {schema.instanceColors && selected && (
        <div style={{ padding: '2px 8px' }}>
          <ColorPicker value={constructData.instanceColor} onChange={(color) => adapter.updateNode(node.id, { instanceColor: color ?? undefined })} />
        </div>
      )}

      {/* Resize handle */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            cursor: 'se-resize',
            backgroundColor: 'var(--color-accent, #3b82f6)',
            opacity: 0.5,
            borderRadius: '2px 0 6px 0',
          }}
          onPointerDown={onResizePointerDown}
        />
      )}

      {/* Port drawer - collapsed state (dots strip) */}
      {schema?.ports && schema.ports.length > 0 && !connectionDrag && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          backgroundColor: 'var(--color-surface-alt, rgba(0,0,0,0.1))',
          borderRadius: '0 0 6px 6px',
        }}>
          {schema.ports.map((port: any) => {
            const portSchema = getPortSchema(port.portType);
            return (
              <div key={port.id} style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: portSchema?.color ?? '#888',
              }} />
            );
          })}
        </div>
      )}

      {/* Port drawer - expanded state (during drag or hover) */}
      {schema?.ports && schema.ports.length > 0 && (connectionDrag || hoveredNodeId === node.id) && (
        <div style={{
          position: 'absolute',
          top: '100%', left: 0, right: 0,
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          borderRadius: '0 0 6px 6px',
          padding: '4px 0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 30,
        }}>
          {schema.ports.map((port: any) => {
            const portSchema = getPortSchema(port.portType);
            const portColor = portSchema?.color ?? '#888';
            const polarity = port.polarity ?? 'any';
            const isSource = polarity === 'output' || polarity === 'inout' || polarity === 'any';

            // During drag: show as target
            if (connectionDrag) {
              // Check compatibility for dimming and narrator feedback
              const isCompatible = sourcePortType ? canConnect(sourcePortType, port.portType) : false;
              const opacity = isCompatible ? 1 : 0.3;

              const handlePortHover = (e: React.PointerEvent) => {
                if (isCompatible) {
                  showNarrative({
                    kind: 'hint',
                    text: `Connect ${connectionDrag.sourceHandle} → ${port.label ?? port.id}`,
                    variant: 'valid-connection',
                    position: { x: e.clientX, y: e.clientY },
                  });
                } else {
                  showNarrative({
                    kind: 'hint',
                    text: `Incompatible port types`,
                    variant: 'invalid-connection',
                    position: { x: e.clientX, y: e.clientY },
                  });
                }
              };

              return (
                <div
                  key={port.id}
                  onPointerEnter={handlePortHover}
                  onPointerLeave={() => hideNarrative()}
                  style={{ opacity }}
                >
                  <ConnectionHandle
                    type="target"
                    id={port.id}
                    nodeId={node.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      minHeight: 36,
                      cursor: 'crosshair',
                      borderRadius: 4,
                      margin: '0 4px',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      backgroundColor: portColor,
                      border: '2px solid var(--color-surface)',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 12, color: 'var(--color-content)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {port.label ?? port.id}
                    </span>
                  </ConnectionHandle>
                </div>
              );
            }

            // No drag: show as source
            if (isSource) {
              return (
                <ConnectionHandle
                  key={port.id}
                  type="source"
                  id={port.id}
                  nodeId={node.id}
                  onStartConnection={startConnection}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    minHeight: 36,
                    cursor: 'crosshair',
                    borderRadius: 4,
                    margin: '0 4px',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    backgroundColor: portColor,
                    border: '2px solid var(--color-surface)',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 12, color: 'var(--color-content)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {port.label ?? port.id}
                  </span>
                </ConnectionHandle>
              );
            }

            // Non-source port (input-only), show as label
            return (
              <div key={port.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', minHeight: 36,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: portColor, flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: 'var(--color-content)' }}>
                  {port.label ?? port.id}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
