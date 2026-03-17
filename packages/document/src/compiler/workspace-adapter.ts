import type { CanvasFile, SchemasFile } from '../workspace-format.js';
import type { CompilerNode, CompilerEdge } from '@carta/schema';
import { compiler } from './index.js';

/**
 * Compile a workspace canvas file to AI-readable output.
 *
 * Adapts the workspace file types (CanvasFile + SchemasFile) to the
 * CompilerEngine's input format (CompilerNode[] + CompilerEdge[]).
 */
export function compileCanvasFile(canvas: CanvasFile, schemas: SchemasFile): string {
  const nodes = canvas.nodes as CompilerNode[];
  const edges = canvas.edges as CompilerEdge[];

  return compiler.compile(nodes, edges, {
    schemas: schemas.schemas,
  });
}
