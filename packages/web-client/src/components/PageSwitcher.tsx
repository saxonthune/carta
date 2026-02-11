import { useState, useRef, useEffect, useCallback } from 'react';
import { DndContext, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Page } from '@carta/domain';
import PopoverMenu, { type PopoverMenuItem } from './ui/PopoverMenu';

interface PageSwitcherProps {
  pages: Page[];
  activePage: string | undefined;
  onSetActivePage: (pageId: string) => void;
  onCreatePage: (name: string) => void;
  onDeletePage: (pageId: string) => boolean;
  onUpdatePage: (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges' | 'deployables'>>) => void;
  onDuplicatePage: (pageId: string, newName: string) => void;
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
      className={`flex items-center gap-2 pr-2 min-h-[40px] cursor-pointer hover:bg-surface-alt group transition-colors ${isDragging ? 'shadow-lg' : ''}`}
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
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

export default function PageSwitcher({
  pages,
  activePage,
  onSetActivePage,
  onCreatePage,
  onDeletePage,
  onUpdatePage,
  onDuplicatePage,
}: PageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const editFocusCounter = useRef(0);

  const currentPage = pages.find(l => l.id === activePage);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditingPageId(null);
        setEditMode(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when editing in dropdown
  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPageId, editFocusCounter.current]);

  // Update description value when page changes
  useEffect(() => {
    setDescriptionValue(currentPage?.description || '');
  }, [currentPage?.id, currentPage?.description]);

  // Reset edit mode when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setEditingPageId(null);
    }
  }, [isOpen]);

  // Mutual exclusion: opening dropdown closes description
  useEffect(() => {
    if (isOpen) {
      setIsDescriptionExpanded(false);
    }
  }, [isOpen]);

  // Mutual exclusion: opening description closes dropdown
  useEffect(() => {
    if (isDescriptionExpanded) {
      setIsOpen(false);
    }
  }, [isDescriptionExpanded]);

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
    setIsOpen(false);
  }, [pages.length, onCreatePage]);

  const handleSelectPage = useCallback((pageId: string) => {
    onSetActivePage(pageId);
    setIsOpen(false);
  }, [onSetActivePage]);

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

  const sortedPages = [...pages].sort((a, b) => a.order - b.order);
  const pageIds = sortedPages.map(l => l.id);

  const descriptionSubtitle = currentPage?.description
    ? currentPage.description.split('\n')[0]
    : 'Add description...';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger bar */}
      <div className="flex items-end gap-1.5">
        {/* Left zone: page info (click to toggle description) */}
        <button
          className="flex flex-col items-start gap-0.5 pl-3 pr-2 py-1.5 bg-surface text-content border border-border rounded-lg hover:bg-surface-alt transition-colors flex-1 text-left"
          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
        >
          <div className="flex items-center gap-1.5 w-full">
            <svg className="w-3.5 h-3.5 text-content-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="text-sm font-medium truncate" data-testid="page-name">
              {currentPage?.name || 'Main'}
            </span>
          </div>
          <span className={`text-xs truncate w-full pl-5 ${currentPage?.description ? 'text-content-muted' : 'text-content-muted italic'}`}>
            {descriptionSubtitle}
          </span>
        </button>

        {/* Right zone: dropdown chevron */}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface hover:bg-surface-alt transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          title="Switch page"
        >
          <svg className={`w-4 h-4 text-content-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Description expanded (grows the trigger bar) */}
      {isDescriptionExpanded && !isOpen && (
        <div className="mt-1 bg-surface border border-border rounded-lg overflow-hidden">
          <textarea
            className="w-full px-3 py-2 text-sm bg-surface border-none outline-none resize-y text-content min-h-[80px]"
            placeholder="Add a page description..."
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            onBlur={() => {
              if (activePage) {
                onUpdatePage(activePage, { description: descriptionValue.trim() || undefined });
              }
            }}
          />
        </div>
      )}

      {/* Page selector dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[260px]">
          {/* Page rows */}
          {editMode ? (
            <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
              <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
                {sortedPages.map((page) => (
                  <PageRow
                    key={page.id}
                    page={page}
                    isActive={page.id === activePage}
                    editMode={editMode}
                    isEditing={editingPageId === page.id}
                    editName={editName}
                    editInputRef={editInputRef}
                    pagesCount={pages.length}
                    onSelect={handleSelectPage}
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
                isActive={page.id === activePage}
                editMode={false}
                isEditing={editingPageId === page.id}
                editName={editName}
                editInputRef={editInputRef}
                pagesCount={pages.length}
                onSelect={handleSelectPage}
                onStartRename={handleStartRename}
                onFinishEdit={handleFinishEdit}
                onCancelEdit={handleCancelEdit}
                onEditNameChange={setEditName}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))
          )}

          {/* Bottom bar */}
          <div className="border-t border-border flex items-center justify-between">
            <button
              className="flex-1 text-left px-3 py-2 text-sm cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors border-none bg-surface"
              onClick={handleCreatePage}
            >
              + New Page
            </button>
            <button
              className={`px-3 py-2 text-sm cursor-pointer transition-colors border-none ${editMode ? 'bg-accent text-white' : 'bg-surface text-content-muted hover:bg-surface-alt hover:text-content'}`}
              onClick={() => {
                setEditMode(!editMode);
                setEditingPageId(null);
              }}
              title={editMode ? 'Exit rearrange mode' : 'Rearrange pages'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
