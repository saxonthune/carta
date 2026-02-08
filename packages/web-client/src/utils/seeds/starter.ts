import type { DocumentAdapter, OrganizerNodeData } from '@carta/domain';
import { generateSemanticId } from '@carta/domain';

// Simple organizer color palette
const ORGANIZER_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

/**
 * Seeds a fresh document with a small starter graph so the canvas
 * isn't empty on first visit. Uses Note constructs connected with
 * symmetric links — domain-neutral and low-friction.
 * Includes an organizer containing two nodes to demonstrate grouping.
 *
 * Uses React Flow's native parentId system for organizers.
 * Organizer nodes must come BEFORE their children in the nodes array.
 */
export function starter(adapter: DocumentAdapter): void {
  const organizerId = crypto.randomUUID();
  const nodeA = crypto.randomUUID();
  const nodeB = crypto.randomUUID();
  const nodeC = crypto.randomUUID();

  const organizerColor = ORGANIZER_COLORS[0];

  // Organizer position and size
  const PADDING = 20;
  const HEADER_HEIGHT = 40;
  const organizerPosition = { x: 430, y: 40 };
  const organizerWidth = 240;
  const organizerHeight = 380;

  // Child positions are RELATIVE to the organizer
  const nodeBRelativePos = { x: PADDING, y: HEADER_HEIGHT + 20 };
  const nodeCRelativePos = { x: PADDING, y: HEADER_HEIGHT + 220 };

  adapter.setNodes([
    // Organizer FIRST (parents before children - React Flow requirement)
    {
      id: organizerId,
      type: 'organizer',
      position: organizerPosition,
      style: { width: organizerWidth, height: organizerHeight },
      data: {
        isOrganizer: true,
        name: 'Related Ideas',
        color: organizerColor,
        collapsed: false,
        layout: 'freeform',
      } satisfies OrganizerNodeData,
    },
    // Standalone node (not in organizer)
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
    // Organized nodes with parentId and relative positions
    {
      id: nodeB,
      type: 'construct',
      parentId: organizerId,
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
      parentId: organizerId,
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

  // Rename the default page
  const pages = adapter.getPages();
  if (pages.length > 0) {
    adapter.updatePage(pages[0]!.id, { name: 'Starter' });
  }
}
