import type { PortSchema } from './types';
import { builtInPortSchemas } from './schemas/built-ins';

/**
 * Default port schemas - re-exported from built-ins for backwards compatibility
 */
export const DEFAULT_PORT_SCHEMAS: PortSchema[] = builtInPortSchemas;

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
   * Only exact ID match and '*' wildcard are supported.
   */
  private matchesCompatibility(rules: string[], other: PortSchema): boolean {
    return rules.some(rule => rule === '*' || rule === other.id);
  }

  /**
   * Get the effective direction for polarity-based connection validation.
   * relay behaves like source, intercept behaves like sink.
   */
  private getEffectiveDirection(polarity: string): 'source' | 'sink' | 'bidirectional' {
    if (polarity === 'relay') return 'source';
    if (polarity === 'intercept') return 'sink';
    return polarity as 'source' | 'sink' | 'bidirectional';
  }

  /**
   * Check if two port types can be connected.
   *
   * Two-step validation:
   * 1. Polarity check: Block same-direction pairs (source+source, sink+sink).
   *    relay maps to source direction, intercept maps to sink direction.
   *    bidirectional is compatible with everything.
   * 2. compatibleWith check: Skipped if either side is relay, intercept, or bidirectional.
   *    For source+sink pairs, at least one side must list the other in compatibleWith.
   */
  canConnect(fromPortType: string, toPortType: string): boolean {
    const fromSchema = this.schemas.get(fromPortType);
    const toSchema = this.schemas.get(toPortType);

    // If either port type is unknown, deny connection
    if (!fromSchema || !toSchema) return false;

    const fromDir = this.getEffectiveDirection(fromSchema.polarity);
    const toDir = this.getEffectiveDirection(toSchema.polarity);

    // Step 1: Block same-direction pairs
    if (fromDir === 'source' && toDir === 'source') return false;
    if (fromDir === 'sink' && toDir === 'sink') return false;

    // Step 2: Skip compatibleWith if either side is relay, intercept, or bidirectional
    if (fromSchema.polarity === 'relay' || fromSchema.polarity === 'intercept' ||
        fromSchema.polarity === 'bidirectional' ||
        toSchema.polarity === 'relay' || toSchema.polarity === 'intercept' ||
        toSchema.polarity === 'bidirectional') {
      return true;
    }

    // For plain source+sink pairs, check compatibleWith from BOTH sides
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
 * Sync port registry with provided port schemas
 * Updates the registry's internal schemas
 * Should be called on app initialization and whenever portSchemas change
 */
export function syncWithDocumentStore(portSchemas?: PortSchema[]): void {
  if (portSchemas) {
    portRegistry.setSchemas(portSchemas);
  }
}
