import type { ConstructSchema } from './types';
import { getDocumentState } from '../stores/documentStore';

/**
 * ConstructRegistry - Facade over document store for schema management
 *
 * This is the central registry where all construct types are registered.
 * The visual editor queries this to know how to render nodes.
 * The compiler queries this to know how to compile nodes.
 *
 * Note: All data is stored in the unified document store. This class
 * provides a familiar API for components while delegating to the store.
 */
class ConstructRegistry {
  private static instance: ConstructRegistry;

  private constructor() {}

  static getInstance(): ConstructRegistry {
    if (!ConstructRegistry.instance) {
      ConstructRegistry.instance = new ConstructRegistry();
    }
    return ConstructRegistry.instance;
  }

  /**
   * Register a schema (all schemas are equal - no built-in distinction)
   */
  registerSchema(schema: ConstructSchema): void {
    getDocumentState().addSchema(schema);
  }

  /**
   * Remove a schema
   */
  removeSchema(type: string): boolean {
    return getDocumentState().removeSchema(type);
  }

  /**
   * Get a schema by type
   */
  getSchema(type: string): ConstructSchema | undefined {
    return getDocumentState().getSchema(type);
  }

  /**
   * Get all registered schemas
   */
  getAllSchemas(): ConstructSchema[] {
    return getDocumentState().schemas;
  }

  /**
   * Export all schemas as JSON string
   */
  exportSchemas(): string {
    return JSON.stringify(this.getAllSchemas(), null, 2);
  }

  /**
   * Import schemas from JSON string
   */
  importSchemas(json: string): { success: boolean; count: number; errors: string[] } {
    const errors: string[] = [];
    let count = 0;

    try {
      const schemas = JSON.parse(json);

      if (!Array.isArray(schemas)) {
        return { success: false, count: 0, errors: ['Invalid format: expected array of schemas'] };
      }

      for (const schema of schemas) {
        if (this.validateSchema(schema)) {
          this.registerSchema(schema);
          count++;
        } else {
          errors.push(`Invalid schema: ${schema.type || 'unknown'}`);
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (e) {
      return { success: false, count: 0, errors: [`Parse error: ${e}`] };
    }
  }

  /**
   * Validate a schema structure
   */
  private validateSchema(schema: unknown): schema is ConstructSchema {
    if (!schema || typeof schema !== 'object') return false;

    const s = schema as Record<string, unknown>;

    return (
      typeof s.type === 'string' &&
      typeof s.displayName === 'string' &&
      typeof s.color === 'string' &&
      Array.isArray(s.fields) &&
      s.compilation !== undefined
    );
  }

  /**
   * Check if a type exists
   */
  hasSchema(type: string): boolean {
    return getDocumentState().getSchema(type) !== undefined;
  }

  /**
   * Clear all schemas (for reset)
   */
  clearAllSchemas(): void {
    getDocumentState().setSchemas([]);
  }

  /**
   * Replace all schemas
   * Used when importing a .carta project file or restoring defaults
   */
  replaceSchemas(schemas: ConstructSchema[]): { success: boolean; count: number; errors: string[] } {
    const errors: string[] = [];
    let count = 0;

    // Clear existing schemas
    this.clearAllSchemas();

    // Import new schemas
    for (const schema of schemas) {
      if (this.validateSchema(schema)) {
        this.registerSchema(schema);
        count++;
      } else {
        errors.push(`Invalid schema: ${(schema as { type?: string })?.type || 'unknown'}`);
      }
    }

    return { success: errors.length === 0, count, errors };
  }
}

// Export singleton instance
export const registry = ConstructRegistry.getInstance();
export default registry;
