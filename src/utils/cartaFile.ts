import type { Node, Edge } from '@xyflow/react';
import type { Deployable, ConstructSchema } from '../constructs/types';
import type { ExportOptions } from './exportAnalyzer';

/**
 * Version of the .carta file format
 */
export const CARTA_FILE_VERSION = 1;

/**
 * Structure of a .carta project file
 */
export interface CartaFile {
  version: number;
  title: string;
  nodeId: number;
  nodes: Node[];
  edges: Edge[];
  deployables: Deployable[];
  customSchemas: ConstructSchema[];
  exportedAt: string;
}

/**
 * Convert a string to kebab-case
 * "My Project Name" -> "my-project-name"
 */
export function toKebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .replace(/-+/g, '-');         // Replace multiple hyphens with single
}

/**
 * Generate a semantic ID for AI consumption
 * Combines construct type and name into a readable identifier
 * "User Controller" -> "controller-user"
 */
export function generateSemanticId(constructType: string, name: string): string {
  // Normalize the name: lowercase, replace spaces with hyphens, remove special chars
  const normalizedName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens

  // Normalize the type: lowercase, remove underscores
  const normalizedType = constructType
    .toLowerCase()
    .replace(/_/g, '-');

  // Combine: type-name (e.g., "controller-user-api")
  const semanticId = `${normalizedType}-${normalizedName}`;

  // Ensure it's not empty and has reasonable length
  return semanticId || `${normalizedType}-unnamed`;
}

/**
 * Export project data to a .carta file
 */
export function exportProject(data: Omit<CartaFile, 'version' | 'exportedAt'>, options?: ExportOptions): void {
  // Apply export options to filter data
  const filteredData: Omit<CartaFile, 'version' | 'exportedAt'> = {
    title: data.title,
    nodeId: data.nodeId,
    nodes: options?.nodes !== false ? data.nodes : [],
    edges: options?.nodes !== false ? data.edges : [],
    deployables: options?.deployables !== false ? data.deployables : [],
    customSchemas: options?.schemas !== false ? data.customSchemas : [],
  };

  const cartaFile: CartaFile = {
    version: CARTA_FILE_VERSION,
    ...filteredData,
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
 * Validate the structure of a .carta file
 */
export function validateCartaFile(data: unknown): CartaFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid file: expected JSON object');
  }
  
  const obj = data as Record<string, unknown>;
  
  // Check version
  if (typeof obj.version !== 'number') {
    throw new Error('Invalid file: missing or invalid version');
  }
  
  if (obj.version > CARTA_FILE_VERSION) {
    throw new Error(`File version ${obj.version} is newer than supported version ${CARTA_FILE_VERSION}`);
  }
  
  // Check required fields
  if (typeof obj.title !== 'string') {
    throw new Error('Invalid file: missing or invalid title');
  }
  
  if (typeof obj.nodeId !== 'number') {
    throw new Error('Invalid file: missing or invalid nodeId');
  }
  
  if (!Array.isArray(obj.nodes)) {
    throw new Error('Invalid file: missing or invalid nodes array');
  }
  
  if (!Array.isArray(obj.edges)) {
    throw new Error('Invalid file: missing or invalid edges array');
  }
  
  if (!Array.isArray(obj.deployables)) {
    throw new Error('Invalid file: missing or invalid deployables array');
  }
  
  if (!Array.isArray(obj.customSchemas)) {
    throw new Error('Invalid file: missing or invalid customSchemas array');
  }
  
  // Validate nodes have required fields
  for (const node of obj.nodes) {
    if (!node || typeof node !== 'object') {
      throw new Error('Invalid file: invalid node structure');
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.position || typeof n.type !== 'string') {
      throw new Error('Invalid file: node missing required fields (id, position, type)');
    }
    // Validate connections if present
    if (n.data && typeof n.data === 'object') {
      const data = n.data as Record<string, unknown>;
      if (data.connections !== undefined) {
        if (!Array.isArray(data.connections)) {
          throw new Error(`Invalid file: node "${n.id}" has invalid connections (must be array)`);
        }
        for (const conn of data.connections as unknown[]) {
          if (!conn || typeof conn !== 'object') {
            throw new Error(`Invalid file: node "${n.id}" has invalid connection structure`);
          }
          const c = conn as Record<string, unknown>;
          if (typeof c.portId !== 'string' || typeof c.targetSemanticId !== 'string' ||
              typeof c.targetPortId !== 'string') {
            throw new Error(`Invalid file: node "${n.id}" has connection missing required fields`);
          }
        }
      }
    }
  }
  
  // Validate edges have required fields
  for (const edge of obj.edges) {
    if (!edge || typeof edge !== 'object') {
      throw new Error('Invalid file: invalid edge structure');
    }
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      throw new Error('Invalid file: edge missing required fields (id, source, target)');
    }
  }
  
  // Validate deployables
  for (const deployable of obj.deployables) {
    if (!deployable || typeof deployable !== 'object') {
      throw new Error('Invalid file: invalid deployable structure');
    }
    const d = deployable as Record<string, unknown>;
    if (typeof d.id !== 'string' || typeof d.name !== 'string' || typeof d.description !== 'string') {
      throw new Error('Invalid file: deployable missing required fields');
    }
  }
  
  // Validate custom schemas
  for (const schema of obj.customSchemas) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid file: invalid schema structure');
    }
    const s = schema as Record<string, unknown>;
    if (typeof s.type !== 'string' || typeof s.displayName !== 'string' ||
        typeof s.color !== 'string' || !Array.isArray(s.fields) || !s.compilation) {
      throw new Error('Invalid file: schema missing required fields');
    }
    // Validate ports if present
    if (s.ports !== undefined) {
      if (!Array.isArray(s.ports)) {
        throw new Error(`Invalid file: schema "${s.type}" has invalid ports (must be array)`);
      }
      for (const port of s.ports as unknown[]) {
        if (!port || typeof port !== 'object') {
          throw new Error(`Invalid file: schema "${s.type}" has invalid port structure`);
        }
        const p = port as Record<string, unknown>;
        if (typeof p.id !== 'string' || typeof p.direction !== 'string' ||
            typeof p.position !== 'string' || typeof p.offset !== 'number' ||
            typeof p.label !== 'string') {
          throw new Error(`Invalid file: schema "${s.type}" has port missing required fields (id, direction, position, offset, label)`);
        }
        // Validate direction enum
        const validDirections = ['in', 'out', 'parent', 'child', 'bidi'];
        if (!validDirections.includes(p.direction as string)) {
          throw new Error(`Invalid file: schema "${s.type}" has port with invalid direction "${p.direction}"`);
        }
        // Validate position enum
        const validPositions = ['left', 'right', 'top', 'bottom'];
        if (!validPositions.includes(p.position as string)) {
          throw new Error(`Invalid file: schema "${s.type}" has port with invalid position "${p.position}"`);
        }
      }
    }
  }
  
  return {
    version: obj.version as number,
    title: obj.title as string,
    nodeId: obj.nodeId as number,
    nodes: obj.nodes as Node[],
    edges: obj.edges as Edge[],
    deployables: obj.deployables as Deployable[],
    customSchemas: obj.customSchemas as ConstructSchema[],
    exportedAt: (obj.exportedAt as string) || new Date().toISOString(),
  };
}
