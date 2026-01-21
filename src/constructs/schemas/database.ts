import type { ConstructSchema } from '../types';

/**
 * Database Schema
 *
 * Represents a database instance. Tables connect to databases via edges.
 * Compiles to DBML project header.
 */
export const databaseSchema: ConstructSchema = {
  type: 'database',
  displayName: 'Database',
  color: '#f59e0b', // Amber
  ports: [
    { id: 'child', direction: 'child', position: 'bottom', offset: 50, label: 'Tables' },
    { id: 'link-in', direction: 'in', position: 'left', offset: 50, label: 'Referenced By' },
  ],
  fields: [
    {
      name: 'engine',
      label: 'Engine',
      type: 'enum',
      options: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'MongoDB'],
      default: 'PostgreSQL',
    },
    {
      name: 'note',
      label: 'Note',
      type: 'string',
      placeholder: 'Description of this database',
    },
  ],
  compilation: {
    format: 'dbml',
    sectionHeader: '# Database Schema (DBML)',
  },
};

export default databaseSchema;
