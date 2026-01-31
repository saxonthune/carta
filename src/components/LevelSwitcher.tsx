import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const currentLevel = levels.find(l => l.id === activeLevel);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditingLevelId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when editing
  useEffect(() => {
    if (editingLevelId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingLevelId]);

  const handleStartEdit = useCallback((level: Level, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingLevelId(level.id);
    setEditName(level.name);
  }, []);

  const handleFinishEdit = useCallback(() => {
    if (editingLevelId && editName.trim()) {
      onUpdateLevel(editingLevelId, { name: editName.trim() });
    }
    setEditingLevelId(null);
  }, [editingLevelId, editName, onUpdateLevel]);

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

  return (
    <div className="relative" ref={dropdownRef}>
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
        <svg className="w-3 h-3 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
          {levels.map((level) => (
            <div
              key={level.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
                level.id === activeLevel
                  ? 'bg-accent text-white'
                  : 'text-content hover:bg-surface-alt'
              }`}
              onClick={() => handleSelectLevel(level.id)}
            >
              {editingLevelId === level.id ? (
                <input
                  ref={editInputRef}
                  className="flex-1 px-1 py-0 text-sm bg-transparent border-b border-current outline-none text-inherit"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleFinishEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishEdit();
                    if (e.key === 'Escape') setEditingLevelId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="flex-1 text-sm truncate" onDoubleClick={(e) => handleStartEdit(level, e as unknown as React.MouseEvent)}>
                    {level.name}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className={`p-0.5 rounded hover:bg-black/10 ${level.id === activeLevel ? 'text-white/70 hover:text-white' : 'text-content-muted hover:text-content'}`}
                      onClick={(e) => handleDuplicate(level, e)}
                      title="Duplicate level"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                    {levels.length > 1 && (
                      <button
                        className={`p-0.5 rounded hover:bg-black/10 ${level.id === activeLevel ? 'text-white/70 hover:text-white' : 'text-content-muted hover:text-content'}`}
                        onClick={(e) => handleDelete(level.id, e)}
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
          ))}
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
