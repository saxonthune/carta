import { registry } from '../registry';
import { builtInConstructSchemas, builtInPortSchemas, builtInSchemaGroups } from './built-ins';

/**
 * Seed default schemas on first load if no schemas exist
 */
export function seedDefaultSchemas(): void {
  for (const schema of builtInConstructSchemas) {
    registry.registerSchema(schema);
  }
}

export { builtInConstructSchemas, builtInPortSchemas, builtInSchemaGroups };
