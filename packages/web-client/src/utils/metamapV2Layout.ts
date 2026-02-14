import dagre from '@dagrejs/dagre';
import type { ConstructSchema, SchemaGroup, SchemaPackage } from '@carta/domain';

// Layout constants
const SCHEMA_NODE_WIDTH = 220;
const SCHEMA_NODE_HEIGHT = 80;
const GROUP_PADDING = 30;
const GROUP_HEADER_HEIGHT = 36;
const PACKAGE_PADDING = 40;
const PACKAGE_HEADER_HEIGHT = 48;

export interface MetamapV2Node {
  id: string;
  type: 'schema' | 'package' | 'group';
  position: { x: number; y: number };
  size: { width: number; height: number };
  parentId?: string;  // container this node belongs to
  data: SchemaNodeData | PackageNodeData | GroupNodeData;
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
    for (const rel of schema.suggestedRelated || []) {
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

  // Schemas directly in package (not in any group)
  const ungroupedSchemas = schemas.filter(s => s.packageId === pkg.id && !s.groupId);

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
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  items.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    // Use max item width for uniform columns
    const maxItemWidth = Math.max(...items.map(i => i.width));
    const x = col * (maxItemWidth + GAP);
    const y = row * (Math.max(...items.filter((_, i) => Math.floor(i / cols) === row).map(i => i.height)) + GAP) * row;

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

  // Group schemas by package
  const schemasByPackage = new Map<string, ConstructSchema[]>();
  const ungroupedSchemas: ConstructSchema[] = [];

  for (const s of schemas) {
    if (s.packageId && schemaPackages.some(p => p.id === s.packageId)) {
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
  for (const pkg of schemaPackages) {
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
  for (const pkg of schemaPackages) {
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

  // Assemble nodes
  const nodes: MetamapV2Node[] = [];

  // Emit packages and their contents
  for (const pkg of schemaPackages) {
    const bounds = packageBounds.get(pkg.id)!;
    const interNode = interG.node(`package:${pkg.id}`);
    const pkgPosition = {
      x: interNode.x - bounds.width / 2,
      y: interNode.y - bounds.height / 2,
    };

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
          });
        }
      }
    }

    // Ungrouped schemas within package
    for (const [schemaType, schemaPos] of bounds.schemaPositions) {
      const schema = pkgSchemas.find(s => s.type === schemaType && !s.groupId);
      if (schema) {
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
        });
      }
    }
  }

  // Ungrouped schemas (no package)
  for (const s of ungroupedSchemas) {
    const interNode = interG.node(s.type);
    nodes.push({
      id: s.type,
      type: 'schema',
      position: {
        x: interNode.x - SCHEMA_NODE_WIDTH / 2,
        y: interNode.y - SCHEMA_NODE_HEIGHT / 2,
      },
      size: { width: SCHEMA_NODE_WIDTH, height: SCHEMA_NODE_HEIGHT },
      data: {
        kind: 'schema',
        schema: s,
      },
    });
  }

  return { nodes, edges };
}
