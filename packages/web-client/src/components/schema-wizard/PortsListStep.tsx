import { useState } from 'react';
import type { PortConfig, PortSchema } from '@carta/schema';
import { PencilSimple, Trash } from '@phosphor-icons/react';

interface PortsListStepProps {
  ports: PortConfig[];
  portSchemas: PortSchema[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: (portType: string) => void;
  // Edit-mode migration callbacks (optional)
  isEditMode?: boolean;
  onRenamePort?: (oldPortId: string, newPortId: string) => void;
  onRemovePort?: (portId: string) => void;
  onChangePortType?: (portId: string, newPortType: string) => void;
  onCountEdgesForPort?: (portId: string) => number;
}

export default function PortsListStep({
  ports,
  portSchemas,
  onEdit,
  onRemove,
  onAdd,
  isEditMode,
  onRenamePort,
  onRemovePort,
  onChangePortType,
  onCountEdgesForPort,
}: PortsListStepProps) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [renamingPortId, setRenamingPortId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmingRemovePortId, setConfirmingRemovePortId] = useState<string | null>(null);
  const [removeEdgeCount, setRemoveEdgeCount] = useState(0);

  return (
    <div className="flex flex-col gap-2">
      {ports.length === 0 ? (
        <div className="text-center py-8 text-content-muted text-sm">
          <p className="mb-2">No ports configured</p>
          <p className="text-xs">Ports define how this construct connects to others</p>
        </div>
      ) : (
        ports.map((port, index) => {
          const ps = portSchemas.find(s => s.id === port.portType);
          const isRenaming = isEditMode && renamingPortId === port.id;
          const isConfirmingRemove = isEditMode && confirmingRemovePortId === port.id;

          return (
            <div
              key={index}
              className="flex flex-col gap-2 px-3 py-2.5 bg-surface rounded-md hover:bg-surface-elevated transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: ps?.color || '#6b7280' }}
                  />
                  <span className="text-sm font-medium text-content truncate">{port.label}</span>

                  {/* Port ID badge - clickable in edit mode for rename */}
                  {isRenaming ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="text-[10px] px-1.5 py-0.5 bg-surface-depth-3 border border-accent rounded text-content w-24"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && renameValue.trim() && onRenamePort) {
                            onRenamePort(port.id, renameValue.trim());
                            setRenamingPortId(null);
                          } else if (e.key === 'Escape') {
                            setRenamingPortId(null);
                          }
                        }}
                      />
                      <button
                        className="text-[10px] px-1.5 py-0.5 bg-accent text-white rounded"
                        onClick={() => {
                          if (renameValue.trim() && onRenamePort) {
                            onRenamePort(port.id, renameValue.trim());
                            setRenamingPortId(null);
                          }
                        }}
                      >
                        ✓
                      </button>
                      <button
                        className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded"
                        onClick={() => setRenamingPortId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase ${isEditMode && onRenamePort ? 'cursor-pointer hover:bg-accent/20' : ''}`}
                      onClick={() => {
                        if (isEditMode && onRenamePort) {
                          setRenamingPortId(port.id);
                          setRenameValue(port.id);
                        }
                      }}
                      title={isEditMode ? 'Click to rename port ID' : undefined}
                    >
                      {port.id}
                    </span>
                  )}

                  {/* Port type dropdown in edit mode */}
                  {isEditMode && onChangePortType ? (
                    <select
                      value={port.portType}
                      onChange={(e) => onChangePortType(port.id, e.target.value)}
                      className="text-[10px] px-1.5 py-0.5 bg-surface-depth-3 border border-border rounded text-content-muted uppercase"
                    >
                      {portSchemas.map((ps) => (
                        <option key={ps.id} value={ps.id}>
                          {ps.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase">
                      {port.portType}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-content transition-colors rounded hover:bg-surface-alt"
                    onClick={() => onEdit(index)}
                    title="Edit port metadata"
                  >
                    <PencilSimple weight="regular" size={16} />
                  </button>
                  <button
                    className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditMode && onRemovePort && onCountEdgesForPort) {
                        const count = onCountEdgesForPort(port.id);
                        setRemoveEdgeCount(count);
                        setConfirmingRemovePortId(port.id);
                      } else {
                        onRemove(index);
                      }
                    }}
                    title="Remove port"
                  >
                    <Trash weight="regular" size={16} />
                  </button>
                </div>
              </div>

              {/* Remove confirmation in edit mode */}
              {isConfirmingRemove && (
                <div className="flex items-center justify-between px-2 py-1.5 bg-danger/10 border border-danger/30 rounded text-xs">
                  <span className="text-danger">
                    Remove port? {removeEdgeCount} connection(s) will be deleted.
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 bg-danger text-white rounded hover:bg-danger/90"
                      onClick={() => {
                        if (onRemovePort) {
                          onRemovePort(port.id);
                        }
                        setConfirmingRemovePortId(null);
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      className="px-2 py-0.5 bg-surface-alt rounded hover:bg-surface"
                      onClick={() => setConfirmingRemovePortId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add Port button with dropdown */}
      <div className="relative">
        <button
          className="w-full px-3 py-2.5 text-sm font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
          onClick={() => setShowAddDropdown(!showAddDropdown)}
        >
          + Add Port
        </button>
        {showAddDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            {portSchemas.map(ps => (
              <button
                key={ps.id}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface transition-colors text-left"
                onClick={() => {
                  onAdd(ps.id);
                  setShowAddDropdown(false);
                }}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: ps.color }}
                />
                <span>{ps.displayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase ml-auto">{ps.polarity}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
