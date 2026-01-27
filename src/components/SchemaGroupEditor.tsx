import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useDocument } from '../hooks/useDocument';
import SchemaGroupDetailsEditor from './SchemaGroupDetailsEditor';
import { useDirtyStateGuard } from '../hooks/useDirtyStateGuard';
import ConfirmationModal from './ui/ConfirmationModal';
import CollapsibleSelector from './ui/CollapsibleSelector';
import type { SchemaGroup } from '../constructs/types';

// Get the depth of a group in the hierarchy
function getDepth(groupId: string, groups: SchemaGroup[]): number {
  const group = groups.find(g => g.id === groupId);
  if (!group || !group.parentId) return 0;
  return 1 + getDepth(group.parentId, groups);
}

// Sort groups by hierarchy (parents before children, then by name)
function sortGroupsByHierarchy(groups: SchemaGroup[]): SchemaGroup[] {
  const sorted: SchemaGroup[] = [];
  const visited = new Set<string>();

  const addGroupAndChildren = (groupId: string | undefined) => {
    const groupsAtLevel = groups.filter(g => g.parentId === groupId && !visited.has(g.id));
    groupsAtLevel.sort((a, b) => a.name.localeCompare(b.name));

    for (const group of groupsAtLevel) {
      visited.add(group.id);
      sorted.push(group);
      addGroupAndChildren(group.id);
    }
  };

  addGroupAndChildren(undefined);
  return sorted;
}

interface SchemaGroupEditorProps {
  onBack?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const SchemaGroupEditor = forwardRef<{ save: () => void }, SchemaGroupEditorProps>(
  function SchemaGroupEditor({ onBack, onDirtyChange }, ref) {
  const { schemaGroups, addSchemaGroup, updateSchemaGroup, removeSchemaGroup } = useDocument();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [groups, setGroups] = useState<SchemaGroup[]>(() => schemaGroups);
  const detailsEditorRef = useRef<{ save: () => void } | null>(null);

  const refreshGroups = useCallback(() => {
    setGroups(schemaGroups);
  }, [schemaGroups]);

  const handleDetailsEditorSave = useCallback(() => {
    detailsEditorRef.current?.save();
  }, []);

  const handleSwitch = useCallback((pending: string) => {
    if (pending === '__new__') {
      setSelectedId(null);
      setIsCreatingNew(true);
    } else {
      setSelectedId(pending);
      setIsCreatingNew(false);
    }
  }, []);

  const {
    isDirty,
    setIsDirty,
    showConfirmModal,
    guardedSelect,
    confirmSave,
    confirmDiscard,
    confirmCancel,
  } = useDirtyStateGuard<string>({
    onSave: handleDetailsEditorSave,
    onSwitch: handleSwitch,
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useImperativeHandle(ref, () => ({
    save: () => {
      detailsEditorRef.current?.save();
    }
  }), []);

  const selectedGroup = selectedId ? groups.find(g => g.id === selectedId) : null;

  const handleSelectGroup = (id: string) => {
    guardedSelect(id);
  };

  const handleAddNew = () => {
    guardedSelect('__new__');
  };

  const handleSaveGroup = useCallback((group: SchemaGroup, isNew: boolean) => {
    if (isNew) {
      addSchemaGroup({ name: group.name, parentId: group.parentId, color: group.color, description: group.description });
    } else {
      updateSchemaGroup(group.id, group);
    }
    refreshGroups();
    setSelectedId(group.id);
    setIsCreatingNew(false);
  }, [refreshGroups, addSchemaGroup, updateSchemaGroup]);

  const handleDeleteGroup = useCallback((id: string) => {
    removeSchemaGroup(id);
    refreshGroups();
    setSelectedId(null);
  }, [refreshGroups, removeSchemaGroup]);

  useEffect(() => {
    setGroups(schemaGroups);
  }, [schemaGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId && !isCreatingNew && !isDirty) {
        const group = groups.find(g => g.id === selectedId);
        if (group && window.confirm(`Are you sure you want to delete "${group.name}"? This cannot be undone.`)) {
          handleDeleteGroup(selectedId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, isCreatingNew, isDirty, handleDeleteGroup, groups]);

  const isFullScreen = !!onBack;
  const sortedGroups = sortGroupsByHierarchy(groups);

  // Sidebar layout (drawer mode)
  if (!isFullScreen) {
    return (
      <div className="flex flex-col h-full bg-surface-depth-3 text-content gap-3">
        {/* Collapsible list */}
        <CollapsibleSelector<SchemaGroup>
          title="Schema Groups"
          items={sortedGroups}
          selectedId={selectedId}
          onSelect={handleSelectGroup}
          onAdd={handleAddNew}
          emptyMessage="No schema groups"
          renderItem={(item) => {
            const depth = getDepth(item.id, groups);
            return (
              <div className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: `calc(0.5rem + ${depth * 12}px)` }}>
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs truncate">{item.name}</span>
              </div>
            );
          }}
          renderSelectedSummary={(item) => (
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs truncate">{item.name}</span>
            </div>
          )}
        />

        {/* Details editor */}
        <div className="flex-1 overflow-y-auto bg-surface-depth-2 rounded-lg">
          {isCreatingNew ? (
            <SchemaGroupDetailsEditor
              ref={detailsEditorRef}
              schemaGroup={null}
              isNew={true}
              onSave={handleSaveGroup}
              onDelete={() => {}}
              onDirtyChange={setIsDirty}
              compact
            />
          ) : selectedGroup ? (
            <SchemaGroupDetailsEditor
              ref={detailsEditorRef}
              schemaGroup={selectedGroup}
              isNew={false}
              onSave={handleSaveGroup}
              onDelete={handleDeleteGroup}
              onDirtyChange={setIsDirty}
              compact
            />
          ) : (
            <div className="flex items-center justify-center h-full text-content-muted text-xs p-4">
              <p>Select a group to edit</p>
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={showConfirmModal}
          message="You have unsaved changes. Discard?"
          onCancel={confirmCancel}
          onDiscard={confirmDiscard}
          onSave={confirmSave}
        />
      </div>
    );
  }

  // Full-screen layout
  return (
    <div className="flex flex-col bg-surface-depth-3 text-content w-screen h-screen">
      <div className="flex items-center px-5 py-3 bg-surface-elevated border-b gap-4">
        <button
          className="flex items-center gap-2 px-4 py-2 bg-transparent rounded-md text-content cursor-pointer text-sm hover:bg-surface-alt transition-all"
          onClick={onBack}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Map
        </button>
        <h1 className="text-xl font-semibold text-content m-0">Schema Group Editor</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] bg-surface-depth-1 flex flex-col">
          <div className="flex justify-between items-center p-4">
            <h2 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Schema Groups</h2>
            <button
              className="px-3 py-1.5 text-sm bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors"
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {sortedGroups.length === 0 ? (
              <p className="px-2 text-sm text-content-muted italic">No schema groups available</p>
            ) : (
              <div className="bg-surface-depth-2 rounded-xl p-2">
                {sortedGroups.map(group => {
                  const depth = getDepth(group.id, groups);
                  const paddingLeft = depth * 12;

                  return (
                    <button
                      key={group.id}
                      className={`flex items-center w-full rounded-lg cursor-pointer text-left gap-2 transition-all px-3 py-2.5 text-sm ${
                        selectedId === group.id
                          ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                          : 'text-content bg-transparent hover:bg-surface-depth-3/50'
                      }`}
                      style={{ paddingLeft: `calc(0.75rem + ${paddingLeft}px)` }}
                      onClick={() => handleSelectGroup(group.id)}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="flex-1 truncate">{group.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-surface-depth-3 p-6">
          {isCreatingNew ? (
            <SchemaGroupDetailsEditor
              ref={detailsEditorRef}
              schemaGroup={null}
              isNew={true}
              onSave={handleSaveGroup}
              onDelete={() => {}}
              onDirtyChange={setIsDirty}
            />
          ) : selectedGroup ? (
            <SchemaGroupDetailsEditor
              ref={detailsEditorRef}
              schemaGroup={selectedGroup}
              isNew={false}
              onSave={handleSaveGroup}
              onDelete={handleDeleteGroup}
              onDirtyChange={setIsDirty}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-content-muted text-[15px]">
              <p>Select a schema group to view or edit, or click "Add New" to create one.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        message="You have unsaved changes. Discard?"
        onCancel={confirmCancel}
        onDiscard={confirmDiscard}
        onSave={confirmSave}
      />
    </div>
  );
  }
);

SchemaGroupEditor.displayName = 'SchemaGroupEditor';

export default SchemaGroupEditor;
