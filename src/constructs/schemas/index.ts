import { registry } from '../registry';
import { builtInSchemas } from './built-ins';

/**
 * Seed default schemas on first load if no schemas exist
 */
export function seedDefaultSchemas(): void {
  for (const schema of builtInSchemas) {
    registry.registerSchema(schema);
  }
}

export { builtInSchemas };
