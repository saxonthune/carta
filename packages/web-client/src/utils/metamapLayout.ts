import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { ConstructSchema, SchemaGroup } from '@carta/domain';
import type { OrganizerNodeData } from '../components/canvas/OrganizerNode';

// Layout constants
export const SCHEMA_NODE_WIDTH = 240;
export const GROUP_PADDING_X = 40;
export const GROUP_PADDING_TOP = 60;
export const GROUP_PADDING_BOTTOM = 40;
export const COMPACT_HEIGHT = 80;
export const COLLAPSED_GROUP_WIDTH = 180;
export const COLLAPSED_GROUP_HEIGHT = 44;
export const UNGROUPED_SENTINEL = '__ungrouped__';

export type MetamapLayoutDirection = 'TB' | 'LR';

export interface MetamapLayoutInput {
  schemas: ConstructSchema[];
  schemaGroups: SchemaGroup[];
  expandedSchemas?: Set<string>;
  expandedGroups?: Set<string>;
  layoutDirection?: MetamapLayoutDirection;
}

export interface MetamapLayoutOutput {
  nodes: Node[];
  edges: Edge[];
}

interface GroupBounds {
  width: number;
  height: number;
  // Positions relative to parent container
  nodePositions: Map<string, { x: number; y: number }>;
  // Child group positions and sizes relative to this group
  childGroupPositions: Map<string, { x: number; y: number; width: number; height: number }>;
}

export function estimateSchemaNodeHeight(schema: ConstructSchema, isExpanded?: boolean): number {
  if (!isExpanded) return COMPACT_HEIGHT;
  const header = 52;
  const fields = schema.fields.length * 20 + (schema.fields.length > 0 ? 28 : 0);
  const ports = (schema.ports?.length || 0) * 20 + ((schema.ports?.length || 0) > 0 ? 28 : 0);
  return header + fields + ports + 16;
}

/**
 * Extract edges from schema relationships without collapse remapping.
 * Edge remapping is handled by the presentation layer.
 */
export function extractEdges(schemas: ConstructSchema[]): Edge[] {
  const schemaTypes = new Set(schemas.map(s => s.type));
  const portLookup = new Map<string, Set<string>>();
  for (const s of schemas) {
    portLookup.set(s.type, new Set((s.ports || []).map(p => p.id)));
  }

  const edges: Edge[] = [];
  const edgeIds = new Set<string>();

  for (const schema of schemas) {
    for (const rel of schema.suggestedRelated || []) {
      if (schema.type === rel.constructType) continue;
      if (!schemaTypes.has(rel.constructType)) continue;

      const sourceHasPort = rel.fromPortId && portLookup.get(schema.type)?.has(rel.fromPortId);
      const targetHasPort = rel.toPortId && portLookup.get(rel.constructType)?.has(rel.toPortId);

      const sourceHandle = sourceHasPort ? rel.fromPortId : 'meta-connect';
      const targetHandle = targetHasPort ? rel.toPortId : 'meta-connect';

      const edgeId = `meta:${schema.type}:${sourceHandle}->${rel.constructType}:${targetHandle}`;

      if (edgeIds.has(edgeId)) continue;
      edgeIds.add(edgeId);

      edges.push({
        id: edgeId,
        source: schema.type,
        target: rel.constructType,
        sourceHandle,
        targetHandle,
        label: rel.label || '',
        labelStyle: { fill: 'var(--color-content-subtle)', fontSize: '10px' },
        style: { stroke: 'var(--color-content-subtle)', strokeWidth: 1.5 },
        animated: false,
        data: {
          sourceType: schema.type,
          targetType: rel.constructType,
          relIndex: (schema.suggestedRelated || []).indexOf(rel),
          fromPortId: rel.fromPortId,
          toPortId: rel.toPortId,
        },
      });
    }
  }
  return edges;
}

/**
 * Build a tree structure from flat schema groups.
 * Returns a map of parentId -> child group IDs.
 */
export function buildGroupTree(groups: SchemaGroup[]): {
  children: Map<string | undefined, string[]>;
  groupMap: Map<string, SchemaGroup>;
} {
  const children = new Map<string | undefined, string[]>();
  const groupMap = new Map(groups.map(g => [g.id, g]));

  for (const g of groups) {
    const parentKey = g.parentId || undefined;
    const list = children.get(parentKey) || [];
    list.push(g.id);
    children.set(parentKey, list);
  }

  return { children, groupMap };
}

/**
 * Get the nesting depth of a group.
 */
export function getGroupDepth(groupId: string, groupMap: Map<string, SchemaGroup>): number {
  let depth = 0;
  let current = groupId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    const group = groupMap.get(current);
    if (!group?.parentId) break;
    current = group.parentId;
    depth++;
  }
  return depth;
}

/**
 * Count schemas in a group, including all nested child groups.
 */
export function countSchemasInGroup(
  groupId: string,
  schemasByGroup: Map<string, ConstructSchema[]>,
  groupTree: Map<string | undefined, string[]>,
): number {
  const direct = schemasByGroup.get(groupId)?.length || 0;
  const childIds = groupTree.get(groupId) || [];
  let nested = 0;
  for (const childId of childIds) {
    nested += countSchemasInGroup(childId, schemasByGroup, groupTree);
  }
  return direct + nested;
}

/**
 * Recursively compute bounds for a group and all its descendants.
 * Always computes full expanded layout; collapsed groups get chip-sized bounds
 * but their children still get positions (presentation layer handles hiding).
 */
export function layoutGroup(
  groupId: string,
  schemasByGroup: Map<string, ConstructSchema[]>,
  childGroupIds: string[],
  groupTree: Map<string | undefined, string[]>,
  groupMap: Map<string, SchemaGroup>,
  allEdges: Edge[],
  expandedSchemas: Set<string> | undefined,
  groupBoundsMap: Map<string, GroupBounds>,
  expandedGroups?: Set<string>,
  layoutDirection: MetamapLayoutDirection = 'TB',
): GroupBounds {
  const isCollapsed = expandedGroups !== undefined && !expandedGroups.has(groupId);

  // First, recursively layout all child groups
  const childBounds = new Map<string, GroupBounds>();
  for (const childId of childGroupIds) {
    const grandchildIds = groupTree.get(childId) || [];
    const bounds = layoutGroup(
      childId,
      schemasByGroup,
      grandchildIds,
      groupTree,
      groupMap,
      allEdges,
      expandedSchemas,
      groupBoundsMap,
      expandedGroups,
      layoutDirection,
    );
    childBounds.set(childId, bounds);
    groupBoundsMap.set(childId, bounds);
  }

  // Get direct schemas for this group
  const directSchemas = schemasByGroup.get(groupId) || [];

  // Layout using dagre: schemas + child group bounding boxes as nodes
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: layoutDirection,
    nodesep: 20,
    ranksep: 30,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const s of directSchemas) {
    g.setNode(s.type, { width: SCHEMA_NODE_WIDTH, height: estimateSchemaNodeHeight(s, expandedSchemas?.has(s.type)) });
  }

  for (const [childId, bounds] of childBounds) {
    g.setNode(`group:${childId}`, { width: bounds.width, height: bounds.height });
  }

  // Add intra-group edges between direct schemas
  const directTypes = new Set(directSchemas.map(s => s.type));
  for (const e of allEdges) {
    if (directTypes.has(e.source) && directTypes.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  // If group has content, run dagre
  if (directSchemas.length > 0 || childBounds.size > 0) {
    dagre.layout(g);
  }

  const nodePositions = new Map<string, { x: number; y: number }>();
  const childGroupPositions = new Map<string, { x: number; y: number; width: number; height: number }>();

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const s of directSchemas) {
    const node = g.node(s.type);
    const x = node.x - SCHEMA_NODE_WIDTH / 2;
    const y = node.y - node.height / 2;
    nodePositions.set(s.type, { x, y });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + SCHEMA_NODE_WIDTH);
    maxY = Math.max(maxY, y + node.height);
  }

  for (const [childId, bounds] of childBounds) {
    const node = g.node(`group:${childId}`);
    const x = node.x - bounds.width / 2;
    const y = node.y - bounds.height / 2;
    childGroupPositions.set(childId, { x, y, width: bounds.width, height: bounds.height });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + bounds.width);
    maxY = Math.max(maxY, y + bounds.height);
  }

  // Handle empty group
  if (directSchemas.length === 0 && childBounds.size === 0) {
    return {
      width: isCollapsed ? COLLAPSED_GROUP_WIDTH : 240,
      height: isCollapsed ? COLLAPSED_GROUP_HEIGHT : 160,
      nodePositions,
      childGroupPositions,
    };
  }

  // Normalize positions relative to padding
  for (const [type, pos] of nodePositions) {
    nodePositions.set(type, {
      x: pos.x - minX + GROUP_PADDING_X,
      y: pos.y - minY + GROUP_PADDING_TOP,
    });
  }
  for (const [childId, pos] of childGroupPositions) {
    childGroupPositions.set(childId, {
      ...pos,
      x: pos.x - minX + GROUP_PADDING_X,
      y: pos.y - minY + GROUP_PADDING_TOP,
    });
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  // Collapsed groups use chip dimensions for inter-group layout
  if (isCollapsed) {
    return {
      width: COLLAPSED_GROUP_WIDTH,
      height: COLLAPSED_GROUP_HEIGHT,
      nodePositions,
      childGroupPositions,
    };
  }

  return {
    width: contentWidth + GROUP_PADDING_X * 2,
    height: contentHeight + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM,
    nodePositions,
    childGroupPositions,
  };
}

/**
 * Compute the complete metamap layout given schemas and schema groups.
 * Emits ALL nodes (including children of collapsed groups) so the
 * presentation layer can handle hiding and edge remapping.
 * This is a pure function with no React dependencies, enabling unit testing.
 */
export function computeMetamapLayout(input: MetamapLayoutInput): MetamapLayoutOutput {
  const { schemas, schemaGroups, expandedSchemas, expandedGroups, layoutDirection = 'TB' } = input;

  // Build group structures
  const { children: groupTree, groupMap } = buildGroupTree(schemaGroups);

  // Extract edges without collapse remapping (presentation layer handles that)
  const edges = extractEdges(schemas);

  // Handle empty input
  if (schemas.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Map schemas to their direct group
  const schemasByGroup = new Map<string, ConstructSchema[]>();
  const ungroupedSchemas: ConstructSchema[] = [];
  for (const s of schemas) {
    if (s.groupId && groupMap.has(s.groupId)) {
      const list = schemasByGroup.get(s.groupId) || [];
      list.push(s);
      schemasByGroup.set(s.groupId, list);
    } else {
      ungroupedSchemas.push(s);
    }
  }

  // Layout all root groups recursively
  const rootGroupIds = groupTree.get(undefined) || [];
  const allGroupBounds = new Map<string, GroupBounds>();

  for (const rootId of rootGroupIds) {
    const childIds = groupTree.get(rootId) || [];
    const bounds = layoutGroup(
      rootId,
      schemasByGroup,
      childIds,
      groupTree,
      groupMap,
      edges,
      expandedSchemas,
      allGroupBounds,
      expandedGroups,
      layoutDirection,
    );
    allGroupBounds.set(rootId, bounds);
  }

  // Create synthetic group for ungrouped schemas
  if (ungroupedSchemas.length > 0) {
    schemasByGroup.set(UNGROUPED_SENTINEL, ungroupedSchemas);
    const bounds = layoutGroup(
      UNGROUPED_SENTINEL,
      schemasByGroup,
      [],  // no child groups
      groupTree,
      groupMap,
      edges,
      expandedSchemas,
      allGroupBounds,
      expandedGroups,
      layoutDirection,
    );
    allGroupBounds.set(UNGROUPED_SENTINEL, bounds);
  }

  // Phase 2: Grid layout for all top-level groups (including ungrouped)
  const topLevelIds: string[] = [...rootGroupIds];
  if (ungroupedSchemas.length > 0) topLevelIds.push(UNGROUPED_SENTINEL);

  const cols = Math.ceil(Math.sqrt(topLevelIds.length));
  const GAP = 80;

  // Find max cell size
  let maxW = 0, maxH = 0;
  for (const id of topLevelIds) {
    const bounds = allGroupBounds.get(id)!;
    maxW = Math.max(maxW, bounds.width);
    maxH = Math.max(maxH, bounds.height);
  }

  // Position each group in the grid
  const groupPositions = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < topLevelIds.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    groupPositions.set(topLevelIds[i], {
      x: col * (maxW + GAP),
      y: row * (maxH + GAP),
    });
  }

  // Assembly: emit ALL nodes in parent-first order
  const nodes: Node[] = [];

  // Recursively emit group nodes (parent before children) — always emits children
  function emitGroupNodes(
    groupId: string,
    parentReactFlowId: string | undefined,
    position: { x: number; y: number },
    bounds: GroupBounds,
  ) {
    const group = groupMap.get(groupId);
    const depth = getGroupDepth(groupId, groupMap);
    const reactFlowId = `group:${groupId}`;
    const isGroupExpanded = !expandedGroups || expandedGroups.has(groupId);
    const schemaCount = countSchemasInGroup(groupId, schemasByGroup, groupTree);

    nodes.push({
      id: reactFlowId,
      type: 'organizer',
      position,
      ...(parentReactFlowId ? { parentId: parentReactFlowId } : {}),
      style: { width: bounds.width, height: bounds.height },
      data: {
        isOrganizer: true,
        name: group?.name || groupId,
        color: group?.color || '#6366f1',
        collapsed: !isGroupExpanded,
        layout: 'freeform',
        description: group?.description,
        childCount: schemaCount,
        depth,
        parentGroupName: group?.parentId ? groupMap.get(group.parentId)?.name : undefined,
        groupId,
      } satisfies OrganizerNodeData,
      draggable: true,
      selectable: true,
    });

    // Always emit schema nodes inside this group (presentation layer hides if collapsed)
    for (const [schemaType, pos] of bounds.nodePositions) {
      const schema = schemas.find(s => s.type === schemaType);
      if (schema) {
        nodes.push({
          id: schemaType,
          type: 'schema-node',
          position: pos,
          parentId: reactFlowId,
          data: { schema, isExpanded: expandedSchemas?.has(schemaType) },
        });
      }
    }

    // Always emit child groups
    for (const [childGroupId, childPos] of bounds.childGroupPositions) {
      const childBounds = allGroupBounds.get(childGroupId);
      if (childBounds) {
        emitGroupNodes(
          childGroupId,
          reactFlowId,
          { x: childPos.x, y: childPos.y },
          childBounds,
        );
      }
    }
  }

  // Emit root groups with grid positions
  for (const rootId of rootGroupIds) {
    const bounds = allGroupBounds.get(rootId)!;
    const pos = groupPositions.get(rootId)!;
    emitGroupNodes(
      rootId,
      undefined,
      pos,
      bounds,
    );
  }

  // Emit ungrouped organizer with grid position
  if (ungroupedSchemas.length > 0) {
    const bounds = allGroupBounds.get(UNGROUPED_SENTINEL)!;
    const pos = groupPositions.get(UNGROUPED_SENTINEL)!;
    const reactFlowId = `group:${UNGROUPED_SENTINEL}`;
    const isExpanded = !expandedGroups || expandedGroups.has(UNGROUPED_SENTINEL);

    nodes.push({
      id: reactFlowId,
      type: 'organizer',
      position: pos,
      style: { width: bounds.width, height: bounds.height },
      data: {
        isOrganizer: true,
        name: 'Ungrouped',
        color: '#9ca3af',
        collapsed: !isExpanded,
        layout: 'freeform',
        childCount: ungroupedSchemas.length,
        depth: 0,
        groupId: UNGROUPED_SENTINEL,
      } satisfies OrganizerNodeData,
      draggable: false,  // synthetic organizer is not draggable
      selectable: false,
    });

    // Emit child schema nodes
    for (const [schemaType, schemaPos] of bounds.nodePositions) {
      const schema = schemas.find(s => s.type === schemaType);
      if (schema) {
        nodes.push({
          id: schemaType,
          type: 'schema-node',
          position: schemaPos,
          parentId: reactFlowId,
          data: { schema, isExpanded: expandedSchemas?.has(schemaType) },
        });
      }
    }
  }

  return { nodes, edges };
}
