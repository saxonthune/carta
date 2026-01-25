import { registry } from '../registry';
import { builtInConstructSchemas, builtInPortSchemas } from './built-ins';

/**
 * Seed default schemas on first load if no schemas exist
 */
export function seedDefaultSchemas(): void {
  for (const schema of builtInConstructSchemas) {
    registry.registerSchema(schema);
  }
}

export { builtInConstructSchemas, builtInPortSchemas };
