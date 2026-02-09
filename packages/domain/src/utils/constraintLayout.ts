/**
 * Constraint-based layout resolver
 * Pure function — no Yjs, no side effects
 */

// Node selector — structured objects only, no string predicates
export type NodeSelector =
  | 'all'
  | { constructType: string }
  | { semanticIds: string[] };

// Constraint types for Phase 1
export type ArrangeConstraint =
  | { type: 'align'; axis: 'x' | 'y'; nodes?: NodeSelector; alignment?: 'center' | 'min' | 'max' }
  | { type: 'order'; axis: 'x' | 'y'; by: 'field' | 'alphabetical'; field?: string; nodes?: NodeSelector }
  | { type: 'spacing'; min?: number; equal?: boolean; nodes?: NodeSelector };

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
  nodes: ArrangeInput[],
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
  nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap,
  nodeGap: number
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length === 0) return;

  const { axis, by, field } = constraint;
  const crossAxis = axis === 'x' ? 'y' : 'x';

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
  nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap,
  defaultNodeGap: number
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
