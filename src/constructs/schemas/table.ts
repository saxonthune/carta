import type { ConstructSchema } from '../types';

/**
 * Table Schema
 * 
 * Represents a database table with columns.
 * Connect to a Database node to indicate which database it belongs to.
 * Connect to other Table nodes to create foreign key references.
 * Compiles to DBML table definition.
 */
export const tableSchema: ConstructSchema = {
  type: 'table',
  displayName: 'Table',
  category: 'data',
  color: '#8b5cf6', // Purple
  fields: [
    {
      name: 'columns',
      label: 'Columns',
      type: 'table',
      columns: [
        { name: 'name', label: 'Column', type: 'text' },
        {
          name: 'type',
          label: 'Type',
          type: 'dropdown',
          options: [
            'int',
            'bigint',
            'varchar',
            'text',
            'boolean',
            'timestamp',
            'date',
            'uuid',
            'json',
            'jsonb',
            'float',
            'decimal',
          ],
        },
        { name: 'pk', label: 'PK', type: 'boolean' },
        { name: 'nullable', label: 'Null', type: 'boolean' },
      ],
      default: [],
    },
    {
      name: 'indexes',
      label: 'Indexes',
      type: 'text',
      placeholder: 'e.g., (email) [unique]',
    },
  ],
  compilation: {
    format: 'dbml',
  },
};

export default tableSchema;
