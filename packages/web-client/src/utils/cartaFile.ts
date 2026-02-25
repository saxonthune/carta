import type { CartaNode, CartaEdge } from '@carta/types';
import type { ConstructSchema, PortSchema, SchemaGroup, SchemaPackage, Page, SchemaPackageDefinition, Resource } from '@carta/domain';
import { toKebabCase } from '@carta/domain';
import {
  CARTA_FILE_VERSION,
  validateCartaFile,
} from '@carta/document';
import type { CartaFile, CartaFilePage } from '@carta/document';
import type { ExportOptions } from './exportAnalyzer';

// Re-export for convenience
export { generateSemanticId } from '@carta/domain';
export { CARTA_FILE_VERSION, validateCartaFile, importProjectFromString } from '@carta/document';
export type { CartaFile, CartaFilePage } from '@carta/document';

/**
 * Export project data to a .carta file
 */
export function exportProject(data: {
  title: string;
  description?: string;
  pages: Page[];
  customSchemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
  schemaPackages: SchemaPackage[];
  resources?: Resource[];
}, options?: ExportOptions): void {
  // Convert pages to file format
  const filePages: CartaFilePage[] = data.pages.map(page => ({
    id: page.id,
    name: page.name,
    description: page.description,
    order: page.order,
    nodes: (options?.nodes !== false ? page.nodes : []) as CartaNode[],
    edges: (options?.nodes !== false ? page.edges : []) as CartaEdge[],
  }));

  const cartaFile: CartaFile = {
    version: CARTA_FILE_VERSION,
    title: data.title,
    description: data.description,
    pages: filePages,
    customSchemas: options?.schemas !== false ? data.customSchemas : [],
    portSchemas: options?.portSchemas !== false ? data.portSchemas : [],
    schemaGroups: options?.schemaGroups !== false ? data.schemaGroups : [],
    schemaPackages: data.schemaPackages,
    resources: data.resources && data.resources.length > 0 ? data.resources : undefined,
    exportedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(cartaFile, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `${toKebabCase(data.title) || 'untitled'}.carta`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate a .carta file
 */
export async function importProject(file: File): Promise<CartaFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        const validated = validateCartaFile(data);
        resolve(validated);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Download a schema package as a .carta-schemas file
 */
export function downloadCartaSchemas(definition: SchemaPackageDefinition): void {
  const wrapper = {
    formatVersion: 1,
    type: 'carta-schemas',
    package: definition,
  };
  const json = JSON.stringify(wrapper, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `${definition.name.toLowerCase().replace(/\s+/g, '-')}.carta-schemas`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
