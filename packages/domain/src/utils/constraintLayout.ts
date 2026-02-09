/**
 * Constraint-based layout resolver
 * Pure function — no Yjs, no side effects
 */

// Node selector — structured objects only, no string predicates
export type NodeSelector =
  | 'all'
  | { constructType: string }
  | { semanticIds: string[] };

// Constraint types
export type ArrangeConstraint =
  | { type: 'align'; axis: 'x' | 'y'; nodes?: NodeSelector; alignment?: 'center' | 'min' | 'max' }
  | { type: 'order'; axis: 'x' | 'y'; by: 'field' | 'alphabetical'; field?: string; nodes?: NodeSelector }
  | { type: 'spacing'; min?: number; equal?: boolean; nodes?: NodeSelector }
  | { type: 'group'; by: 'constructType' | 'field'; field?: string; axis?: 'x' | 'y'; groupGap?: number; nodes?: NodeSelector }
  | { type: 'distribute'; axis: 'x' | 'y'; spacing?: 'equal' | 'packed'; nodes?: NodeSelector }
  | { type: 'position'; anchor: 'top' | 'bottom' | 'left' | 'right' | 'center'; nodes?: NodeSelector; margin?: number };

export type ArrangeStrategy = 'grid' | 'preserve';

export interface ArrangeInput {
  id: string;
  semanticId: string;
  constructType: string;
  values: Record<string, unknown>; // field values for ordering
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrangeOptions {
  strategy: ArrangeStrategy;
  constraints: ArrangeConstraint[];
  nodeGap?: number; // default gap for spacing, default: 40
}

export interface ArrangeResult {
  positions: Map<string, { x: number; y: number }>; // keyed by node id
  constraintsApplied: number;
}

interface PositionMap {
  [nodeId: string]: { x: number; y: number };
}

/**
 * Resolve node selector to concrete list of nodes
 */
function resolveSelector(
  selector: NodeSelector | undefined,
  allNodes: ArrangeInput[]
): ArrangeInput[] {
  if (!selector || selector === 'all') {
    return allNodes;
  }

  if ('constructType' in selector) {
    return allNodes.filter((n) => n.constructType === selector.constructType);
  }

  if ('semanticIds' in selector) {
    const idSet = new Set(selector.semanticIds);
    return allNodes.filter((n) => idSet.has(n.semanticId));
  }

  return allNodes;
}

/**
 * Calculate centroid of a set of positions
 */
function calculateCentroid(positions: PositionMap, nodeIds: string[]): { x: number; y: number } {
  if (nodeIds.length === 0) {
    return { x: 0, y: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  for (const id of nodeIds) {
    const pos = positions[id];
    if (pos) {
      sumX += pos.x;
      sumY += pos.y;
    }
  }

  return {
    x: sumX / nodeIds.length,
    y: sumY / nodeIds.length,
  };
}

/**
 * Apply 'grid' base strategy: arrange nodes in a grid pattern
 */
function applyGridStrategy(nodes: ArrangeInput[], nodeGap: number): PositionMap {
  const positions: PositionMap = {};

  if (nodes.length === 0) {
    return positions;
  }

  const cols = Math.ceil(Math.sqrt(nodes.length));
  const colWidth = Math.max(...nodes.map((n) => n.width)) + nodeGap;
  const rowHeight = Math.max(...nodes.map((n) => n.height)) + nodeGap;

  nodes.forEach((node, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    positions[node.id] = {
      x: col * colWidth,
      y: row * rowHeight,
    };
  });

  return positions;
}

/**
 * Apply 'preserve' base strategy: keep current positions
 */
function applyPreserveStrategy(nodes: ArrangeInput[]): PositionMap {
  const positions: PositionMap = {};
  nodes.forEach((node) => {
    positions[node.id] = { x: node.x, y: node.y };
  });
  return positions;
}

/**
 * Apply 'align' constraint: set all selected nodes' position on given axis to alignment value
 */
function applyAlignConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'align' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length === 0) return;

  const { axis, alignment = 'center' } = constraint;

  // Get current positions on the target axis
  const values = selectedNodes.map((n) => positions[n.id]![axis]);

  let targetValue: number;
  switch (alignment) {
    case 'min':
      targetValue = Math.min(...values);
      break;
    case 'max':
      targetValue = Math.max(...values);
      break;
    case 'center':
    default:
      targetValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      break;
  }

  // Set all selected nodes to the target value on the axis
  selectedNodes.forEach((n) => {
    positions[n.id]![axis] = targetValue;
  });
}

/**
 * Apply 'order' constraint: sort selected nodes along given axis
 */
function applyOrderConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'order' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap,
  nodeGap: number
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length === 0) return;

  const { axis, by, field } = constraint;

  // Sort nodes
  const sortedNodes = [...selectedNodes].sort((a, b) => {
    if (by === 'alphabetical') {
      return a.semanticId.localeCompare(b.semanticId);
    } else if (by === 'field' && field) {
      const aVal = a.values[field];
      const bVal = b.values[field];
      // Undefined sorts last
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      // String comparison
      return String(aVal).localeCompare(String(bVal));
    }
    return 0;
  });

  // Calculate original centroid
  const originalCentroid = calculateCentroid(
    positions,
    selectedNodes.map((n) => n.id)
  );

  // Get node dimensions on ordering axis
  const nodeSizes = sortedNodes.map((n) => (axis === 'x' ? n.width : n.height));
  const totalSize = nodeSizes.reduce((sum, size) => sum + size, 0);
  const totalGaps = (sortedNodes.length - 1) * nodeGap;
  const totalExtent = totalSize + totalGaps;

  // Distribute nodes along the axis, centered on original centroid
  let currentOffset = originalCentroid[axis] - totalExtent / 2;

  sortedNodes.forEach((node, idx) => {
    const size = nodeSizes[idx]!;
    positions[node.id]![axis] = currentOffset;
    currentOffset += size + nodeGap;
    // Preserve cross-axis position
  });
}

/**
 * Apply 'spacing' constraint: adjust gaps between selected nodes
 */
function applySpacingConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'spacing' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap,
  _defaultNodeGap: number
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length < 2) return;

  const { min, equal } = constraint;

  if (min !== undefined) {
    // Ensure minimum spacing between all pairs
    // Simple approach: for each pair, if too close, push the second one away
    // Sort by x then y for consistent ordering
    const sorted = [...selectedNodes].sort((a, b) => {
      const aPos = positions[a.id]!;
      const bPos = positions[b.id]!;
      if (Math.abs(aPos.x - bPos.x) > 0.1) return aPos.x - bPos.x;
      return aPos.y - bPos.y;
    });

    // Check and adjust horizontal spacing
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]!;
      const next = sorted[i + 1]!;
      const currentPos = positions[current.id]!;
      const nextPos = positions[next.id]!;

      const currentRight = currentPos.x + current.width;
      const gap = nextPos.x - currentRight;

      if (gap < min) {
        // Push next node to the right
        const shift = min - gap;
        positions[next.id]!.x += shift;
      }
    }

    // Check and adjust vertical spacing
    const sortedByY = [...selectedNodes].sort((a, b) => {
      const aPos = positions[a.id]!;
      const bPos = positions[b.id]!;
      if (Math.abs(aPos.y - bPos.y) > 0.1) return aPos.y - bPos.y;
      return aPos.x - bPos.x;
    });

    for (let i = 0; i < sortedByY.length - 1; i++) {
      const current = sortedByY[i]!;
      const next = sortedByY[i + 1]!;
      const currentPos = positions[current.id]!;
      const nextPos = positions[next.id]!;

      const currentBottom = currentPos.y + current.height;
      const gap = nextPos.y - currentBottom;

      if (gap < min) {
        // Push next node down
        const shift = min - gap;
        positions[next.id]!.y += shift;
      }
    }
  }

  if (equal) {
    // Detect primary axis (axis with more variance)
    const xValues = selectedNodes.map((n) => positions[n.id]!.x);
    const yValues = selectedNodes.map((n) => positions[n.id]!.y);

    const xVariance =
      xValues.reduce((sum, v) => sum + v * v, 0) / xValues.length -
      Math.pow(
        xValues.reduce((sum, v) => sum + v, 0) / xValues.length,
        2
      );
    const yVariance =
      yValues.reduce((sum, v) => sum + v * v, 0) / yValues.length -
      Math.pow(
        yValues.reduce((sum, v) => sum + v, 0) / yValues.length,
        2
      );

    const primaryAxis = xVariance > yVariance ? 'x' : 'y';

    // Sort by primary axis
    const sorted = [...selectedNodes].sort(
      (a, b) => positions[a.id]![primaryAxis] - positions[b.id]![primaryAxis]
    );

    if (sorted.length < 2) return;

    // Calculate equal spacing
    const firstPos = positions[sorted[0]!.id]![primaryAxis];
    const lastPos = positions[sorted[sorted.length - 1]!.id]![primaryAxis];
    const span = lastPos - firstPos;
    const equalGap = span / (sorted.length - 1);

    // Redistribute
    sorted.forEach((node, idx) => {
      if (idx > 0 && idx < sorted.length - 1) {
        positions[node.id]![primaryAxis] = firstPos + idx * equalGap;
      }
    });
  }
}

/**
 * Apply 'group' constraint: cluster nodes by constructType or field value.
 * Groups are arranged along the specified axis with groupGap between clusters.
 * Within each cluster, relative positions are preserved.
 */
function applyGroupConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'group' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap,
  nodeGap: number
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length === 0) return;

  const { by, field, axis = 'x', groupGap } = constraint;
  const gap = groupGap ?? nodeGap * 2; // default: 2x normal gap

  // 1. Partition nodes into groups
  const groups = new Map<string, ArrangeInput[]>();
  for (const node of selectedNodes) {
    let key: string;
    if (by === 'constructType') {
      key = node.constructType;
    } else if (by === 'field' && field) {
      key = String(node.values[field] ?? '__undefined__');
    } else {
      key = node.constructType; // fallback
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  // 2. Sort group keys alphabetically for deterministic output
  const sortedKeys = [...groups.keys()].sort();

  // 3. For each group, compute its bounding box in current positions
  const groupBounds: Array<{ key: string; nodes: ArrangeInput[]; minA: number; maxA: number; width: number }> = [];
  for (const key of sortedKeys) {
    const nodes = groups.get(key)!;
    const axisValues = nodes.map(n => positions[n.id]![axis]);
    const sizes = nodes.map(n => axis === 'x' ? n.width : n.height);
    const minA = Math.min(...axisValues);
    const maxA = Math.max(...axisValues.map((v, i) => v + sizes[i]!));
    groupBounds.push({ key, nodes, minA, maxA, width: maxA - minA });
  }

  // 4. Calculate original centroid of all selected nodes on this axis
  const allAxisValues = selectedNodes.map(n => positions[n.id]![axis]);
  const allSizes = selectedNodes.map(n => axis === 'x' ? n.width : n.height);
  const originalCenter = (Math.min(...allAxisValues) + Math.max(...allAxisValues.map((v, i) => v + allSizes[i]!))) / 2;

  // 5. Lay out groups sequentially along axis with groupGap
  const totalWidth = groupBounds.reduce((sum, g) => sum + g.width, 0) + (groupBounds.length - 1) * gap;
  let cursor = originalCenter - totalWidth / 2;

  for (const group of groupBounds) {
    // Shift all nodes in this group so group's min aligns with cursor
    const shift = cursor - group.minA;
    for (const node of group.nodes) {
      positions[node.id]![axis] += shift;
    }
    cursor += group.width + gap;
  }
}

/**
 * Apply 'distribute' constraint: evenly distribute nodes along an axis.
 * 'equal' mode: equal center-to-center spacing (anchors first and last).
 * 'packed' mode: equal edge-to-edge gaps (anchors first and last).
 */
function applyDistributeConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'distribute' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length < 3) return; // need at least 3 to distribute

  const { axis, spacing = 'equal' } = constraint;

  // Sort nodes by current position on axis
  const sorted = [...selectedNodes].sort(
    (a, b) => positions[a.id]![axis] - positions[b.id]![axis]
  );

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const firstPos = positions[first.id]![axis];
  const lastPos = positions[last.id]![axis];

  if (spacing === 'equal') {
    // Equal center-to-center spacing
    const totalSpan = lastPos - firstPos;
    const step = totalSpan / (sorted.length - 1);

    for (let i = 1; i < sorted.length - 1; i++) {
      positions[sorted[i]!.id]![axis] = firstPos + i * step;
    }
  } else {
    // Packed: equal edge-to-edge gaps
    const nodeSizes = sorted.map(n => axis === 'x' ? n.width : n.height);
    const totalNodeSize = nodeSizes.reduce((sum, s) => sum + s, 0);
    const lastSize = axis === 'x' ? last.width : last.height;
    const availableSpace = (lastPos + lastSize) - firstPos - totalNodeSize;
    const gapSize = availableSpace / (sorted.length - 1);

    let cursor = firstPos + nodeSizes[0]! + gapSize;
    for (let i = 1; i < sorted.length - 1; i++) {
      positions[sorted[i]!.id]![axis] = cursor;
      cursor += nodeSizes[i]! + gapSize;
    }
  }
}

/**
 * Apply 'position' constraint: anchor node set to a bounding box edge/center.
 * The bounding box is computed from ALL nodes (not just selected), giving a canvas reference frame.
 * 'margin' offsets from the edge inward.
 */
function applyPositionConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'position' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length === 0) return;

  const { anchor, margin = 0 } = constraint;

  // Compute bounding box of ALL nodes (full canvas extent)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of allNodes) {
    const pos = positions[node.id];
    if (!pos) continue;
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + node.width);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y + node.height);
  }

  // Apply anchor
  for (const node of selectedNodes) {
    const pos = positions[node.id]!;
    switch (anchor) {
      case 'top':
        pos.y = minY + margin;
        break;
      case 'bottom':
        pos.y = maxY - node.height - margin;
        break;
      case 'left':
        pos.x = minX + margin;
        break;
      case 'right':
        pos.x = maxX - node.width - margin;
        break;
      case 'center': {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        pos.x = centerX - node.width / 2;
        pos.y = centerY - node.height / 2;
        break;
      }
    }
  }
}

/**
 * Main constraint layout resolver
 */
export function computeArrangeLayout(nodes: ArrangeInput[], options: ArrangeOptions): ArrangeResult {
  const nodeGap = options.nodeGap ?? 40;

  // 1. Apply base strategy
  let positions: PositionMap;
  if (options.strategy === 'grid') {
    positions = applyGridStrategy(nodes, nodeGap);
  } else {
    positions = applyPreserveStrategy(nodes);
  }

  // Calculate original centroid
  const originalCentroid = calculateCentroid(
    positions,
    nodes.map((n) => n.id)
  );

  // 2. Apply constraints sequentially
  let constraintsApplied = 0;

  for (const constraint of options.constraints) {
    switch (constraint.type) {
      case 'align':
        applyAlignConstraint(constraint, nodes, nodes, positions);
        break;
      case 'order':
        applyOrderConstraint(constraint, nodes, nodes, positions, nodeGap);
        break;
      case 'spacing':
        applySpacingConstraint(constraint, nodes, nodes, positions, nodeGap);
        break;
      case 'group':
        applyGroupConstraint(constraint, nodes, nodes, positions, nodeGap);
        break;
      case 'distribute':
        applyDistributeConstraint(constraint, nodes, nodes, positions);
        break;
      case 'position':
        applyPositionConstraint(constraint, nodes, nodes, positions);
        break;
    }
    constraintsApplied++;
  }

  // 3. Preserve centroid - shift all positions so group centroid matches original
  const newCentroid = calculateCentroid(
    positions,
    nodes.map((n) => n.id)
  );
  const shiftX = originalCentroid.x - newCentroid.x;
  const shiftY = originalCentroid.y - newCentroid.y;

  Object.keys(positions).forEach((id) => {
    positions[id]!.x += shiftX;
    positions[id]!.y += shiftY;
  });

  // 4. Convert to Map and return
  const result = new Map<string, { x: number; y: number }>();
  Object.entries(positions).forEach(([id, pos]) => {
    result.set(id, pos);
  });

  return {
    positions: result,
    constraintsApplied,
  };
}
