import { useState, useRef, useEffect, useCallback } from 'react';
import { DndContext, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVertical, DotsThreeVertical, CaretDown, Plus, DiamondsFour } from '@phosphor-icons/react';
import type { Page, SpecGroup, SpecGroupItem } from '@carta/schema';
import PopoverMenu, { type PopoverMenuItem } from './ui/PopoverMenu';

type ActiveView =
  | { type: 'page'; pageId: string }
  | { type: 'metamap' };

interface NavigatorProps {
  isOpen: boolean;
  // Pages
  pages: Page[];
  onSetActivePage: (pageId: string) => void;
  onCreatePage: (name: string) => void;
  onDeletePage: (pageId: string) => boolean;
  onUpdatePage: (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges'>>) => void;
  onDuplicatePage: (pageId: string, newName: string) => void;
  // View state
  activeView: ActiveView;
  onSelectMetamap: () => void;
  // Spec Groups
  specGroups: SpecGroup[];
  onCreateSpecGroup: (name: string) => void;
  onUpdateSpecGroup: (id: string, updates: { name?: string; description?: string; order?: number; items?: SpecGroupItem[] }) => void;
  onDeleteSpecGroup: (id: string) => void;
  onAssignToSpecGroup: (groupId: string, item: SpecGroupItem) => void;
  onRemoveFromSpecGroup: (itemType: 'page', itemId: string) => void;
}

interface PageRowProps {
  page: Page;
  isActive: boolean;
  editMode: boolean;
  isEditing: boolean;
  editName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (pageId: string) => void;
  onFinishEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (value: string) => void;
  menuItems: PopoverMenuItem[];
}

function PageRow({
  page,
  isActive,
  editMode,
  isEditing,
  editName,
  editInputRef,
  onSelect,
  onFinishEdit,
  onCancelEdit,
  onEditNameChange,
  menuItems,
}: PageRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleClick = () => {
    if (!editMode && !isEditing) {
      onSelect(page.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`navigator-page-${page.id}`}
      className={`flex items-center gap-2 pr-2 min-h-[36px] cursor-pointer group transition-colors ${isDragging ? 'shadow-lg' : ''} ${isActive ? 'bg-[var(--color-surface-selected)]' : 'hover:bg-surface-alt'}`}
      onClick={handleClick}
    >
      {/* Active page indicator bar */}
      <div className={`w-[3px] self-stretch rounded-r flex-shrink-0 ${isActive ? 'bg-accent' : ''}`} />

      {editMode && (
        <div
          className="cursor-grab active:cursor-grabbing flex-shrink-0 text-content-muted"
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical weight="bold" size={14} />
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
        <span className="flex-1 text-sm truncate text-content">
          {page.name}
        </span>
      )}

      {!editMode && !isEditing && menuItems.length > 0 && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <PopoverMenu
            items={menuItems}
            trigger={
              <button
                className="p-1 rounded hover:bg-black/10 text-content-muted hover:text-content"
                title="Page actions"
              >
                <DotsThreeVertical weight="bold" size={16} />
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
  extraActions?: React.ReactNode;
}

function Section({ title, onAdd, addLabel, children, extraActions }: SectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-surface-depth-2 rounded-xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-1.5">
        <button
          className="flex items-center gap-1 flex-1 text-left text-sm font-medium text-content-muted hover:text-content transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          <CaretDown
            weight="bold"
            size={10}
            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
          {title}
        </button>
        {extraActions}
        {onAdd && (
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
            onClick={onAdd}
            title={addLabel}
          >
            <Plus weight="bold" size={12} />
          </button>
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}

export default function Navigator({
  isOpen,
  pages,
  onSetActivePage,
  onCreatePage,
  onDeletePage,
  onUpdatePage,
  onDuplicatePage,
  activeView,
  onSelectMetamap,
  specGroups,
  onCreateSpecGroup,
  onUpdateSpecGroup,
  onDeleteSpecGroup,
  onAssignToSpecGroup,
  onRemoveFromSpecGroup,
}: NavigatorProps) {
  const [editMode, setEditMode] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  const editInputRef = useRef<HTMLInputElement>(null);
  const editFocusCounter = useRef(0);
  const groupEditInputRef = useRef<HTMLInputElement>(null);

  // Focus page rename input
  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPageId, editFocusCounter.current]);

  // Focus group rename input
  useEffect(() => {
    if (editingGroupId && groupEditInputRef.current) {
      groupEditInputRef.current.focus();
      groupEditInputRef.current.select();
    }
  }, [editingGroupId]);

  const handleStartRename = useCallback((page: Page) => {
    setEditingPageId(page.id);
    setEditName(page.name);
    editFocusCounter.current += 1;
  }, []);

  const handleFinishEdit = useCallback(() => {
    if (editingPageId && editName.trim()) {
      onUpdatePage(editingPageId, { name: editName.trim() });
    }
    setEditingPageId(null);
  }, [editingPageId, editName, onUpdatePage]);

  const handleCancelEdit = useCallback(() => {
    setEditingPageId(null);
  }, []);

  const handleDelete = useCallback((pageId: string) => {
    const page = pages.find(l => l.id === pageId);
    const hasContent = (page?.nodes as unknown[])?.length > 0;
    if (hasContent) {
      const confirmed = window.confirm(`Delete page "${page?.name}"? This page has content that will be lost.`);
      if (!confirmed) return;
    }
    onDeletePage(pageId);
  }, [pages, onDeletePage]);

  const handleDuplicate = useCallback((page: Page) => {
    onDuplicatePage(page.id, `${page.name} (copy)`);
  }, [onDuplicatePage]);

  const handleCreatePage = useCallback(() => {
    onCreatePage(`Page ${pages.length + 1}`);
  }, [pages.length, onCreatePage]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sorted = [...pages].sort((a, b) => a.order - b.order);
    const oldIndex = sorted.findIndex(l => l.id === active.id);
    const newIndex = sorted.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].order !== i) {
        onUpdatePage(reordered[i].id, { order: i });
      }
    }
  }, [pages, onUpdatePage]);

  const handleCreateGroup = useCallback(() => {
    onCreateSpecGroup(`Group ${specGroups.length + 1}`);
  }, [specGroups.length, onCreateSpecGroup]);

  const handleStartGroupRename = useCallback((group: SpecGroup) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
  }, []);

  const handleFinishGroupRename = useCallback(() => {
    if (editingGroupId && editGroupName.trim()) {
      onUpdateSpecGroup(editingGroupId, { name: editGroupName.trim() });
    }
    setEditingGroupId(null);
  }, [editingGroupId, editGroupName, onUpdateSpecGroup]);

  const handleCancelGroupRename = useCallback(() => {
    setEditingGroupId(null);
  }, []);

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  const sortedPages = [...pages].sort((a, b) => a.order - b.order);
  const pageIds = sortedPages.map(l => l.id);
  const isMetamapActive = activeView.type === 'metamap';

  const hasGroups = specGroups.length > 0;
  const sortedGroups = [...specGroups].sort((a, b) => a.order - b.order);
  const groupedPageIds = new Set(sortedGroups.flatMap(g => g.items.filter(i => i.type === 'page').map(i => i.id)));
  const ungroupedPages = sortedPages.filter(p => !groupedPageIds.has(p.id));

  const reorderButton = (
    <button
      className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${editMode ? 'bg-accent text-white' : 'text-content-muted hover:bg-surface-alt hover:text-content'}`}
      onClick={() => {
        setEditMode(!editMode);
        setEditingPageId(null);
      }}
      title={editMode ? 'Exit reorder mode' : 'Reorder pages'}
    >
      <DotsSixVertical weight="bold" size={12} />
    </button>
  );

  // Menu items for a page in the flat/ungrouped section
  function flatPageMenuItems(page: Page): PopoverMenuItem[] {
    const items: PopoverMenuItem[] = [
      { key: 'rename', label: 'Rename', onClick: () => handleStartRename(page) },
      { key: 'duplicate', label: 'Duplicate', onClick: () => handleDuplicate(page) },
    ];
    if (pages.length > 1) {
      items.push({ key: 'delete', label: 'Delete', onClick: () => handleDelete(page.id), danger: true });
    }
    if (hasGroups) {
      for (const group of sortedGroups) {
        items.push({ key: `move-to-${group.id}`, label: `Move to ${group.name}`, onClick: () => onAssignToSpecGroup(group.id, { type: 'page', id: page.id }) });
      }
    }
    return items;
  }

  // Menu items for a page that is already inside a specific group
  function groupedPageMenuItems(page: Page, currentGroupId: string): PopoverMenuItem[] {
    const items: PopoverMenuItem[] = [
      { key: 'rename', label: 'Rename', onClick: () => handleStartRename(page) },
      { key: 'duplicate', label: 'Duplicate', onClick: () => handleDuplicate(page) },
    ];
    if (pages.length > 1) {
      items.push({ key: 'delete', label: 'Delete', onClick: () => handleDelete(page.id), danger: true });
    }
    for (const group of sortedGroups) {
      if (group.id !== currentGroupId) {
        items.push({ key: `move-to-${group.id}`, label: `Move to ${group.name}`, onClick: () => onAssignToSpecGroup(group.id, { type: 'page', id: page.id }) });
      }
    }
    items.push({ key: 'remove-from-group', label: 'Remove from group', onClick: () => onRemoveFromSpecGroup('page', page.id) });
    return items;
  }

  return (
    <div
      data-testid="navigator-panel"
      className="h-full bg-surface-depth-1 border-r border-border flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ width: 256 }}
    >
      <div className="flex flex-col gap-2 p-2 pt-3">
        {/* Metamap view toggle */}
        <div className="flex items-center px-1">
          <button
            data-testid="navigator-metamap"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              isMetamapActive
                ? 'bg-accent text-white'
                : 'text-content-muted hover:bg-surface-alt hover:text-content'
            }`}
            onClick={onSelectMetamap}
            title="Metamap"
          >
            <DiamondsFour weight={isMetamapActive ? 'fill' : 'bold'} size={18} />
          </button>
        </div>

        {hasGroups ? (
          <>
            {/* Group sections */}
            {sortedGroups.map(group => {
              const isGroupCollapsed = collapsedGroupIds.has(group.id);
              return (
                <div key={group.id} className="bg-surface-depth-2 rounded-xl flex flex-col overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-1 px-3 py-1.5">
                    <button
                      className="flex items-center gap-1 flex-1 text-left text-sm font-medium text-content-muted hover:text-content transition-colors min-w-0"
                      onClick={() => toggleGroupCollapsed(group.id)}
                    >
                      <CaretDown
                        weight="bold"
                        size={10}
                        className={`flex-shrink-0 transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`}
                      />
                      {editingGroupId === group.id ? (
                        <input
                          ref={groupEditInputRef}
                          className="flex-1 min-w-0 py-0 text-sm bg-transparent border-none outline-none text-content font-medium"
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          onBlur={handleFinishGroupRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleFinishGroupRename();
                            if (e.key === 'Escape') handleCancelGroupRename();
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate">{group.name}</span>
                      )}
                    </button>
                    <PopoverMenu
                      items={[
                        { key: 'rename', label: 'Rename', onClick: () => handleStartGroupRename(group) },
                        { key: 'delete', label: 'Delete group', onClick: () => onDeleteSpecGroup(group.id), danger: true },
                      ]}
                      trigger={
                        <button
                          className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
                          title="Group actions"
                        >
                          <DotsThreeVertical weight="bold" size={12} />
                        </button>
                      }
                    />
                  </div>

                  {/* Group items */}
                  {!isGroupCollapsed && (
                    <>
                      {group.items.map(item => {
                        if (item.type === 'page') {
                          const page = pages.find(p => p.id === item.id);
                          if (!page) return null;
                          return (
                            <PageRow
                              key={page.id}
                              page={page}
                              isActive={activeView.type === 'page' && activeView.pageId === page.id}
                              editMode={false}
                              isEditing={editingPageId === page.id}
                              editName={editName}
                              editInputRef={editInputRef}
                              onSelect={(pageId) => { onSetActivePage(pageId); }}
                              onFinishEdit={handleFinishEdit}
                              onCancelEdit={handleCancelEdit}
                              onEditNameChange={setEditName}
                              menuItems={groupedPageMenuItems(page, group.id)}
                            />
                          );
                        }
                        return null;
                      })}
                      {group.items.length === 0 && (
                        <div className="px-3 py-2 text-xs text-content-muted italic">
                          Empty group.
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Ungrouped section (only when items exist) */}
            {ungroupedPages.length > 0 && (
              <Section title="Ungrouped" onAdd={handleCreatePage} addLabel="New page">
                {ungroupedPages.map(page => (
                  <PageRow
                    key={page.id}
                    page={page}
                    isActive={activeView.type === 'page' && activeView.pageId === page.id}
                    editMode={false}
                    isEditing={editingPageId === page.id}
                    editName={editName}
                    editInputRef={editInputRef}
                    onSelect={(pageId) => { onSetActivePage(pageId); }}
                    onFinishEdit={handleFinishEdit}
                    onCancelEdit={handleCancelEdit}
                    onEditNameChange={setEditName}
                    menuItems={flatPageMenuItems(page)}
                  />
                ))}
              </Section>
            )}

            {/* New Group button */}
            <button
              className="w-full py-2 text-sm text-content-muted hover:text-content hover:bg-surface-alt rounded-lg transition-colors"
              onClick={handleCreateGroup}
            >
              + New Group
            </button>
          </>
        ) : (
          <>
            {/* Flat layout — no groups */}
            <Section
              title="Pages"
              onAdd={handleCreatePage}
              addLabel="New page"
              extraActions={reorderButton}
            >
              {editMode ? (
                <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
                  <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
                    {sortedPages.map((page) => (
                      <PageRow
                        key={page.id}
                        page={page}
                        isActive={activeView.type === 'page' && activeView.pageId === page.id}
                        editMode={editMode}
                        isEditing={editingPageId === page.id}
                        editName={editName}
                        editInputRef={editInputRef}
                        onSelect={(pageId) => { onSetActivePage(pageId); }}
                        onFinishEdit={handleFinishEdit}
                        onCancelEdit={handleCancelEdit}
                        onEditNameChange={setEditName}
                        menuItems={flatPageMenuItems(page)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                sortedPages.map((page) => (
                  <PageRow
                    key={page.id}
                    page={page}
                    isActive={activeView.type === 'page' && activeView.pageId === page.id}
                    editMode={false}
                    isEditing={editingPageId === page.id}
                    editName={editName}
                    editInputRef={editInputRef}
                    onSelect={(pageId) => { onSetActivePage(pageId); }}
                    onFinishEdit={handleFinishEdit}
                    onCancelEdit={handleCancelEdit}
                    onEditNameChange={setEditName}
                    menuItems={flatPageMenuItems(page)}
                  />
                ))
              )}
            </Section>

            {/* New Group button — always visible so users can bootstrap groups */}
            <button
              className="w-full py-2 text-sm text-content-muted hover:text-content hover:bg-surface-alt rounded-lg transition-colors"
              onClick={handleCreateGroup}
            >
              + New Group
            </button>
          </>
        )}
      </div>
    </div>
  );
}
