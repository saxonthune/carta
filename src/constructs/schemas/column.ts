import type { ConstructSchema } from '../types';

/**
 * Column Schema
 *
 * Represents a database table column.
 * Connect to a Table node via parent port.
 */
export const columnSchema: ConstructSchema = {
  type: 'column',
  displayName: 'Column',
  color: '#8b5cf6',
  description: 'A database table column',
  fields: [
    { name: 'name', label: 'Name', type: 'string' },
    { name: 'dataType', label: 'Type', type: 'enum', options: ['VARCHAR', 'INT', 'BIGINT', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'TEXT', 'JSON'] },
    { name: 'primaryKey', label: 'Primary Key', type: 'boolean', default: false },
    { name: 'nullable', label: 'Nullable', type: 'boolean', default: true },
  ],
  ports: [
    { id: 'parent', direction: 'parent', position: 'top', offset: 50, label: 'Table' },
  ],
  compilation: { format: 'json' },
};

export default columnSchema;
