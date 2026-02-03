import type { DocumentAdapter } from '@carta/domain';
import { generateSemanticId } from '@carta/domain';

/**
 * Seeds a fresh document with a small starter graph so the canvas
 * isn't empty on first visit. Uses Note constructs connected with
 * symmetric links — domain-neutral and low-friction.
 */
export function seedStarterContent(adapter: DocumentAdapter): void {
  const nodeA = crypto.randomUUID();
  const nodeB = crypto.randomUUID();
  const nodeC = crypto.randomUUID();

  adapter.setNodes([
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
    {
      id: nodeB,
      type: 'construct',
      position: { x: 450, y: 100 },
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
      position: { x: 450, y: 300 },
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
