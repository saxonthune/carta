import { registry } from '../registry';
import { controllerSchema } from './controller';
import { databaseSchema } from './database';
import { tableSchema } from './table';
import { implementationDetailsSchema } from './implementation-details';

/**
 * Register all built-in schemas
 */
export function registerBuiltInSchemas(): void {
  registry.registerSchema(controllerSchema);
  registry.registerSchema(databaseSchema);
  registry.registerSchema(tableSchema);
  registry.registerSchema(implementationDetailsSchema);
}

export { controllerSchema, databaseSchema, tableSchema, implementationDetailsSchema };
