import { useState, useCallback, useMemo } from 'react';
import type { ConstructSchema, SchemaGroup } from '../../constructs/types';

interface GroupedSchemaListProps {
  schemas: ConstructSchema[];
  schemaGroups: SchemaGroup[];
  selectedType: string | null;
  onSelectSchema: (type: string) => void;
  isFullScreen?: boolean;
}

// Build a tree structure from flat schema groups
interface GroupNode {
  group: SchemaGroup;
  children: GroupNode[];
  schemas: ConstructSchema[];
}

export default function GroupedSchemaList({
  schemas,
  schemaGroups,
  selectedType,
  onSelectSchema,
  isFullScreen = false,
}: GroupedSchemaListProps) {
  // Track which groups are collapsed (default: all expanded)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Build tree structure
  const { rootGroups, ungroupedSchemas } = useMemo(() => {
    const groupMap = new Map<string, GroupNode>();

    // Initialize all groups
    for (const group of schemaGroups) {
      groupMap.set(group.id, {
        group,
        children: [],
        schemas: [],
      });
    }

    // Assign schemas to their groups
    const ungrouped: ConstructSchema[] = [];
    for (const schema of schemas) {
      if (schema.groupId && groupMap.has(schema.groupId)) {
        groupMap.get(schema.groupId)!.schemas.push(schema);
      } else {
        ungrouped.push(schema);
      }
    }

    // Build parent-child relationships
    const roots: GroupNode[] = [];
    for (const node of groupMap.values()) {
      if (node.group.parentId && groupMap.has(node.group.parentId)) {
        groupMap.get(node.group.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort children and schemas alphabetically
    const sortNode = (node: GroupNode) => {
      node.children.sort((a, b) => a.group.name.localeCompare(b.group.name));
      node.schemas.sort((a, b) => a.displayName.localeCompare(b.displayName));
      node.children.forEach(sortNode);
    };
    roots.sort((a, b) => a.group.name.localeCompare(b.group.name));
    roots.forEach(sortNode);

    return {
      rootGroups: roots,
      ungroupedSchemas: ungrouped.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  }, [schemas, schemaGroups]);

  // Check if a group has any content (schemas or subgroups with schemas)
  const hasContent = useCallback((node: GroupNode): boolean => {
    if (node.schemas.length > 0) return true;
    return node.children.some(hasContent);
  }, []);

  // Render a single schema item
  const renderSchemaItem = (schema: ConstructSchema, depth: number) => {
    const paddingLeft = depth * 12;
    return (
      <button
        key={schema.type}
        className={`flex items-center w-full rounded-lg cursor-pointer text-left gap-2 transition-all ${
          selectedType === schema.type
            ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
            : 'text-content bg-transparent hover:bg-surface-depth-3/50'
        } ${isFullScreen ? 'px-3 py-2.5 text-sm' : 'px-2 py-1.5 text-xs'}`}
        style={{ paddingLeft: `calc(${isFullScreen ? '0.75rem' : '0.5rem'} + ${paddingLeft}px)` }}
        onClick={() => onSelectSchema(schema.type)}
      >
        <span
          className="w-3 h-3 rounded-sm shrink-0"
          style={{ backgroundColor: schema.color }}
        />
        <span className="flex-1 truncate">{schema.displayName}</span>
      </button>
    );
  };

  // Render a group header with collapse toggle
  const renderGroupHeader = (node: GroupNode, depth: number) => {
    const isCollapsed = collapsedGroups.has(node.group.id);
    const paddingLeft = depth * 12;
    const hasChildren = node.children.length > 0 || node.schemas.length > 0;

    return (
      <button
        key={`group-${node.group.id}`}
        className={`flex items-center w-full rounded-lg cursor-pointer text-left gap-1.5 transition-all text-content-muted hover:bg-surface-depth-3/50 hover:text-content ${
          isFullScreen ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[10px]'
        }`}
        style={{ paddingLeft: `calc(${isFullScreen ? '0.75rem' : '0.5rem'} + ${paddingLeft}px)` }}
        onClick={() => hasChildren && toggleGroup(node.group.id)}
      >
        {hasChildren && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`w-3 h-3 transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: node.group.color || '#888' }}
        />
        <span className="flex-1 truncate font-medium uppercase tracking-wide">{node.group.name}</span>
      </button>
    );
  };

  // Recursively render a group and its contents
  const renderGroup = (node: GroupNode, depth: number): React.ReactNode => {
    // Skip empty groups
    if (!hasContent(node)) return null;

    const isCollapsed = collapsedGroups.has(node.group.id);

    return (
      <div key={node.group.id}>
        {renderGroupHeader(node, depth)}
        {!isCollapsed && (
          <>
            {node.children.map(child => renderGroup(child, depth + 1))}
            {node.schemas.map(schema => renderSchemaItem(schema, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-surface-depth-2 rounded-xl ${isFullScreen ? 'p-2' : 'p-1.5'}`}>
      {/* Grouped schemas */}
      {rootGroups.map(node => renderGroup(node, 0))}

      {/* Ungrouped schemas */}
      {ungroupedSchemas.length > 0 && (
        <>
          {rootGroups.length > 0 && schemaGroups.length > 0 && (
            <div className={`border-t border-surface-depth-3 my-1 ${isFullScreen ? 'mx-2' : 'mx-1'}`} />
          )}
          {ungroupedSchemas.map(schema => renderSchemaItem(schema, 0))}
        </>
      )}

      {/* Empty state */}
      {schemas.length === 0 && (
        <p className={`text-content-muted italic ${isFullScreen ? 'px-2 text-sm' : 'px-2 text-xs'}`}>
          No constructs available
        </p>
      )}
    </div>
  );
}
