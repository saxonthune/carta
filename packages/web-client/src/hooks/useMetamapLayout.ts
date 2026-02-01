import { useState, useMemo, useCallback } from 'react';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { ConstructSchema, SchemaGroup } from '@carta/domain';
import type { SchemaGroupNodeData } from '../components/metamap/SchemaGroupNode';

const SCHEMA_NODE_WIDTH = 280;
const GROUP_PADDING_X = 40;
const GROUP_PADDING_TOP = 60;
const GROUP_PADDING_BOTTOM = 40;

function estimateSchemaNodeHeight(schema: ConstructSchema): number {
  const header = 52;
  const fields = schema.fields.length * 20 + (schema.fields.length > 0 ? 28 : 0);
  const ports = (schema.ports?.length || 0) * 20 + ((schema.ports?.length || 0) > 0 ? 28 : 0);
  return header + fields + ports + 16;
}

function getRootGroup(groupId: string | undefined, groups: SchemaGroup[]): string | undefined {
  if (!groupId) return undefined;
  const groupMap = new Map(groups.map(g => [g.id, g]));
  let current = groupId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    const group = groupMap.get(current);
    if (!group?.parentId) return current;
    current = group.parentId;
  }
  return current;
}

function extractEdges(schemas: ConstructSchema[]): Edge[] {
  const schemaTypes = new Set(schemas.map(s => s.type));
  // Build port lookup: schemaType -> Set of port IDs
  const portLookup = new Map<string, Set<string>>();
  for (const s of schemas) {
    portLookup.set(s.type, new Set((s.ports || []).map(p => p.id)));
  }

  const edges: Edge[] = [];
  const edgeIds = new Set<string>();

  for (const schema of schemas) {
    for (const rel of schema.suggestedRelated || []) {
      // Skip self-referential edges
      if (schema.type === rel.constructType) continue;

      // Skip edges to non-existent schemas
      if (!schemaTypes.has(rel.constructType)) continue;

      // Validate port handles exist on their respective schemas
      const sourceHasPort = rel.fromPortId && portLookup.get(schema.type)?.has(rel.fromPortId);
      const targetHasPort = rel.toPortId && portLookup.get(rel.constructType)?.has(rel.toPortId);

      const sourceHandle = sourceHasPort ? rel.fromPortId : 'meta-connect';
      const targetHandle = targetHasPort ? rel.toPortId : 'meta-connect';

      const edgeId = `meta:${schema.type}:${sourceHandle}->${rel.constructType}:${targetHandle}`;

      // Skip duplicate edges
      if (edgeIds.has(edgeId)) continue;
      edgeIds.add(edgeId);

      edges.push({
        id: edgeId,
        source: schema.type,
        target: rel.constructType,
        sourceHandle,
        targetHandle,
        label: rel.label || '',
        style: { strokeDasharray: '6 3', stroke: '#94a3b8' },
        animated: false,
      });
    }
  }
  return edges;
}

export function useMetamapLayout(
  schemas: ConstructSchema[],
  schemaGroups: SchemaGroup[]
) {
  const [layoutVersion, setLayoutVersion] = useState(0);

  const reLayout = useCallback(() => {
    setLayoutVersion(v => v + 1);
  }, []);

  const edges = useMemo(() => extractEdges(schemas), [schemas]);

  const nodes = useMemo(() => {
    // Force dependency on layoutVersion for re-layout trigger
    void layoutVersion;

    if (schemas.length === 0) return [];

    // Map each schema to its root group
    const schemaRootGroup = new Map<string, string | undefined>();
    for (const s of schemas) {
      schemaRootGroup.set(s.type, getRootGroup(s.groupId, schemaGroups));
    }

    // Collect schemas per root group
    const groupSchemas = new Map<string, ConstructSchema[]>();
    const ungroupedSchemas: ConstructSchema[] = [];
    for (const s of schemas) {
      const rootId = schemaRootGroup.get(s.type);
      if (rootId) {
        const list = groupSchemas.get(rootId) || [];
        list.push(s);
        groupSchemas.set(rootId, list);
      } else {
        ungroupedSchemas.push(s);
      }
    }

    // Root-level groups that have schemas
    const activeGroupIds = [...groupSchemas.keys()];
    const groupMap = new Map(schemaGroups.map(g => [g.id, g]));

    // Phase 1: Intra-group layout
    const groupBounds = new Map<string, { width: number; height: number; nodePositions: Map<string, { x: number; y: number }> }>();

    for (const gId of activeGroupIds) {
      const gSchemas = groupSchemas.get(gId)!;
      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
      g.setDefaultEdgeLabel(() => ({}));

      for (const s of gSchemas) {
        g.setNode(s.type, { width: SCHEMA_NODE_WIDTH, height: estimateSchemaNodeHeight(s) });
      }

      // Intra-group edges
      const gTypes = new Set(gSchemas.map(s => s.type));
      for (const e of edges) {
        if (gTypes.has(e.source) && gTypes.has(e.target)) {
          g.setEdge(e.source, e.target);
        }
      }

      dagre.layout(g);

      const nodePositions = new Map<string, { x: number; y: number }>();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const s of gSchemas) {
        const node = g.node(s.type);
        const x = node.x - SCHEMA_NODE_WIDTH / 2;
        const y = node.y - node.height / 2;
        nodePositions.set(s.type, { x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + SCHEMA_NODE_WIDTH);
        maxY = Math.max(maxY, y + node.height);
      }

      // Normalize positions to start at padding offset
      for (const [type, pos] of nodePositions) {
        nodePositions.set(type, {
          x: pos.x - minX + GROUP_PADDING_X,
          y: pos.y - minY + GROUP_PADDING_TOP,
        });
      }

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      groupBounds.set(gId, {
        width: contentWidth + GROUP_PADDING_X * 2,
        height: contentHeight + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM,
        nodePositions,
      });
    }

    // Also include empty groups (no schemas but still render as drop targets)
    const emptyGroupIds = schemaGroups
      .filter(g => !g.parentId && !groupSchemas.has(g.id))
      .map(g => g.id);

    for (const gId of emptyGroupIds) {
      groupBounds.set(gId, {
        width: 240,
        height: 160,
        nodePositions: new Map(),
      });
    }

    // Phase 2: Inter-group layout (TB for better visibility on 16:9 monitors)
    const interG = new dagre.graphlib.Graph();
    interG.setGraph({ rankdir: 'TB', nodesep: 120, ranksep: 80 });
    interG.setDefaultEdgeLabel(() => ({}));

    for (const [gId, bounds] of groupBounds) {
      interG.setNode(`group:${gId}`, { width: bounds.width, height: bounds.height });
    }
    for (const s of ungroupedSchemas) {
      interG.setNode(s.type, { width: SCHEMA_NODE_WIDTH, height: estimateSchemaNodeHeight(s) });
    }

    // Cross-group and ungrouped edges (deduplicated by group pair)
    const addedGroupEdges = new Set<string>();
    for (const e of edges) {
      const srcRoot = schemaRootGroup.get(e.source);
      const tgtRoot = schemaRootGroup.get(e.target);

      if (srcRoot && tgtRoot && srcRoot !== tgtRoot) {
        const key = `group:${srcRoot}->group:${tgtRoot}`;
        if (!addedGroupEdges.has(key)) {
          interG.setEdge(`group:${srcRoot}`, `group:${tgtRoot}`);
          addedGroupEdges.add(key);
        }
      } else if (srcRoot && !tgtRoot) {
        interG.setEdge(`group:${srcRoot}`, e.target);
      } else if (!srcRoot && tgtRoot) {
        interG.setEdge(e.source, `group:${tgtRoot}`);
      } else if (!srcRoot && !tgtRoot) {
        interG.setEdge(e.source, e.target);
      }
    }

    dagre.layout(interG);

    // Assembly
    const result: Node[] = [];

    // Group container nodes first (React Flow requires parents before children)
    const allGroupIds = [...activeGroupIds, ...emptyGroupIds];
    for (const gId of allGroupIds) {
      const bounds = groupBounds.get(gId)!;
      const interNode = interG.node(`group:${gId}`);
      const group = groupMap.get(gId);

      result.push({
        id: `group:${gId}`,
        type: 'schema-group',
        position: {
          x: interNode.x - bounds.width / 2,
          y: interNode.y - bounds.height / 2,
        },
        style: { width: bounds.width, height: bounds.height },
        data: {
          groupId: gId,
          label: group?.name || gId,
          color: group?.color || '#6366f1',
          description: group?.description,
        } satisfies SchemaGroupNodeData,
        draggable: true,
        selectable: true,
      });
    }

    // Schema nodes
    for (const s of schemas) {
      const rootGroupId = schemaRootGroup.get(s.type);

      if (rootGroupId && groupBounds.has(rootGroupId)) {
        const bounds = groupBounds.get(rootGroupId)!;
        const pos = bounds.nodePositions.get(s.type);
        if (pos) {
          result.push({
            id: s.type,
            type: 'schema-node',
            position: pos,
            parentId: `group:${rootGroupId}`,
            extent: 'parent' as const,
            data: { schema: s },
          });
        }
      } else {
        // Ungrouped: absolute position from phase 2
        const interNode = interG.node(s.type);
        result.push({
          id: s.type,
          type: 'schema-node',
          position: {
            x: interNode.x - SCHEMA_NODE_WIDTH / 2,
            y: interNode.y - estimateSchemaNodeHeight(s) / 2,
          },
          data: { schema: s },
        });
      }
    }

    return result;
  }, [schemas, schemaGroups, edges, layoutVersion]);

  return { nodes, edges, reLayout };
}
