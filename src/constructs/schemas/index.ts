import { registry } from '../registry';
import { builtInSchemas } from './built-ins';

/**
 * Register all built-in schemas
 */
export function registerBuiltInSchemas(): void {
  for (const schema of builtInSchemas) {
    registry.registerSchema(schema);
  }
}

export { builtInSchemas };
