import dagre from '@dagrejs/dagre';
import type { ConstructSchema, SchemaGroup, SchemaPackage } from '@carta/domain';

// Layout constants
const SCHEMA_NODE_WIDTH = 220;
const SCHEMA_NODE_HEIGHT = 80;
const GROUP_PADDING = 30;
const GROUP_HEADER_HEIGHT = 36;
const PACKAGE_PADDING = 40;
const PACKAGE_HEADER_HEIGHT = 48;
const PORT_SPACING = 14;

/**
 * Compute Y offset for a port dot relative to the node's top edge.
 * Ports are stacked vertically and centered on the node.
 */
export function portYOffset(index: number, count: number, nodeHeight: number): number {
  const totalHeight = (count - 1) * PORT_SPACING;
  const startY = (nodeHeight - totalHeight) / 2;
  return startY + index * PORT_SPACING;
}

export interface MetamapV2Node {
  id: string;
  type: 'schema' | 'package' | 'group';
  position: { x: number; y: number };
  size: { width: number; height: number };
  parentId?: string;  // container this node belongs to
  data: SchemaNodeData | PackageNodeData | GroupNodeData;
  portOffsets?: Map<string, number>;  // portId → Y offset from node top
}

export interface SchemaNodeData {
  kind: 'schema';
  schema: ConstructSchema;
}

export interface PackageNodeData {
  kind: 'package';
  pkg: SchemaPackage;
  schemaCount: number;
}

export interface GroupNodeData {
  kind: 'group';
  group: SchemaGroup;
  schemaCount: number;
}

export interface MetamapV2Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  sourceType: string;     // same as source, for clarity in handlers
  relIndex: number;       // index into source schema's suggestedRelated[]
  fromPortId?: string;    // for narrative tooltip
  toPortId?: string;      // for narrative tooltip
}

export interface MetamapV2LayoutOutput {
  nodes: MetamapV2Node[];
  edges: MetamapV2Edge[];
}

interface ContainerBounds {
  width: number;
  height: number;
  // Schema positions relative to this container
  schemaPositions: Map<string, { x: number; y: number }>;
  // Child container positions relative to this container
  childContainerPositions: Map<string, { x: number; y: number; width: number; height: number }>;
}

/**
 * Compact dagre-positioned items into a roughly square bounding box.
 * Preserves dagre's rank ordering (by Y then X).
 */
function compactToSquare(
  items: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  gap: number = 40,
): Map<string, { x: number; y: number }> {
  if (items.length <= 1) {
    const positions = new Map<string, { x: number; y: number }>();
    for (const item of items) positions.set(item.id, { x: 0, y: 0 });
    return positions;
  }

  // Sort by dagre position: Y primary, X secondary (preserves rank order)
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  // Compute total area to determine target width
  const totalArea = sorted.reduce((sum, item) => sum + (item.width + gap) * (item.height + gap), 0);
  const targetWidth = Math.sqrt(totalArea) * 1.1;

  // Shelf pack
  const positions = new Map<string, { x: number; y: number }>();
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const item of sorted) {
    // Start new row if this item would exceed target width
    if (cursorX > 0 && cursorX + item.width > targetWidth) {
      cursorX = 0;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }

    positions.set(item.id, { x: cursorX, y: cursorY });
    cursorX += item.width + gap;
    rowHeight = Math.max(rowHeight, item.height);
  }

  return positions;
}

/**
 * Extract edges from schema relationships.
 */
function extractEdges(schemas: ConstructSchema[]): MetamapV2Edge[] {
  const schemaTypes = new Set(schemas.map(s => s.type));
  const portLookup = new Map<string, Set<string>>();
  for (const s of schemas) {
    portLookup.set(s.type, new Set((s.ports || []).map(p => p.id)));
  }

  const edges: MetamapV2Edge[] = [];
  const edgeIds = new Set<string>();

  for (const schema of schemas) {
    const suggestedRelated = schema.suggestedRelated || [];
    for (let relIdx = 0; relIdx < suggestedRelated.length; relIdx++) {
      const rel = suggestedRelated[relIdx];
      if (schema.type === rel.constructType) continue;
      if (!schemaTypes.has(rel.constructType)) continue;

      const sourceHasPort = rel.fromPortId && portLookup.get(schema.type)?.has(rel.fromPortId);
      const targetHasPort = rel.toPortId && portLookup.get(rel.constructType)?.has(rel.toPortId);

      const sourceHandle = sourceHasPort ? rel.fromPortId : undefined;
      const targetHandle = targetHasPort ? rel.toPortId : undefined;

      const edgeId = `meta:${schema.type}:${sourceHandle || 'none'}->${rel.constructType}:${targetHandle || 'none'}`;

      if (edgeIds.has(edgeId)) continue;
      edgeIds.add(edgeId);

      edges.push({
        id: edgeId,
        source: schema.type,
        target: rel.constructType,
        sourceHandle,
        targetHandle,
        label: rel.label || undefined,
        sourceType: schema.type,
        relIndex: relIdx,
        fromPortId: rel.fromPortId,
        toPortId: rel.toPortId,
      });
    }
  }
  return edges;
}

/**
 * Layout schemas in a sqrt-based grid.
 */
function layoutSchemasInGrid(schemas: ConstructSchema[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (schemas.length === 0) return positions;

  const cols = Math.ceil(Math.sqrt(schemas.length));
  const GAP = 20;

  schemas.forEach((s, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    positions.set(s.type, {
      x: col * (SCHEMA_NODE_WIDTH + GAP),
      y: row * (SCHEMA_NODE_HEIGHT + GAP),
    });
  });

  return positions;
}

/**
 * Layout a group container and its contents.
 */
function layoutGroup(
  _group: SchemaGroup,
  schemas: ConstructSchema[],
): ContainerBounds {
  const schemaPositions = layoutSchemasInGrid(schemas);
  const childContainerPositions = new Map<string, { x: number; y: number; width: number; height: number }>();

  if (schemas.length === 0) {
    return {
      width: 240,
      height: 120,
      schemaPositions,
      childContainerPositions,
    };
  }

  // Compute bounds from schema positions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [_type, pos] of schemaPositions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + SCHEMA_NODE_WIDTH);
    maxY = Math.max(maxY, pos.y + SCHEMA_NODE_HEIGHT);
  }

  // Normalize positions relative to padding
  for (const [type, pos] of schemaPositions) {
    schemaPositions.set(type, {
      x: pos.x - minX + GROUP_PADDING,
      y: pos.y - minY + GROUP_PADDING + GROUP_HEADER_HEIGHT,
    });
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  return {
    width: contentWidth + GROUP_PADDING * 2,
    height: contentHeight + GROUP_PADDING + GROUP_HEADER_HEIGHT + GROUP_PADDING,
    schemaPositions,
    childContainerPositions,
  };
}

/**
 * Layout a package container and its contents (groups + ungrouped schemas).
 */
function layoutPackage(
  pkg: SchemaPackage,
  schemas: ConstructSchema[],
  groups: SchemaGroup[],
  schemasByGroup: Map<string, ConstructSchema[]>,
): ContainerBounds {
  const schemaPositions = new Map<string, { x: number; y: number }>();
  const childContainerPositions = new Map<string, { x: number; y: number; width: number; height: number }>();

  // Groups within this package
  const packageGroups = groups.filter(g => g.packageId === pkg.id);

  // Schemas directly in package (not in any group, or in an orphaned group)
  const packageGroupIds = new Set(packageGroups.map(g => g.id));
  const ungroupedSchemas = schemas.filter(s =>
    s.packageId === pkg.id && (!s.groupId || !packageGroupIds.has(s.groupId))
  );

  // Layout each group
  const groupBounds = new Map<string, ContainerBounds>();
  for (const group of packageGroups) {
    const groupSchemas = schemasByGroup.get(group.id) || [];
    const bounds = layoutGroup(group, groupSchemas);
    groupBounds.set(group.id, bounds);
  }

  // Combine groups and ungrouped schemas in a grid
  const items: { id: string; width: number; height: number; isGroup: boolean }[] = [];

  for (const [groupId, bounds] of groupBounds) {
    items.push({
      id: `group:${groupId}`,
      width: bounds.width,
      height: bounds.height,
      isGroup: true,
    });
  }

  for (const s of ungroupedSchemas) {
    items.push({
      id: s.type,
      width: SCHEMA_NODE_WIDTH,
      height: SCHEMA_NODE_HEIGHT,
      isGroup: false,
    });
  }

  if (items.length === 0) {
    return {
      width: 320,
      height: 180,
      schemaPositions,
      childContainerPositions,
    };
  }

  // Layout items in a grid
  const cols = Math.ceil(Math.sqrt(items.length));
  const GAP = 20;
  const maxItemWidth = Math.max(...items.map(i => i.width));

  // Pre-compute row heights for correct y accumulation
  const totalRows = Math.ceil(items.length / cols);
  const rowHeights: number[] = [];
  for (let r = 0; r < totalRows; r++) {
    const rowItems = items.filter((_, i) => Math.floor(i / cols) === r);
    rowHeights.push(Math.max(...rowItems.map(i => i.height)));
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  items.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = col * (maxItemWidth + GAP);
    let y = 0;
    for (let r = 0; r < row; r++) {
      y += rowHeights[r] + GAP;
    }

    if (item.isGroup) {
      const groupId = item.id.replace('group:', '');
      childContainerPositions.set(groupId, { x, y, width: item.width, height: item.height });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + item.width);
      maxY = Math.max(maxY, y + item.height);
    } else {
      schemaPositions.set(item.id, { x, y });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + SCHEMA_NODE_WIDTH);
      maxY = Math.max(maxY, y + SCHEMA_NODE_HEIGHT);
    }
  });

  // Normalize positions relative to padding
  for (const [type, pos] of schemaPositions) {
    schemaPositions.set(type, {
      x: pos.x - minX + PACKAGE_PADDING,
      y: pos.y - minY + PACKAGE_PADDING + PACKAGE_HEADER_HEIGHT,
    });
  }
  for (const [groupId, pos] of childContainerPositions) {
    childContainerPositions.set(groupId, {
      ...pos,
      x: pos.x - minX + PACKAGE_PADDING,
      y: pos.y - minY + PACKAGE_PADDING + PACKAGE_HEADER_HEIGHT,
    });
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  return {
    width: contentWidth + PACKAGE_PADDING * 2,
    height: contentHeight + PACKAGE_PADDING + PACKAGE_HEADER_HEIGHT + PACKAGE_PADDING,
    schemaPositions,
    childContainerPositions,
  };
}

/**
 * Compute the complete MetamapV2 layout.
 */
export function computeMetamapV2Layout(
  schemas: ConstructSchema[],
  schemaGroups: SchemaGroup[],
  schemaPackages: SchemaPackage[],
): MetamapV2LayoutOutput {
  const edges = extractEdges(schemas);

  if (schemas.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Filter to only packages referenced by at least one schema
  const referencedPackageIds = new Set(
    schemas.map(s => s.packageId).filter((id): id is string => !!id)
  );
  const activePackages = schemaPackages.filter(p => referencedPackageIds.has(p.id));

  // Group schemas by package
  const schemasByPackage = new Map<string, ConstructSchema[]>();
  const ungroupedSchemas: ConstructSchema[] = [];

  for (const s of schemas) {
    if (s.packageId && activePackages.some(p => p.id === s.packageId)) {
      const list = schemasByPackage.get(s.packageId) || [];
      list.push(s);
      schemasByPackage.set(s.packageId, list);
    } else {
      ungroupedSchemas.push(s);
    }
  }

  // Group schemas by group
  const schemasByGroup = new Map<string, ConstructSchema[]>();
  for (const s of schemas) {
    if (s.groupId && schemaGroups.some(g => g.id === s.groupId)) {
      const list = schemasByGroup.get(s.groupId) || [];
      list.push(s);
      schemasByGroup.set(s.groupId, list);
    }
  }

  // Layout each package
  const packageBounds = new Map<string, ContainerBounds>();
  for (const pkg of activePackages) {
    const pkgSchemas = schemasByPackage.get(pkg.id) || [];
    const bounds = layoutPackage(pkg, pkgSchemas, schemaGroups, schemasByGroup);
    packageBounds.set(pkg.id, bounds);
  }

  // Inter-package layout using dagre
  const interG = new dagre.graphlib.Graph();
  interG.setGraph({
    rankdir: 'TB',
    nodesep: 80,
    ranksep: 100,
    marginx: 0,
    marginy: 0,
  });
  interG.setDefaultEdgeLabel(() => ({}));

  // Add packages
  for (const pkg of activePackages) {
    const bounds = packageBounds.get(pkg.id)!;
    interG.setNode(`package:${pkg.id}`, { width: bounds.width, height: bounds.height });
  }

  // Add ungrouped schemas
  for (const s of ungroupedSchemas) {
    interG.setNode(s.type, { width: SCHEMA_NODE_WIDTH, height: SCHEMA_NODE_HEIGHT });
  }

  // Add inter-package edges
  const schemaToPackage = new Map<string, string>();
  for (const [pkgId, pkgSchemas] of schemasByPackage) {
    for (const s of pkgSchemas) {
      schemaToPackage.set(s.type, pkgId);
    }
  }

  function resolveToInterPackageNode(schemaType: string): string | undefined {
    const pkgId = schemaToPackage.get(schemaType);
    if (pkgId) return `package:${pkgId}`;
    return schemaType; // ungrouped schema
  }

  const addedEdges = new Set<string>();
  for (const e of edges) {
    const srcNode = resolveToInterPackageNode(e.source);
    const tgtNode = resolveToInterPackageNode(e.target);
    if (!srcNode || !tgtNode || srcNode === tgtNode) continue;

    const key = `${srcNode}->${tgtNode}`;
    if (!addedEdges.has(key)) {
      interG.setEdge(srcNode, tgtNode);
      addedEdges.add(key);
    }
  }

  dagre.layout(interG);

  // Extract dagre positions for compaction
  const dagreItems: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];

  for (const pkg of activePackages) {
    const bounds = packageBounds.get(pkg.id)!;
    const interNode = interG.node(`package:${pkg.id}`);
    dagreItems.push({
      id: `package:${pkg.id}`,
      x: interNode.x,
      y: interNode.y,
      width: bounds.width,
      height: bounds.height,
    });
  }

  for (const s of ungroupedSchemas) {
    const interNode = interG.node(s.type);
    dagreItems.push({
      id: s.type,
      x: interNode.x,
      y: interNode.y,
      width: SCHEMA_NODE_WIDTH,
      height: SCHEMA_NODE_HEIGHT,
    });
  }

  // Compact into square
  const compactedPositions = compactToSquare(dagreItems);

  // Assemble nodes
  const nodes: MetamapV2Node[] = [];

  // Emit packages and their contents
  for (const pkg of activePackages) {
    const bounds = packageBounds.get(pkg.id)!;
    const compacted = compactedPositions.get(`package:${pkg.id}`)!;
    const pkgPosition = { x: compacted.x, y: compacted.y };

    // Count schemas in package
    const pkgSchemas = schemasByPackage.get(pkg.id) || [];
    const schemaCount = pkgSchemas.length;

    // Package node
    nodes.push({
      id: `package:${pkg.id}`,
      type: 'package',
      position: pkgPosition,
      size: { width: bounds.width, height: bounds.height },
      data: {
        kind: 'package',
        pkg,
        schemaCount,
      },
    });

    // Groups within package
    const pkgGroups = schemaGroups.filter(g => g.packageId === pkg.id);
    for (const group of pkgGroups) {
      const groupPos = bounds.childContainerPositions.get(group.id);
      if (!groupPos) continue;

      const groupSchemas = schemasByGroup.get(group.id) || [];

      nodes.push({
        id: `group:${group.id}`,
        type: 'group',
        position: { x: groupPos.x, y: groupPos.y },
        size: { width: groupPos.width, height: groupPos.height },
        parentId: `package:${pkg.id}`,
        data: {
          kind: 'group',
          group,
          schemaCount: groupSchemas.length,
        },
      });

      // Schemas within group
      const tempBounds = layoutGroup(group, groupSchemas);
      for (const [schemaType, schemaPos] of tempBounds.schemaPositions) {
        const schema = groupSchemas.find(s => s.type === schemaType);
        if (schema) {
          const ports = schema.ports || [];
          const portOffsets = new Map<string, number>();
          ports.forEach((port, index) => {
            portOffsets.set(port.id, portYOffset(index, ports.length, SCHEMA_NODE_HEIGHT));
          });

          nodes.push({
            id: schemaType,
            type: 'schema',
            position: { x: schemaPos.x, y: schemaPos.y },
            size: { width: SCHEMA_NODE_WIDTH, height: SCHEMA_NODE_HEIGHT },
            parentId: `group:${group.id}`,
            data: {
              kind: 'schema',
              schema,
            },
            portOffsets,
          });
        }
      }
    }

    // Ungrouped schemas within package
    for (const [schemaType, schemaPos] of bounds.schemaPositions) {
      const schema = pkgSchemas.find(s => s.type === schemaType && !s.groupId);
      if (schema) {
        const ports = schema.ports || [];
        const portOffsets = new Map<string, number>();
        ports.forEach((port, index) => {
          portOffsets.set(port.id, portYOffset(index, ports.length, SCHEMA_NODE_HEIGHT));
        });

        nodes.push({
          id: schemaType,
          type: 'schema',
          position: { x: schemaPos.x, y: schemaPos.y },
          size: { width: SCHEMA_NODE_WIDTH, height: SCHEMA_NODE_HEIGHT },
          parentId: `package:${pkg.id}`,
          data: {
            kind: 'schema',
            schema,
          },
          portOffsets,
        });
      }
    }
  }

  // Ungrouped schemas (no package)
  for (const s of ungroupedSchemas) {
    const compacted = compactedPositions.get(s.type)!;
    const ports = s.ports || [];
    const portOffsets = new Map<string, number>();
    ports.forEach((port, index) => {
      portOffsets.set(port.id, portYOffset(index, ports.length, SCHEMA_NODE_HEIGHT));
    });

    nodes.push({
      id: s.type,
      type: 'schema',
      position: { x: compacted.x, y: compacted.y },
      size: { width: SCHEMA_NODE_WIDTH, height: SCHEMA_NODE_HEIGHT },
      data: {
        kind: 'schema',
        schema: s,
      },
      portOffsets,
    });
  }

  return { nodes, edges };
}
