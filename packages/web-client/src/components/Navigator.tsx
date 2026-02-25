import { useState, useRef, useEffect, useCallback } from 'react';
import { DndContext, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVertical, DotsThreeVertical, CaretDown, Plus } from '@phosphor-icons/react';
import type { Page } from '@carta/domain';
import PopoverMenu, { type PopoverMenuItem } from './ui/PopoverMenu';

type ActiveView =
  | { type: 'page'; pageId: string }
  | { type: 'metamap' }
  | { type: 'resource'; resourceId: string };

interface NavigatorProps {
  isOpen: boolean;
  // Pages
  pages: Page[];
  onSetActivePage: (pageId: string) => void;
  onCreatePage: (name: string) => void;
  onDeletePage: (pageId: string) => boolean;
  onUpdatePage: (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges'>>) => void;
  onDuplicatePage: (pageId: string, newName: string) => void;
  // Resources
  resources: Array<{ id: string; name: string; format: string; currentHash: string; versionCount: number }>;
  onSelectResource: (resourceId: string) => void;
  onCreateResource: () => void;
  // View state
  activeView: ActiveView;
  onSelectMetamap: () => void;
}

interface PageRowProps {
  page: Page;
  isActive: boolean;
  editMode: boolean;
  isEditing: boolean;
  editName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  pagesCount: number;
  onSelect: (pageId: string) => void;
  onStartRename: (page: Page) => void;
  onFinishEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (value: string) => void;
  onDuplicate: (page: Page) => void;
  onDelete: (pageId: string) => void;
}

function PageRow({
  page,
  isActive,
  editMode,
  isEditing,
  editName,
  editInputRef,
  pagesCount,
  onSelect,
  onStartRename,
  onFinishEdit,
  onCancelEdit,
  onEditNameChange,
  onDuplicate,
  onDelete,
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

  const menuItems: PopoverMenuItem[] = [
    {
      key: 'rename',
      label: 'Rename',
      onClick: () => onStartRename(page),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      onClick: () => onDuplicate(page),
    },
  ];

  if (pagesCount > 1) {
    menuItems.push({
      key: 'delete',
      label: 'Delete',
      onClick: () => onDelete(page.id),
      danger: true,
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`navigator-page-${page.id}`}
      className={`flex items-center gap-2 pr-2 min-h-[36px] cursor-pointer hover:bg-surface-alt group transition-colors ${isDragging ? 'shadow-lg' : ''}`}
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

      {!editMode && !isEditing && (
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
    <div className="flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          className="flex items-center gap-1 flex-1 text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide hover:text-content transition-colors"
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
  resources,
  onSelectResource,
  onCreateResource,
  activeView,
  onSelectMetamap,
}: NavigatorProps) {
  const [editMode, setEditMode] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const editInputRef = useRef<HTMLInputElement>(null);
  const editFocusCounter = useRef(0);

  // Focus input when editing starts
  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPageId, editFocusCounter.current]);

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

    const sortedPages = [...pages].sort((a, b) => a.order - b.order);
    const oldIndex = sortedPages.findIndex(l => l.id === active.id);
    const newIndex = sortedPages.findIndex(l => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedPages, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].order !== i) {
        onUpdatePage(reordered[i].id, { order: i });
      }
    }
  }, [pages, onUpdatePage]);

  if (!isOpen) return null;

  const sortedPages = [...pages].sort((a, b) => a.order - b.order);
  const pageIds = sortedPages.map(l => l.id);
  const isMetamapActive = activeView.type === 'metamap';

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

  return (
    <div
      data-testid="navigator-panel"
      className="h-full bg-surface-depth-1 border-r border-border flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ width: 256 }}
    >
      <div className="flex flex-col gap-2 p-2 pt-3">
        {/* Pages section */}
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
                    pagesCount={pages.length}
                    onSelect={(pageId) => { onSetActivePage(pageId); }}
                    onStartRename={handleStartRename}
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
            sortedPages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                isActive={activeView.type === 'page' && activeView.pageId === page.id}
                editMode={false}
                isEditing={editingPageId === page.id}
                editName={editName}
                editInputRef={editInputRef}
                pagesCount={pages.length}
                onSelect={(pageId) => { onSetActivePage(pageId); }}
                onStartRename={handleStartRename}
                onFinishEdit={handleFinishEdit}
                onCancelEdit={handleCancelEdit}
                onEditNameChange={setEditName}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))
          )}
        </Section>

        {/* Metamap section */}
        <Section title="Metamap">
          <div
            data-testid="navigator-metamap"
            className={`flex items-center min-h-[36px] cursor-pointer hover:bg-surface-alt group transition-colors`}
            onClick={onSelectMetamap}
          >
            <div className={`w-[3px] self-stretch rounded-r flex-shrink-0 ${isMetamapActive ? 'bg-accent' : ''}`} />
            <span className="flex-1 text-sm truncate text-content px-2">Metamap</span>
          </div>
        </Section>

        {/* Resources section */}
        <Section
          title="Resources"
          onAdd={onCreateResource}
          addLabel="New resource"
        >
          {resources.length === 0 ? (
            <div className="px-3 py-2 text-xs text-content-muted italic">
              No resources yet.
            </div>
          ) : (
            resources.map((r) => {
              const isActive = activeView.type === 'resource' && activeView.resourceId === r.id;
              return (
                <div
                  key={r.id}
                  data-testid={`navigator-resource-${r.id}`}
                  className={`flex items-center min-h-[36px] cursor-pointer hover:bg-surface-alt group transition-colors`}
                  onClick={() => onSelectResource(r.id)}
                >
                  <div className={`w-[3px] self-stretch rounded-r flex-shrink-0 ${isActive ? 'bg-accent' : ''}`} />
                  <div className="flex-1 flex items-center gap-2 px-2 min-w-0">
                    <span className="text-sm font-medium text-content truncate flex-1">{r.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted flex-shrink-0">{r.format}</span>
                  </div>
                </div>
              );
            })
          )}
        </Section>
      </div>
    </div>
  );
}
