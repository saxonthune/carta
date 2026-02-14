import { useState, useEffect, type ReactNode } from 'react';
import { CaretDown } from '@phosphor-icons/react';

export interface CollapsibleSelectorItem {
  id: string;
}

interface CollapsibleSelectorProps<T extends { id: string }> {
  title: string;
  items: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  renderSelectedSummary?: (item: T) => ReactNode;
  emptyMessage?: string;
  maxExpandedHeight?: number;
}

export default function CollapsibleSelector<T extends { id: string }>({
  title,
  items,
  selectedId,
  onSelect,
  onAdd,
  renderItem,
  renderSelectedSummary,
  emptyMessage = 'No items',
  maxExpandedHeight = 300,
}: CollapsibleSelectorProps<T>) {
  const [isExpanded, setIsExpanded] = useState(true);
  const selectedItem = selectedId ? items.find(item => item.id === selectedId) : null;

  // Auto-collapse when an item is selected
  useEffect(() => {
    if (selectedId) {
      setIsExpanded(false);
    }
  }, [selectedId]);

  // Auto-expand when nothing is selected
  useEffect(() => {
    if (!selectedId) {
      setIsExpanded(true);
    }
  }, [selectedId]);

  const handleItemClick = (id: string) => {
    onSelect(id);
  };

  const handleExpandClick = () => {
    setIsExpanded(true);
  };

  return (
    <div className="flex flex-col bg-surface-depth-1 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-depth-2">
        <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wide m-0">
          {title}
        </h3>
        <button
          className="px-2 py-1 text-xs bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors"
          onClick={onAdd}
        >
          + Add
        </button>
      </div>

      {/* Collapsed: Show selected item summary */}
      {!isExpanded && selectedItem && (
        <button
          className="flex items-center gap-2 px-3 py-2 text-left bg-surface-depth-1 hover:bg-surface-depth-2 cursor-pointer transition-colors border-none w-full"
          onClick={handleExpandClick}
        >
          <div className="flex-1 min-w-0">
            {renderSelectedSummary ? renderSelectedSummary(selectedItem) : (
              <span className="text-sm text-content truncate block">
                {String(selectedItem.id)}
              </span>
            )}
          </div>
          <CaretDown weight="bold" size={16} className="text-content-muted shrink-0" />
        </button>
      )}

      {/* Expanded: Show full list */}
      {isExpanded && (
        <div
          className="overflow-y-auto"
          style={{ maxHeight: maxExpandedHeight }}
        >
          {items.length === 0 ? (
            <p className="px-3 py-4 text-xs text-content-muted italic text-center m-0">
              {emptyMessage}
            </p>
          ) : (
            <div className="p-1.5 flex flex-col gap-0.5">
              {items.map(item => (
                <button
                  key={item.id}
                  className={`w-full text-left rounded-lg cursor-pointer transition-all border-none ${
                    selectedId === item.id
                      ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                      : 'bg-transparent text-content hover:bg-surface-depth-2'
                  }`}
                  onClick={() => handleItemClick(item.id)}
                >
                  {renderItem(item, selectedId === item.id)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed with no selection */}
      {!isExpanded && !selectedItem && (
        <button
          className="flex items-center gap-2 px-3 py-2 text-left bg-surface-depth-1 hover:bg-surface-depth-2 cursor-pointer transition-colors border-none w-full"
          onClick={handleExpandClick}
        >
          <span className="text-xs text-content-muted italic flex-1">
            None selected
          </span>
          <CaretDown weight="bold" size={16} className="text-content-muted shrink-0" />
        </button>
      )}
    </div>
  );
}
