import type { ConstructSchema } from './types';

/**
 * ConstructRegistry - Singleton that manages available construct schemas
 * 
 * This is the central registry where all construct types are registered.
 * The visual editor queries this to know how to render nodes.
 * The compiler queries this to know how to compile nodes.
 */
class ConstructRegistry {
  private static instance: ConstructRegistry;
  private schemas: Map<string, ConstructSchema> = new Map();
  private userSchemaTypes: Set<string> = new Set();

  private constructor() {}

  static getInstance(): ConstructRegistry {
    if (!ConstructRegistry.instance) {
      ConstructRegistry.instance = new ConstructRegistry();
    }
    return ConstructRegistry.instance;
  }

  /**
   * Register a built-in schema
   */
  registerSchema(schema: ConstructSchema): void {
    this.schemas.set(schema.type, { ...schema, isBuiltIn: true });
  }

  /**
   * Register a user-defined schema
   */
  registerUserSchema(schema: ConstructSchema): void {
    this.schemas.set(schema.type, { ...schema, isBuiltIn: false });
    this.userSchemaTypes.add(schema.type);
  }

  /**
   * Remove a user-defined schema
   */
  removeUserSchema(type: string): boolean {
    if (this.userSchemaTypes.has(type)) {
      this.schemas.delete(type);
      this.userSchemaTypes.delete(type);
      return true;
    }
    return false;
  }

  /**
   * Get a schema by type
   */
  getSchema(type: string): ConstructSchema | undefined {
    return this.schemas.get(type);
  }

  /**
   * Get all registered schemas
   */
  getAllSchemas(): ConstructSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Get schemas filtered by category
   */
  getSchemasByCategory(category: string): ConstructSchema[] {
    return this.getAllSchemas().filter(s => s.category === category);
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    const categories = new Set(this.getAllSchemas().map(s => s.category));
    return Array.from(categories);
  }

  /**
   * Get only user-defined schemas
   */
  getUserSchemas(): ConstructSchema[] {
    return Array.from(this.userSchemaTypes)
      .map(type => this.schemas.get(type))
      .filter((s): s is ConstructSchema => s !== undefined);
  }

  /**
   * Get only built-in schemas
   */
  getBuiltInSchemas(): ConstructSchema[] {
    return this.getAllSchemas().filter(s => s.isBuiltIn);
  }

  /**
   * Export user schemas as JSON string
   */
  exportUserSchemas(): string {
    return JSON.stringify(this.getUserSchemas(), null, 2);
  }

  /**
   * Import user schemas from JSON string
   */
  importUserSchemas(json: string): { success: boolean; count: number; errors: string[] } {
    const errors: string[] = [];
    let count = 0;

    try {
      const schemas = JSON.parse(json);
      
      if (!Array.isArray(schemas)) {
        return { success: false, count: 0, errors: ['Invalid format: expected array of schemas'] };
      }

      for (const schema of schemas) {
        if (this.validateSchema(schema)) {
          this.registerUserSchema(schema);
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
      typeof s.category === 'string' &&
      typeof s.color === 'string' &&
      Array.isArray(s.fields) &&
      s.compilation !== undefined
    );
  }

  /**
   * Check if a type exists
   */
  hasSchema(type: string): boolean {
    return this.schemas.has(type);
  }

  /**
   * Clear all user schemas (for testing/reset)
   */
  clearUserSchemas(): void {
    for (const type of this.userSchemaTypes) {
      this.schemas.delete(type);
    }
    this.userSchemaTypes.clear();
  }

  /**
   * Replace all user schemas - clears existing and imports new ones
   * Used when importing a .carta project file
   */
  replaceUserSchemas(schemas: ConstructSchema[]): { success: boolean; count: number; errors: string[] } {
    const errors: string[] = [];
    let count = 0;

    // Clear existing user schemas
    this.clearUserSchemas();

    // Import new schemas
    for (const schema of schemas) {
      if (this.validateSchema(schema)) {
        this.registerUserSchema(schema);
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
