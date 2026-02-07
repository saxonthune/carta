import { useMemo } from 'react';
import ContextMenuPrimitive, { type MenuItem } from './ContextMenuPrimitive';
import type { SchemaGroup, Level } from '@carta/domain';

export type ContextMenuType = 'pane' | 'node' | 'edge';

export interface RelatedConstructOption {
  constructType: string;
  displayName: string;
  color: string;
  fromPortId?: string;
  toPortId?: string;
  label?: string;
  groupId?: string;
}

export interface ConstructOption {
  constructType: string;
  displayName: string;
  color: string;
  groupId?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  type: ContextMenuType;
  nodeId?: string;
  edgeId?: string;
  selectedCount: number;
  relatedConstructs?: RelatedConstructOption[];
  constructOptions?: ConstructOption[];
  schemaGroups?: SchemaGroup[];
  onAddNode?: (x: number, y: number) => void;
  onAddConstruct?: (constructType: string, x: number, y: number) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteSelected?: () => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCopyNodes?: (nodeIds?: string[]) => void;
  onPasteNodes?: (x: number, y: number) => void;
  onAddRelatedConstruct?: (constructType: string, fromPortId?: string, toPortId?: string) => void;
  onNewConstructSchema?: () => void;
  onNewGroup?: () => void;
  onEditSchema?: (constructType: string) => void;
  constructType?: string;
  canPaste?: boolean;
  onClose: () => void;
  // Level props for "Copy to Level"
  levels?: Level[];
  activeLevel?: string;
  selectedNodeIds?: string[];
  onCopyNodesToLevel?: (nodeIds: string[], targetLevelId: string) => void;
  onCopyNodesToNewLevel?: (nodeIds: string[]) => void;
  // Organizer props
  onOrganizeSelected?: () => void;
  onRemoveFromOrganizer?: (nodeId: string) => void;
  nodeInOrganizer?: boolean;
  onAttachOrganizer?: (nodeId: string) => void;
  nodeIsConstruct?: boolean;
}

// Group items by their groupId into MenuItem[] with nested children
function groupIntoMenuItems<T extends { groupId?: string }>(
  items: T[],
  schemaGroups: SchemaGroup[],
  toMenuItem: (item: T) => MenuItem,
): MenuItem[] {
  const groupLookup = new Map(schemaGroups.map(g => [g.id, g]));
  const groupMap = new Map<string | null, T[]>();

  for (const item of items) {
    const key = item.groupId || null;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(item);
  }

  const hasMultipleGroups = groupMap.size > 1 || (groupMap.size === 1 && !groupMap.has(null));

  if (!hasMultipleGroups) {
    return items.map(toMenuItem);
  }

  const result: MenuItem[] = [];
  for (const [groupId, groupItems] of groupMap) {
    if (groupId) {
      const group = groupLookup.get(groupId);
      result.push({
        key: `group-${groupId}`,
        label: `${group?.name || 'Other'} (${groupItems.length})`,
        color: group?.color,
        children: groupItems.map(toMenuItem),
      });
    }
  }
  const ungrouped = groupMap.get(null);
  if (ungrouped) {
    if (result.length > 0) {
      result.push({
        key: 'group-ungrouped',
        label: `Other (${ungrouped.length})`,
        children: ungrouped.map(toMenuItem),
      });
    } else {
      result.push(...ungrouped.map(toMenuItem));
    }
  }
  return result;
}

export default function ContextMenu({
  x,
  y,
  type,
  nodeId,
  edgeId,
  selectedCount,
  relatedConstructs,
  constructOptions,
  schemaGroups = [],
  onAddNode,
  onAddConstruct,
  onDeleteNode,
  onDeleteSelected,
  onDeleteEdge,
  onCopyNodes,
  onPasteNodes,
  onAddRelatedConstruct,
  canPaste,
  onClose,
  onNewConstructSchema,
  onNewGroup,
  onEditSchema,
  constructType,
  levels,
  activeLevel,
  selectedNodeIds,
  onCopyNodesToLevel,
  onCopyNodesToNewLevel,
  onOrganizeSelected,
  onRemoveFromOrganizer,
  nodeInOrganizer,
  onAttachOrganizer,
  nodeIsConstruct,
}: ContextMenuProps) {
  const showMultipleSelected = selectedCount > 1;

  const items = useMemo((): MenuItem[] => {
    if (type === 'pane') {
      return buildPaneMenuItems();
    }
    if (type === 'node') {
      return buildNodeMenuItems();
    }
    if (type === 'edge') {
      return buildEdgeMenuItems();
    }
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, nodeId, edgeId, selectedCount, relatedConstructs, constructOptions, schemaGroups, canPaste, levels, activeLevel, selectedNodeIds, constructType, onEditSchema, onCopyNodesToNewLevel, onOrganizeSelected, onRemoveFromOrganizer, nodeInOrganizer, onAttachOrganizer, nodeIsConstruct]);

  function buildPaneMenuItems(): MenuItem[] {
    const result: MenuItem[] = [];

    if (onAddConstruct) {
      result.push({
        key: 'add-note',
        label: 'Add Note',
        onClick: () => onAddConstruct('note', x, y),
      });

      if (constructOptions && constructOptions.length > 0) {
        const children = groupIntoMenuItems(
          constructOptions,
          schemaGroups,
          (c) => ({
            key: `add-${c.constructType}`,
            label: c.displayName,
            color: c.color,
            onClick: () => onAddConstruct(c.constructType, x, y),
          }),
        );
        result.push({
          key: 'add-node',
          label: `Add Node Here (${constructOptions.length})`,
          children,
        });
      } else if (onAddNode) {
        result.push({
          key: 'add-node',
          label: '+ Add Node Here',
          onClick: () => onAddNode(x, y),
        });
      }

      if (canPaste && onPasteNodes) {
        result.push({
          key: 'paste',
          label: 'Paste',
          onClick: () => onPasteNodes(x, y),
        });
      }
    }

    if (onNewConstructSchema || onNewGroup) {
      if (result.length > 0) {
        result[result.length - 1].dividerAfter = true;
      }
      if (onNewConstructSchema) {
        result.push({
          key: 'new-schema',
          label: 'New Construct Schema',
          onClick: onNewConstructSchema,
        });
      }
      if (onNewGroup) {
        result.push({
          key: 'new-group',
          label: 'New Group',
          onClick: onNewGroup,
        });
      }
    }

    if (onEditSchema && constructOptions && constructOptions.length > 0) {
      if (result.length > 0) {
        result[result.length - 1].dividerAfter = true;
      }
      const children = groupIntoMenuItems(
        constructOptions,
        schemaGroups,
        (c) => ({
          key: `edit-schema-${c.constructType}`,
          label: c.displayName,
          color: c.color,
          onClick: () => onEditSchema(c.constructType),
        }),
      );
      result.push({
        key: 'edit-schema',
        label: 'Edit Schema',
        children,
      });
    }

    return result;
  }

  function buildNodeMenuItems(): MenuItem[] {
    const result: MenuItem[] = [];

    result.push({
      key: 'copy',
      label: `Copy ${showMultipleSelected ? `(${selectedCount})` : ''}`,
      onClick: () => onCopyNodes?.(),
    });

    // "Copy to Level" submenu - shown when nodes are selected (always has "+ New Level")
    if (levels && activeLevel && selectedNodeIds && selectedNodeIds.length > 0 && (onCopyNodesToLevel || onCopyNodesToNewLevel)) {
      const otherLevels = levels.filter(l => l.id !== activeLevel);
      const children: MenuItem[] = otherLevels.map(level => ({
        key: `copy-to-level-${level.id}`,
        label: level.name,
        onClick: () => onCopyNodesToLevel?.(selectedNodeIds, level.id),
      }));
      if (onCopyNodesToNewLevel) {
        if (children.length > 0) {
          children[children.length - 1].dividerAfter = true;
        }
        children.push({
          key: 'copy-to-new-level',
          label: '+ New Level',
          onClick: () => onCopyNodesToNewLevel(selectedNodeIds),
        });
      }
      result.push({
        key: 'copy-to-level',
        label: 'Copy to Level',
        children,
      });
    }

    if (!showMultipleSelected && relatedConstructs && relatedConstructs.length > 0) {
      const children = groupIntoMenuItems(
        relatedConstructs,
        schemaGroups,
        (r) => ({
          key: `related-${r.constructType}-${r.fromPortId || ''}-${r.toPortId || ''}`,
          label: r.label || r.displayName,
          color: r.color,
          onClick: () => onAddRelatedConstruct?.(r.constructType, r.fromPortId, r.toPortId),
        }),
      );
      result.push({
        key: 'add-related',
        label: `Add Related (${relatedConstructs.length})`,
        children,
      });
    }

    if (onEditSchema && constructType) {
      result.push({
        key: 'edit-schema',
        label: 'Edit Schema',
        onClick: () => onEditSchema(constructType),
      });
    }

    // Organizer operations
    if (showMultipleSelected && onOrganizeSelected) {
      result.push({
        key: 'organize-selected',
        label: `Organize ${selectedCount} Nodes`,
        onClick: onOrganizeSelected,
      });
    }

    if (!showMultipleSelected && nodeInOrganizer && onRemoveFromOrganizer && nodeId) {
      result.push({
        key: 'remove-from-organizer',
        label: 'Remove from Organizer',
        onClick: () => onRemoveFromOrganizer(nodeId),
      });
    }

    if (!showMultipleSelected && nodeIsConstruct && onAttachOrganizer && nodeId) {
      result.push({
        key: 'attach-organizer',
        label: 'Attach Organizer',
        onClick: () => onAttachOrganizer(nodeId),
      });
    }

    // Add divider before delete
    if (result.length > 0) {
      result[result.length - 1].dividerAfter = true;
    }

    if (showMultipleSelected) {
      result.push({
        key: 'delete-selected',
        label: `Delete ${selectedCount} nodes`,
        danger: true,
        onClick: () => onDeleteSelected?.(),
      });
    } else {
      result.push({
        key: 'delete',
        label: 'Delete',
        danger: true,
        onClick: () => nodeId && onDeleteNode?.(nodeId),
      });
    }

    return result;
  }

  function buildEdgeMenuItems(): MenuItem[] {
    return [
      {
        key: 'delete-edge',
        label: 'Delete Connection',
        danger: true,
        onClick: () => edgeId && onDeleteEdge?.(edgeId),
      },
    ];
  }

  return (
    <ContextMenuPrimitive
      x={x}
      y={y}
      items={items}
      onClose={onClose}
    />
  );
}
