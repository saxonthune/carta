import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDocument } from '../hooks/useDocument';
import type { SchemaGroup } from '../constructs/types';

// Convert string to kebab-case for IDs
// (e.g., "My Group" → "my-group", "API Layer" → "api-layer")
function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-');
}

// Get the full path of a group (e.g., "System > API > Endpoints")
function getFullPath(groupId: string, groups: SchemaGroup[]): string {
  const group = groups.find(g => g.id === groupId);
  if (!group) return '';
  const parts: string[] = [group.name];
  let current = group;
  while (current.parentId) {
    const parent = groups.find(g => g.id === current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(' > ');
}

// Check if setting parentId would create a circular reference
function wouldCreateCircle(groupId: string, newParentId: string | undefined, groups: SchemaGroup[]): boolean {
  if (!newParentId) return false;
  if (newParentId === groupId) return true;

  let current: SchemaGroup | undefined = groups.find(g => g.id === newParentId);
  while (current) {
    if (current.id === groupId) return true;
    if (!current.parentId) break;
    const parentId = current.parentId;
    current = groups.find(g => g.id === parentId);
  }
  return false;
}

interface SchemaGroupDetailsEditorProps {
  schemaGroup: SchemaGroup | null;
  isNew: boolean;
  onSave: (group: SchemaGroup, isNew: boolean) => void;
  onDelete: (id: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  compact?: boolean;
}

const createEmptyGroup = (): SchemaGroup => ({
  id: '',
  name: '',
  parentId: undefined,
  color: '#6366f1',
  description: '',
});

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b'
];

const SchemaGroupDetailsEditor = forwardRef<{ save: () => void }, SchemaGroupDetailsEditorProps>(
  function SchemaGroupDetailsEditor({
    schemaGroup,
    isNew,
    onSave,
    onDelete,
    onDirtyChange,
    compact = false
  }, ref) {
  const { getSchemaGroups } = useDocument();
  const [formData, setFormData] = useState<SchemaGroup>(
    schemaGroup || createEmptyGroup()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const allGroups = getSchemaGroups();
  const availableParents = allGroups.filter(g =>
    g.id !== formData.id && !wouldCreateCircle(formData.id, g.id, allGroups)
  );

  // Reset form state when schemaGroup prop changes
  useEffect(() => {
    setFormData(schemaGroup || createEmptyGroup());
    setErrors({});
    setIsDirty(false);
  }, [schemaGroup]);

  // Check if form has unsaved changes
  useEffect(() => {
    if (!schemaGroup) {
      // For new groups, check if user has entered any meaningful data
      const hasContent = formData.name.trim() !== '' || formData.description?.trim() !== '';
      setIsDirty(hasContent);
      return;
    }
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(schemaGroup);
    setIsDirty(isDifferent);
  }, [formData, schemaGroup]);

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required';
    }

    // Derive id from name
    const derivedId = toKebabCase(formData.name);
    if (!derivedId) {
      newErrors.name = 'Group name must contain at least one alphanumeric character';
    } else if (isNew && allGroups.some(g => g.id === derivedId)) {
      newErrors.name = 'A schema group with this name already exists';
    }

    // Check for circular references
    if (formData.parentId && wouldCreateCircle(formData.id, formData.parentId, allGroups)) {
      newErrors.parentId = 'Cannot set a child as parent (circular reference)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isNew, allGroups]);

  const handleSave = useCallback(() => {
    if (validateForm()) {
      // Auto-derive id from name for new groups
      const groupToSave = isNew
        ? { ...formData, id: toKebabCase(formData.name) }
        : formData;
      onSave(groupToSave, isNew);
    }
  }, [formData, isNew, onSave, validateForm]);

  // Expose save method via ref for parent to trigger from confirmation modal
  useImperativeHandle(ref, () => ({
    save: handleSave
  }), [handleSave]);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${formData.name}"?`)) {
      onDelete(formData.id);
    }
  };

  const updateField = (key: keyof SchemaGroup, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className={`h-full flex flex-col ${compact ? 'p-3' : ''}`}>
      <div className={`flex items-center justify-between gap-2 mb-0 shrink-0 border-b ${compact ? 'pb-2' : 'pb-3 gap-3'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <h2 className={`m-0 font-semibold text-content truncate ${compact ? 'text-sm' : 'text-xl'}`}>
            {isNew ? 'New Group' : formData.name}
          </h2>
          {isDirty && (
            <span className={`shrink-0 bg-surface-elevated rounded text-content-muted ${compact ? 'text-[10px] px-1.5 py-0.5' : 'px-2.5 py-1 text-xs'}`}>
              • Unsaved
            </span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {!isNew && (
            <button
              className={`bg-transparent border border-danger rounded text-danger font-medium cursor-pointer hover:bg-danger hover:text-white transition-all ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
          <button
            className={`bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
            onClick={handleSave}
          >
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className={`bg-surface-elevated rounded-lg ${compact ? 'p-2 mt-2' : 'p-4'}`}>
          {/* Group Name */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Name</label>
            <input
              type="text"
              className={`w-full bg-surface rounded-md text-content focus:outline-none focus:border-accent transition-colors ${compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm'} ${errors.name ? '!border-danger' : ''}`}
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., API Layer"
            />
            {formData.name && (
              <span className="block mt-1 text-[10px] text-content-muted">ID: {toKebabCase(formData.name)}</span>
            )}
            {errors.name && <span className="block mt-1 text-[10px] text-danger">{errors.name}</span>}
          </div>

          {/* ID (read-only for existing) - hide in compact */}
          {!isNew && !compact && (
            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-content">ID</label>
              <input
                type="text"
                className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none disabled:opacity-50"
                value={formData.id}
                disabled
              />
            </div>
          )}

          {/* Description */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Description</label>
            <textarea
              className={`w-full bg-surface rounded-md text-content resize-none focus:outline-none focus:border-accent transition-colors ${compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm'}`}
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Optional description..."
              rows={compact ? 2 : 3}
            />
          </div>

          {/* Parent Group */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Parent</label>
            {!compact && <p className="text-xs text-content-muted mb-2">Optional: set to make this a sub-group</p>}
            <select
              className={`w-full bg-surface rounded-md text-content focus:outline-none focus:border-accent ${compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm'} ${errors.parentId ? '!border-danger' : ''}`}
              value={formData.parentId || ''}
              onChange={(e) => updateField('parentId', e.target.value || undefined)}
            >
              <option value="">None (root)</option>
              {availableParents.map(group => (
                <option key={group.id} value={group.id}>
                  {compact ? group.name : getFullPath(group.id, allGroups)}
                </option>
              ))}
            </select>
            {errors.parentId && <span className="block mt-1 text-[10px] text-danger">{errors.parentId}</span>}
          </div>

          {/* Color */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Color</label>
            <div className="flex flex-wrap gap-1 items-center">
              {DEFAULT_COLORS.slice(0, compact ? 4 : 6).map(color => (
                <button
                  key={color}
                  type="button"
                  className={`border-2 border-transparent rounded cursor-pointer transition-all hover:scale-110 ${compact ? 'w-5 h-5' : 'w-6 h-6'} ${formData.color === color ? 'border-white shadow-[0_0_0_2px_#6366f1]' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('color', color)}
                />
              ))}
              <input
                type="color"
                className={`p-0 border-none rounded cursor-pointer ${compact ? 'w-5 h-5' : 'w-6 h-6'}`}
                value={formData.color || '#6366f1'}
                onChange={(e) => updateField('color', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  }
);

SchemaGroupDetailsEditor.displayName = 'SchemaGroupDetailsEditor';

export default SchemaGroupDetailsEditor;
