import { useState, useRef, useEffect, useCallback } from 'react';
import { DndContext, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVertical, DotsThreeVertical, CaretDown, Plus, DiamondsFour } from '@phosphor-icons/react';
import type { Page, GroupMeta } from '@carta/schema';
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
  // Groups
  groupMetadata: Record<string, GroupMeta>;
  onSetGroupMetadata: (key: string, meta: GroupMeta) => void;
  onDeleteGroup: (key: string) => void;
  onSetPageGroup: (pageId: string, groupKey: string | null) => void;
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 px-3 py-1 cursor-pointer rounded-lg text-sm transition-colors ${
        isActive ? 'bg-accent text-white' : 'text-content hover:bg-surface-alt'
      }`}
      onClick={() => !isEditing && onSelect(page.id)}
    >
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-content-muted hover:text-content"
          title="Drag to reorder"
        >
          <DotsSixVertical weight="bold" size={12} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={editInputRef}
            className="w-full py-0 text-sm bg-transparent border-none outline-none text-content"
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
          <span className="truncate block">{page.name}</span>
        )}
      </div>
      {!editMode && !isEditing && (
        <PopoverMenu
          items={menuItems}
          trigger={
            <button
              className={`w-5 h-5 flex-shrink-0 items-center justify-center rounded transition-colors ${
                isActive
                  ? 'flex text-white/60 hover:text-white hover:bg-white/10'
                  : 'hidden group-hover:flex text-content-muted hover:bg-surface-alt hover:text-content'
              }`}
              title="Page actions"
              onClick={(e) => e.stopPropagation()}
            >
              <DotsThreeVertical weight="bold" size={14} />
            </button>
          }
        />
      )}
    </div>
  );
}

function Section({ title, children, onAdd, addLabel, extraActions }: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-0.5">
          {extraActions}
          {onAdd && (
            <button
              className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
              onClick={onAdd}
              title={addLabel ?? 'Add'}
            >
              <Plus weight="bold" size={12} />
            </button>
          )}
        </div>
      </div>
      {children}
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
  groupMetadata,
  onSetGroupMetadata,
  onDeleteGroup,
  onSetPageGroup,
}: NavigatorProps) {
  const [editMode, setEditMode] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

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
    if (editingGroupKey && groupEditInputRef.current) {
      groupEditInputRef.current.focus();
      groupEditInputRef.current.select();
    }
  }, [editingGroupKey]);

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

  // Derive group keys from groupMetadata, sorted lexicographically
  const sortedGroupKeys = Object.keys(groupMetadata).sort();
  const hasGroups = sortedGroupKeys.length > 0;

  const handleCreateGroup = useCallback(() => {
    // Auto-generate key as {nn}-{slug}
    let maxOrder = -1;
    for (const key of Object.keys(groupMetadata)) {
      const num = parseInt(key.split('-')[0], 10);
      if (!isNaN(num) && num > maxOrder) maxOrder = num;
    }
    const nn = String(maxOrder + 1).padStart(2, '0');
    const name = `Group ${maxOrder + 2}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const key = `${nn}-${slug}`;
    onSetGroupMetadata(key, { name });
  }, [groupMetadata, onSetGroupMetadata]);

  const handleStartGroupRename = useCallback((key: string) => {
    setEditingGroupKey(key);
    setEditGroupName(groupMetadata[key]?.name ?? key);
  }, [groupMetadata]);

  const handleFinishGroupRename = useCallback(() => {
    if (editingGroupKey && editGroupName.trim()) {
      const existing = groupMetadata[editingGroupKey];
      onSetGroupMetadata(editingGroupKey, { ...existing, name: editGroupName.trim() });
    }
    setEditingGroupKey(null);
  }, [editingGroupKey, editGroupName, groupMetadata, onSetGroupMetadata]);

  const handleCancelGroupRename = useCallback(() => {
    setEditingGroupKey(null);
  }, []);

  const handleDeleteGroup = useCallback((key: string) => {
    // Remove group from all pages that reference it
    for (const page of pages) {
      if (page.group === key) {
        onSetPageGroup(page.id, null);
      }
    }
    onDeleteGroup(key);
  }, [pages, onDeleteGroup, onSetPageGroup]);

  const toggleGroupCollapsed = useCallback((key: string) => {
    setCollapsedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  const sortedPages = [...pages].sort((a, b) => a.order - b.order);
  const pageIds = sortedPages.map(l => l.id);
  const isMetamapActive = activeView.type === 'metamap';

  // Derive grouped and ungrouped pages
  const groupedPages = new Map<string, Page[]>();
  for (const key of sortedGroupKeys) {
    groupedPages.set(key, []);
  }
  const ungroupedPages: Page[] = [];
  for (const page of sortedPages) {
    if (page.group && groupedPages.has(page.group)) {
      groupedPages.get(page.group)!.push(page);
    } else {
      ungroupedPages.push(page);
    }
  }

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
      for (const key of sortedGroupKeys) {
        const name = groupMetadata[key]?.name ?? key;
        items.push({ key: `move-to-${key}`, label: `Move to ${name}`, onClick: () => onSetPageGroup(page.id, key) });
      }
    }
    return items;
  }

  // Menu items for a page that is already inside a specific group
  function groupedPageMenuItems(page: Page, currentGroupKey: string): PopoverMenuItem[] {
    const items: PopoverMenuItem[] = [
      { key: 'rename', label: 'Rename', onClick: () => handleStartRename(page) },
      { key: 'duplicate', label: 'Duplicate', onClick: () => handleDuplicate(page) },
    ];
    if (pages.length > 1) {
      items.push({ key: 'delete', label: 'Delete', onClick: () => handleDelete(page.id), danger: true });
    }
    for (const key of sortedGroupKeys) {
      if (key !== currentGroupKey) {
        const name = groupMetadata[key]?.name ?? key;
        items.push({ key: `move-to-${key}`, label: `Move to ${name}`, onClick: () => onSetPageGroup(page.id, key) });
      }
    }
    items.push({ key: 'remove-from-group', label: 'Remove from group', onClick: () => onSetPageGroup(page.id, null) });
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
            {sortedGroupKeys.map(key => {
              const meta = groupMetadata[key];
              const isGroupCollapsed = collapsedGroupKeys.has(key);
              const pagesInGroup = groupedPages.get(key) ?? [];
              return (
                <div key={key} className="bg-surface-depth-2 rounded-xl flex flex-col overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-1 px-3 py-1.5">
                    <button
                      className="flex items-center gap-1 flex-1 text-left text-sm font-medium text-content-muted hover:text-content transition-colors min-w-0"
                      onClick={() => toggleGroupCollapsed(key)}
                    >
                      <CaretDown
                        weight="bold"
                        size={10}
                        className={`flex-shrink-0 transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`}
                      />
                      {editingGroupKey === key ? (
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
                        <span className="truncate">{meta?.name ?? key}</span>
                      )}
                    </button>
                    <PopoverMenu
                      items={[
                        { key: 'rename', label: 'Rename', onClick: () => handleStartGroupRename(key) },
                        { key: 'delete', label: 'Delete group', onClick: () => handleDeleteGroup(key), danger: true },
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
                      {pagesInGroup.map(page => (
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
                          menuItems={groupedPageMenuItems(page, key)}
                        />
                      ))}
                      {pagesInGroup.length === 0 && (
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
