import type { PortSchema } from './types';

/**
 * Default port schemas with polarity-based connection semantics
 * These define the reusable port types and their connection rules
 */
export const DEFAULT_PORT_SCHEMAS: PortSchema[] = [
  {
    id: 'flow-in',
    displayName: 'Flow In',
    semanticDescription: 'Receives data or control flow',
    polarity: 'sink',
    compatibleWith: ['flow-out', 'forward'],
    expectedComplement: 'flow-out',
    defaultPosition: 'left',
    color: '#3b82f6',
  },
  {
    id: 'flow-out',
    displayName: 'Flow Out',
    semanticDescription: 'Sends data or control flow',
    polarity: 'source',
    compatibleWith: ['flow-in', 'intercept'],
    expectedComplement: 'flow-in',
    defaultPosition: 'right',
    color: '#22c55e',
  },
  {
    id: 'parent',
    displayName: 'Parent',
    semanticDescription: 'Contains or owns the connected construct',
    polarity: 'source',
    compatibleWith: ['child', 'intercept'],
    expectedComplement: 'child',
    defaultPosition: 'bottom',
    color: '#8b5cf6',
  },
  {
    id: 'child',
    displayName: 'Child',
    semanticDescription: 'Is contained by or owned by the connected construct',
    polarity: 'sink',
    compatibleWith: ['parent', 'forward'],
    expectedComplement: 'parent',
    defaultPosition: 'top',
    color: '#8b5cf6',
  },
  {
    id: 'symmetric',
    displayName: 'Link',
    semanticDescription: 'Bidirectional peer connection',
    polarity: 'bidirectional',
    compatibleWith: ['*'],
    defaultPosition: 'right',
    color: '#64748b',
  },
  {
    id: 'intercept',
    displayName: 'Intercept',
    semanticDescription: 'Pass-through input accepting any outgoing connection',
    polarity: 'sink',
    compatibleWith: ['*source*'],
    defaultPosition: 'left',
    color: '#f59e0b',
  },
  {
    id: 'forward',
    displayName: 'Forward',
    semanticDescription: 'Pass-through output connecting to any incoming port',
    polarity: 'source',
    compatibleWith: ['*sink*'],
    defaultPosition: 'right',
    color: '#f59e0b',
  },
];

/**
 * Port Registry - manages port schemas and connection validation
 * Uses polarity-based connection rules
 */
export class PortRegistry {
  private schemas: Map<string, PortSchema>;

  constructor(schemas: PortSchema[] = DEFAULT_PORT_SCHEMAS) {
    this.schemas = new Map(schemas.map(s => [s.id, s]));
  }

  /**
   * Get a port schema by ID
   */
  get(id: string): PortSchema | undefined {
    return this.schemas.get(id);
  }

  /**
   * Get all port schemas
   */
  getAll(): PortSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Set the port schemas (for document store integration)
   */
  setSchemas(schemas: PortSchema[]): void {
    this.schemas = new Map(schemas.map(s => [s.id, s]));
  }

  /**
   * Check if a compatibility rule matches another port schema
   */
  private matchesCompatibility(rules: string[], other: PortSchema): boolean {
    return rules.some(rule =>
      rule === '*' ||
      (rule === '*source*' && other.polarity === 'source') ||
      (rule === '*sink*' && other.polarity === 'sink') ||
      (rule === '*bidirectional*' && other.polarity === 'bidirectional') ||
      rule === other.id
    );
  }

  /**
   * Check if two port types can be connected
   * Uses polarity-based validation:
   * - source → source: blocked
   * - sink → sink: blocked
   * - source → sink: allowed (normal flow)
   * - sink → source: allowed (user dragged backward)
   * - bidirectional → anything: allowed
   * - anything → bidirectional: allowed
   */
  canConnect(fromPortType: string, toPortType: string): boolean {
    const fromSchema = this.schemas.get(fromPortType);
    const toSchema = this.schemas.get(toPortType);

    // If either port type is unknown, deny connection
    if (!fromSchema || !toSchema) return false;

    const fromPol = fromSchema.polarity;
    const toPol = toSchema.polarity;

    // Block invalid polarity combinations
    if (fromPol === 'source' && toPol === 'source') return false;
    if (fromPol === 'sink' && toPol === 'sink') return false;

    // Check compatibility from BOTH sides (either can allow)
    return this.matchesCompatibility(fromSchema.compatibleWith, toSchema) ||
           this.matchesCompatibility(toSchema.compatibleWith, fromSchema);
  }

  /**
   * Get the color for a port type
   */
  getColor(portType: string): string {
    const schema = this.schemas.get(portType);
    return schema?.color || '#6b7280'; // Default gray
  }

  /**
   * Register a new port schema
   */
  register(schema: PortSchema): void {
    this.schemas.set(schema.id, schema);
  }

  /**
   * Remove a port schema
   */
  remove(id: string): boolean {
    return this.schemas.delete(id);
  }

  /**
   * Get the default position for a port type
   */
  getDefaultPosition(portType: string): 'left' | 'right' | 'top' | 'bottom' {
    const schema = this.schemas.get(portType);
    return schema?.defaultPosition || 'right';
  }
}

// Export singleton instance
export const portRegistry = new PortRegistry();
export default portRegistry;

/**
 * Sync port registry with document store
 * Updates the registry's internal schemas from the current document store state
 * Should be called on app initialization and whenever portSchemas in the store change
 *
 * Uses lazy import to avoid circular dependencies at module load time
 */
export async function syncWithDocumentStore(): Promise<void> {
  try {
    const { useDocumentStore } = await import('../stores/documentStore');
    const store = useDocumentStore.getState();
    const portSchemas = store.getPortSchemas();
    portRegistry.setSchemas(portSchemas);
  } catch (error) {
    console.error('Failed to sync port registry with document store:', error);
  }
}
