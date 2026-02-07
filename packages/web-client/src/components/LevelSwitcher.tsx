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
    if (!editMode) {
      onSelect(level.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 pr-3 py-2 cursor-pointer transition-colors group text-content hover:bg-surface-alt ${isDragging ? 'shadow-lg' : ''}`}
      onClick={handleClick}
    >
      {/* Active level indicator bar */}
      <div className={`w-[3px] self-stretch rounded-r flex-shrink-0 ${isActive ? 'bg-accent' : ''}`} />
      {editMode && (
        <div
          className="cursor-grab active:cursor-grabbing flex-shrink-0 text-content-muted"
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
        <div className="flex-1 rounded px-1.5 py-0.5 -my-0.5 bg-surface-alt ring-1 ring-border">
          <input
            ref={editInputRef}
            className="w-full py-0 text-sm bg-transparent border-none outline-none text-inherit"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onBlur={onFinishEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onFinishEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <span className="flex-1 text-sm truncate">
          {level.name}
        </span>
      )}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {!isEditing && (
          <button
            className="p-0.5 rounded hover:bg-black/10 text-content-muted hover:text-content"
            onClick={(e) => { e.stopPropagation(); onStartEdit(level); }}
            title="Rename level"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
        )}
        <button
          className="p-0.5 rounded hover:bg-black/10 text-content-muted hover:text-content"
          onMouseDown={(e) => { if (isEditing) e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); if (isEditing) onFinishEdit(); onDuplicate(level, e); }}
          title="Duplicate level"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        {levelsCount > 1 && (
          <button
            className="p-0.5 rounded hover:bg-black/10 text-content-muted hover:text-content"
            onMouseDown={(e) => { if (isEditing) e.preventDefault(); }}
            onClick={(e) => { e.stopPropagation(); if (isEditing) onFinishEdit(); onDelete(level.id, e); }}
            title="Delete level"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
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
  // Inline rename of the current level (in the trigger bar, outside the dropdown)
  const [isRenamingCurrent, setIsRenamingCurrent] = useState(false);
  const [currentEditName, setCurrentEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const currentEditInputRef = useRef<HTMLInputElement>(null);
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

  // Focus input when editing in dropdown — uses a counter so re-clicking the same level re-focuses
  useEffect(() => {
    if (editingLevelId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLevelId, editFocusCounter.current]);

  // Focus input when renaming current level in the trigger bar
  useEffect(() => {
    if (isRenamingCurrent && currentEditInputRef.current) {
      currentEditInputRef.current.focus();
      currentEditInputRef.current.select();
    }
  }, [isRenamingCurrent]);

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

  // Current level inline rename handlers
  const handleStartCurrentRename = useCallback(() => {
    if (!currentLevel) return;
    setCurrentEditName(currentLevel.name);
    setIsRenamingCurrent(true);
    // Close the dropdown if open — renaming is separate from selecting
    setIsOpen(false);
  }, [currentLevel]);

  const handleFinishCurrentRename = useCallback(() => {
    if (activeLevel && currentEditName.trim()) {
      onUpdateLevel(activeLevel, { name: currentEditName.trim() });
    }
    setIsRenamingCurrent(false);
  }, [activeLevel, currentEditName, onUpdateLevel]);

  const handleCancelCurrentRename = useCallback(() => {
    setIsRenamingCurrent(false);
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
        {/* Part 1: Current level info — click name to rename inline */}
        <div className="flex items-center gap-1.5 pl-3 pr-1 py-1.5 text-sm font-medium bg-surface text-content border border-border rounded-lg">
          <svg className="w-3.5 h-3.5 text-content-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <div className={`w-[120px] rounded px-1.5 py-0.5 -my-0.5 transition-colors ${isRenamingCurrent ? 'bg-surface-alt ring-1 ring-border' : ''}`}>
            {isRenamingCurrent ? (
              <input
                ref={currentEditInputRef}
                className="w-full py-0 text-sm font-medium bg-transparent border-none outline-none text-inherit"
                value={currentEditName}
                onChange={(e) => setCurrentEditName(e.target.value)}
                onBlur={handleFinishCurrentRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishCurrentRename();
                  if (e.key === 'Escape') handleCancelCurrentRename();
                }}
              />
            ) : (
              <span
                className="block w-full truncate cursor-text"
                onClick={handleStartCurrentRename}
                title="Click to rename"
              >
                {currentLevel?.name || 'Main'}
              </span>
            )}
          </div>
          {/* Part 2: Trigger to open the level selector */}
          <button
            className="flex items-center justify-center w-6 h-6 rounded cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            title="Switch level"
          >
            <svg className={`w-4 h-4 text-content-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
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

      {/* Level selector dropdown */}
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
