import { useState, useRef, useEffect, useCallback } from 'react';
import { DndContext, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Page } from '@carta/domain';

interface PageSwitcherProps {
  pages: Page[];
  activePage: string | undefined;
  onSetActivePage: (pageId: string) => void;
  onCreatePage: (name: string) => void;
  onDeletePage: (pageId: string) => boolean;
  onUpdatePage: (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges' | 'deployables'>>) => void;
  onDuplicatePage: (pageId: string, newName: string) => void;
}

interface SortablePageRowProps {
  page: Page;
  isActive: boolean;
  editMode: boolean;
  isEditing: boolean;
  editName: string;
  editDescription: string;
  isEditingDescription: boolean;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  editDescriptionRef: React.RefObject<HTMLTextAreaElement | null>;
  pagesCount: number;
  onSelect: (pageId: string) => void;
  onStartEdit: (page: Page) => void;
  onFinishEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (value: string) => void;
  onToggleDescriptionEdit: (pageId: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onFinishDescriptionEdit: () => void;
  onDuplicate: (page: Page, event: React.MouseEvent) => void;
  onDelete: (pageId: string, event: React.MouseEvent) => void;
}

function SortablePageRow({
  page,
  isActive,
  editMode,
  isEditing,
  editName,
  editDescription,
  isEditingDescription,
  editInputRef,
  editDescriptionRef,
  pagesCount,
  onSelect,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onEditNameChange,
  onToggleDescriptionEdit,
  onEditDescriptionChange,
  onFinishDescriptionEdit,
  onDuplicate,
  onDelete,
}: SortablePageRowProps) {
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
    if (!editMode && !isEditingDescription) {
      onSelect(page.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col transition-colors text-content ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div
        className={`flex items-center gap-2 pr-3 py-2 cursor-pointer hover:bg-surface-alt group`}
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
          <span className="flex-1 text-sm truncate">
            {page.name}
          </span>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!isEditing && (
            <>
              <button
                className="p-0.5 rounded hover:bg-black/10 text-content-muted hover:text-content"
                onClick={(e) => { e.stopPropagation(); onStartEdit(page); }}
                title="Rename page"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
              <button
                className="p-0.5 rounded hover:bg-black/10 text-content-muted hover:text-content"
                onClick={(e) => { e.stopPropagation(); onToggleDescriptionEdit(page.id); }}
                title={isEditingDescription ? "Close description" : "Edit description"}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </>
          )}
          <button
            className="p-0.5 rounded hover:bg-black/10 text-content-muted hover:text-content"
            onMouseDown={(e) => { if (isEditing) e.preventDefault(); }}
            onClick={(e) => { e.stopPropagation(); if (isEditing) onFinishEdit(); onDuplicate(page, e); }}
            title="Duplicate page"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          {pagesCount > 1 && (
            <button
              className="p-0.5 rounded hover:bg-black/10 text-content-muted hover:text-content"
              onMouseDown={(e) => { if (isEditing) e.preventDefault(); }}
              onClick={(e) => { e.stopPropagation(); if (isEditing) onFinishEdit(); onDelete(page.id, e); }}
              title="Delete page"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {/* Description editing section */}
      {isEditingDescription && (
        <div className="px-3 pb-2 pt-1 bg-surface-alt border-t border-border" onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={editDescriptionRef}
            className="w-full px-2 py-1.5 text-xs bg-surface border border-border rounded resize-none outline-none focus:ring-1 focus:ring-accent text-content"
            placeholder="Add a description for this page..."
            rows={3}
            value={editDescription}
            onChange={(e) => onEditDescriptionChange(e.target.value)}
            onBlur={onFinishDescriptionEdit}
            onClick={(e) => e.stopPropagation()}
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
  const [editMode, setEditMode] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingDescriptionPageId, setEditingDescriptionPageId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  // Inline rename of the current page (in the trigger bar, outside the dropdown)
  const [isRenamingCurrent, setIsRenamingCurrent] = useState(false);
  const [currentEditName, setCurrentEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const editDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const currentEditInputRef = useRef<HTMLInputElement>(null);
  // Counter to force re-focus when clicking the same page again
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

  // Focus input when editing in dropdown — uses a counter so re-clicking the same page re-focuses
  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPageId, editFocusCounter.current]);

  // Focus input when renaming current page in the trigger bar
  useEffect(() => {
    if (isRenamingCurrent && currentEditInputRef.current) {
      currentEditInputRef.current.focus();
      currentEditInputRef.current.select();
    }
  }, [isRenamingCurrent]);

  // Focus textarea when editing description
  useEffect(() => {
    if (editingDescriptionPageId && editDescriptionRef.current) {
      editDescriptionRef.current.focus();
    }
  }, [editingDescriptionPageId]);

  // Reset edit mode when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setEditingPageId(null);
    }
  }, [isOpen]);

  const handleStartEdit = useCallback((page: Page) => {
    // Always set both — even if same page, bump counter to re-trigger focus
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

  // Current page inline rename handlers
  const handleStartCurrentRename = useCallback(() => {
    if (!currentPage) return;
    setCurrentEditName(currentPage.name);
    setIsRenamingCurrent(true);
    // Close the dropdown if open — renaming is separate from selecting
    setIsOpen(false);
  }, [currentPage]);

  const handleFinishCurrentRename = useCallback(() => {
    if (activePage && currentEditName.trim()) {
      onUpdatePage(activePage, { name: currentEditName.trim() });
    }
    setIsRenamingCurrent(false);
  }, [activePage, currentEditName, onUpdatePage]);

  const handleCancelCurrentRename = useCallback(() => {
    setIsRenamingCurrent(false);
  }, []);

  const handleToggleDescriptionEdit = useCallback((pageId: string) => {
    if (editingDescriptionPageId === pageId) {
      setEditingDescriptionPageId(null);
    } else {
      const page = pages.find(p => p.id === pageId);
      if (page) {
        setEditDescription(page.description || '');
        setEditingDescriptionPageId(pageId);
      }
    }
  }, [editingDescriptionPageId, pages]);

  const handleFinishDescriptionEdit = useCallback(() => {
    if (editingDescriptionPageId) {
      onUpdatePage(editingDescriptionPageId, { description: editDescription.trim() || undefined });
    }
    setEditingDescriptionPageId(null);
  }, [editingDescriptionPageId, editDescription, onUpdatePage]);

  const handleDelete = useCallback((pageId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const page = pages.find(l => l.id === pageId);
    const hasContent = (page?.nodes as unknown[])?.length > 0;
    if (hasContent) {
      const confirmed = window.confirm(`Delete page "${page?.name}"? This page has content that will be lost.`);
      if (!confirmed) return;
    }
    onDeletePage(pageId);
  }, [pages, onDeletePage]);

  const handleDuplicate = useCallback((page: Page, event: React.MouseEvent) => {
    event.stopPropagation();
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

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-0.5">
        {/* Part 1: Current page info — click name to rename inline */}
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
                title={currentPage?.description ? `${currentPage.name}\n${currentPage.description}` : "Click to rename"}
              >
                {currentPage?.name || 'Main'}
              </span>
            )}
          </div>
          {/* Part 2: Trigger to open the page selector */}
          <button
            className="flex items-center justify-center w-6 h-6 rounded cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            title="Switch page"
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
              setEditingPageId(null);
            }}
            title={editMode ? 'Exit edit mode' : 'Edit pages'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Page selector dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[260px]">
          {/* Page rows */}
          {editMode ? (
            <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
              <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
                {sortedPages.map((page) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    isActive={page.id === activePage}
                    editMode={editMode}
                    isEditing={editingPageId === page.id}
                    editName={editName}
                    editDescription={editDescription}
                    isEditingDescription={editingDescriptionPageId === page.id}
                    editInputRef={editInputRef}
                    editDescriptionRef={editDescriptionRef}
                    pagesCount={pages.length}
                    onSelect={handleSelectPage}
                    onStartEdit={handleStartEdit}
                    onFinishEdit={handleFinishEdit}
                    onCancelEdit={handleCancelEdit}
                    onEditNameChange={setEditName}
                    onToggleDescriptionEdit={handleToggleDescriptionEdit}
                    onEditDescriptionChange={setEditDescription}
                    onFinishDescriptionEdit={handleFinishDescriptionEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            sortedPages.map((page) => (
              <SortablePageRow
                key={page.id}
                page={page}
                isActive={page.id === activePage}
                editMode={false}
                isEditing={editingPageId === page.id}
                editName={editName}
                editDescription={editDescription}
                isEditingDescription={editingDescriptionPageId === page.id}
                editInputRef={editInputRef}
                editDescriptionRef={editDescriptionRef}
                pagesCount={pages.length}
                onSelect={handleSelectPage}
                onStartEdit={handleStartEdit}
                onFinishEdit={handleFinishEdit}
                onCancelEdit={handleCancelEdit}
                onEditNameChange={setEditName}
                onToggleDescriptionEdit={handleToggleDescriptionEdit}
                onEditDescriptionChange={setEditDescription}
                onFinishDescriptionEdit={handleFinishDescriptionEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))
          )}

          <div className="border-t border-subtle">
            <button
              className="w-full text-left px-3 py-2 text-sm cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors border-none bg-surface"
              onClick={handleCreatePage}
            >
              + New Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
