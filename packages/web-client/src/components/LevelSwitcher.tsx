import { useState, useRef, useEffect, useCallback } from 'react';
import { DndContext, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Level } from '@carta/domain';

interface LevelSwitcherProps {
  levels: Level[];
  activeLevel: string | undefined;
  onSetActiveLevel: (levelId: string) => void;
  onCreateLevel: (name: string) => void;
  onDeleteLevel: (levelId: string) => boolean;
  onUpdateLevel: (levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges' | 'deployables'>>) => void;
  onDuplicateLevel: (levelId: string, newName: string) => void;
}

interface SortableLevelRowProps {
  level: Level;
  isActive: boolean;
  editMode: boolean;
  isEditing: boolean;
  editName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  levelsCount: number;
  onSelect: (levelId: string) => void;
  onStartEdit: (level: Level) => void;
  onFinishEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (value: string) => void;
  onDuplicate: (level: Level, event: React.MouseEvent) => void;
  onDelete: (levelId: string, event: React.MouseEvent) => void;
}

function SortableLevelRow({
  level,
  isActive,
  editMode,
  isEditing,
  editName,
  editInputRef,
  levelsCount,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onEditNameChange,
  onDuplicate,
  onDelete,
}: SortableLevelRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleClick = () => {
    if (editMode) {
      // In edit mode, clicking the row always starts inline edit
      onStartEdit(level);
    } else {
      onSelect(level.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
        isActive
          ? 'bg-accent text-white'
          : 'text-content hover:bg-surface-alt'
      } ${isDragging ? 'shadow-lg' : ''}`}
      onClick={handleClick}
    >
      {editMode && (
        <div
          className={`cursor-grab active:cursor-grabbing flex-shrink-0 ${isActive ? 'text-white/70' : 'text-content-muted'}`}
          {...attributes}
          {...listeners}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
      )}
      {isEditing ? (
        <input
          ref={editInputRef}
          className="flex-1 px-1 py-0 text-sm bg-transparent border-b border-current outline-none text-inherit"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onBlur={onFinishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEdit();
            if (e.key === 'Escape') onCancelEdit();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span
            className="flex-1 text-sm truncate"
            onDoubleClick={() => {
              if (!editMode) onStartEdit(level);
            }}
          >
            {level.name}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className={`p-0.5 rounded hover:bg-black/10 ${isActive ? 'text-white/70 hover:text-white' : 'text-content-muted hover:text-content'}`}
              onClick={(e) => onDuplicate(level, e)}
              title="Duplicate level"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            {levelsCount > 1 && (
              <button
                className={`p-0.5 rounded hover:bg-black/10 ${isActive ? 'text-white/70 hover:text-white' : 'text-content-muted hover:text-content'}`}
                onClick={(e) => onDelete(level.id, e)}
                title="Delete level"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function LevelSwitcher({
  levels,
  activeLevel,
  onSetActiveLevel,
  onCreateLevel,
  onDeleteLevel,
  onUpdateLevel,
  onDuplicateLevel,
}: LevelSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  // Counter to force re-focus when clicking the same level again
  const editFocusCounter = useRef(0);

  const currentLevel = levels.find(l => l.id === activeLevel);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditingLevelId(null);
        setEditMode(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when editing — uses a counter so re-clicking the same level re-focuses
  useEffect(() => {
    if (editingLevelId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLevelId, editFocusCounter.current]);

  // Reset edit mode when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setEditingLevelId(null);
    }
  }, [isOpen]);

  const handleStartEdit = useCallback((level: Level) => {
    // Always set both — even if same level, bump counter to re-trigger focus
    setEditingLevelId(level.id);
    setEditName(level.name);
    editFocusCounter.current += 1;
  }, []);

  const handleFinishEdit = useCallback(() => {
    if (editingLevelId && editName.trim()) {
      onUpdateLevel(editingLevelId, { name: editName.trim() });
    }
    setEditingLevelId(null);
  }, [editingLevelId, editName, onUpdateLevel]);

  const handleCancelEdit = useCallback(() => {
    setEditingLevelId(null);
  }, []);

  const handleDelete = useCallback((levelId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const level = levels.find(l => l.id === levelId);
    const hasContent = (level?.nodes as unknown[])?.length > 0;
    if (hasContent) {
      const confirmed = window.confirm(`Delete level "${level?.name}"? This level has content that will be lost.`);
      if (!confirmed) return;
    }
    onDeleteLevel(levelId);
  }, [levels, onDeleteLevel]);

  const handleDuplicate = useCallback((level: Level, event: React.MouseEvent) => {
    event.stopPropagation();
    onDuplicateLevel(level.id, `${level.name} (copy)`);
  }, [onDuplicateLevel]);

  const handleCreateLevel = useCallback(() => {
    onCreateLevel(`Level ${levels.length + 1}`);
    setIsOpen(false);
  }, [levels.length, onCreateLevel]);

  const handleSelectLevel = useCallback((levelId: string) => {
    onSetActiveLevel(levelId);
    setIsOpen(false);
  }, [onSetActiveLevel]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sortedLevels = [...levels].sort((a, b) => a.order - b.order);
    const oldIndex = sortedLevels.findIndex(l => l.id === active.id);
    const newIndex = sortedLevels.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedLevels, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].order !== i) {
        onUpdateLevel(reordered[i].id, { order: i });
      }
    }
  }, [levels, onUpdateLevel]);

  const sortedLevels = [...levels].sort((a, b) => a.order - b.order);
  const levelIds = sortedLevels.map(l => l.id);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-0.5">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          title="Switch level"
        >
          <svg className="w-3.5 h-3.5 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="max-w-[120px] truncate">{currentLevel?.name || 'Main'}</span>
          <svg className={`w-3 h-3 text-content-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {isOpen && (
          <button
            className={`p-1.5 rounded-lg border transition-colors ${editMode ? 'bg-accent text-white border-accent' : 'bg-surface text-content-muted border-border hover:text-content hover:bg-surface-alt'}`}
            onClick={() => {
              setEditMode(!editMode);
              setEditingLevelId(null);
            }}
            title={editMode ? 'Exit edit mode' : 'Edit levels'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[260px]">
          {/* Level rows */}
          {editMode ? (
            <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
              <SortableContext items={levelIds} strategy={verticalListSortingStrategy}>
                {sortedLevels.map((level) => (
                  <SortableLevelRow
                    key={level.id}
                    level={level}
                    isActive={level.id === activeLevel}
                    editMode={editMode}
                    isEditing={editingLevelId === level.id}
                    editName={editName}
                    editInputRef={editInputRef}
                    levelsCount={levels.length}
                    onSelect={handleSelectLevel}
                    onStartEdit={handleStartEdit}
                    onFinishEdit={handleFinishEdit}
                    onCancelEdit={handleCancelEdit}
                    onEditNameChange={setEditName}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            sortedLevels.map((level) => (
              <SortableLevelRow
                key={level.id}
                level={level}
                isActive={level.id === activeLevel}
                editMode={false}
                isEditing={editingLevelId === level.id}
                editName={editName}
                editInputRef={editInputRef}
                levelsCount={levels.length}
                onSelect={handleSelectLevel}
                onStartEdit={handleStartEdit}
                onFinishEdit={handleFinishEdit}
                onCancelEdit={handleCancelEdit}
                onEditNameChange={setEditName}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))
          )}

          <div className="border-t border-subtle">
            <button
              className="w-full text-left px-3 py-2 text-sm cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors border-none bg-surface"
              onClick={handleCreateLevel}
            >
              + New Level
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
