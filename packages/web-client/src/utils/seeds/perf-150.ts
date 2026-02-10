import type { DocumentAdapter } from '@carta/domain';
import { generateSemanticId } from '@carta/domain';

/**
 * Seeds 150 note constructs in a grid layout for performance testing.
 * No organizers, no edges — pure node rendering stress test.
 */
export function perf150(adapter: DocumentAdapter): void {
  const COLS = 15;
  const X_GAP = 220;
  const Y_GAP = 160;

  const nodes: unknown[] = [];

  for (let i = 0; i < 150; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    nodes.push({
      id: crypto.randomUUID(),
      type: 'construct',
      position: { x: col * X_GAP, y: row * Y_GAP },
      data: {
        constructType: 'note',
        semanticId: generateSemanticId('note'),
        values: { content: `Node ${i + 1}` },
        detailMode: 'summary',
      },
    });
  }

  adapter.setNodes(nodes);
}
