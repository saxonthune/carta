import type { DocumentAdapter, VisualGroupNodeData } from '@carta/domain';
import { generateSemanticId } from '@carta/domain';
import { generateDeployableColor } from '@carta/document';

/**
 * Seeds a fresh document with a small starter graph so the canvas
 * isn't empty on first visit. Uses Note constructs connected with
 * symmetric links — domain-neutral and low-friction.
 * Includes a visual group containing two nodes to demonstrate grouping.
 *
 * Uses React Flow's native parentId system for visual groups.
 * Group nodes must come BEFORE their children in the nodes array.
 */
export function seedStarterContent(adapter: DocumentAdapter): void {
  const groupId = crypto.randomUUID();
  const nodeA = crypto.randomUUID();
  const nodeB = crypto.randomUUID();
  const nodeC = crypto.randomUUID();

  const groupColor = generateDeployableColor();

  // Group position and size
  const GROUP_PADDING = 20;
  const GROUP_HEADER_HEIGHT = 40;
  const groupPosition = { x: 430, y: 40 };
  const groupWidth = 240;
  const groupHeight = 380;

  // Child positions are RELATIVE to the group
  const nodeBRelativePos = { x: GROUP_PADDING, y: GROUP_HEADER_HEIGHT + 20 };
  const nodeCRelativePos = { x: GROUP_PADDING, y: GROUP_HEADER_HEIGHT + 220 };

  adapter.setNodes([
    // Group FIRST (parents before children - React Flow requirement)
    {
      id: groupId,
      type: 'visual-group',
      position: groupPosition,
      style: { width: groupWidth, height: groupHeight },
      data: {
        isVisualGroup: true,
        name: 'Related Ideas',
        color: groupColor,
        collapsed: false,
      } satisfies VisualGroupNodeData,
    },
    // Standalone node (not in group)
    {
      id: nodeA,
      type: 'construct',
      position: { x: 100, y: 200 },
      data: {
        constructType: 'note',
        semanticId: generateSemanticId('note'),
        values: { content: 'Your idea starts here' },
        viewLevel: 'summary',
      },
    },
    // Grouped nodes with parentId and relative positions
    {
      id: nodeB,
      type: 'construct',
      parentId: groupId,
      extent: 'parent',
      position: nodeBRelativePos,
      data: {
        constructType: 'note',
        semanticId: generateSemanticId('note'),
        values: { content: 'Break it into pieces' },
        viewLevel: 'summary',
      },
    },
    {
      id: nodeC,
      type: 'construct',
      parentId: groupId,
      extent: 'parent',
      position: nodeCRelativePos,
      data: {
        constructType: 'note',
        semanticId: generateSemanticId('note'),
        values: { content: 'Connect them together' },
        viewLevel: 'summary',
      },
    },
  ]);

  adapter.setEdges([
    {
      id: `edge-${crypto.randomUUID()}`,
      source: nodeA,
      target: nodeB,
      sourceHandle: 'link',
      targetHandle: 'link',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: nodeA,
      target: nodeC,
      sourceHandle: 'link',
      targetHandle: 'link',
    },
  ]);
}
