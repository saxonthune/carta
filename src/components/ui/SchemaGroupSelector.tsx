import type { SchemaGroup } from '../../constructs/types';
import useDocument from '../../hooks/useDocument';

/**
 * Helper function to build the full path of a schema group
 * Examples: "AWS > Lambda", "Software Architecture > AWS > Lambda"
 */
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

/**
 * Helper function to get indentation level for a group
 */
function getIndentLevel(groupId: string, groups: SchemaGroup[]): number {
  let level = 0;
  let current: SchemaGroup | undefined = groups.find(g => g.id === groupId);

  while (current?.parentId) {
    level++;
    const parentId = current.parentId;
    current = groups.find(g => g.id === parentId);
  }

  return level;
}

export interface SchemaGroupSelectorProps {
  value: string | undefined;
  onChange: (groupId: string | undefined) => void;
  label?: string;
  className?: string;
}

/**
 * Reusable dropdown component for selecting schema groups
 * Shows all schema groups with full paths (e.g., "Software Architecture > AWS > Lambda")
 * Allows selecting a group or "None" (undefined)
 */
export default function SchemaGroupSelector({
  value,
  onChange,
  label,
  className = '',
}: SchemaGroupSelectorProps) {
  const { schemaGroups } = useDocument();

  // Build list of options with display text
  // Sort by full path for consistent ordering
  const sortedGroups = [...schemaGroups].sort((a, b) => {
    const pathA = getFullPath(a.id, schemaGroups);
    const pathB = getFullPath(b.id, schemaGroups);
    return pathA.localeCompare(pathB);
  });

  return (
    <div className={className}>
      {label && (
        <label className="block mb-1 text-sm font-medium text-content">
          {label}
        </label>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors"
      >
        <option value="">None</option>
        {sortedGroups.map((group) => {
          const fullPath = getFullPath(group.id, schemaGroups);
          const indentLevel = getIndentLevel(group.id, schemaGroups);
          const indent = '\u00A0'.repeat(indentLevel * 2); // Non-breaking spaces for indentation

          return (
            <option key={group.id} value={group.id}>
              {indent}{fullPath}
            </option>
          );
        })}
      </select>
    </div>
  );
}
