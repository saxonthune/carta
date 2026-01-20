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
  category: 'data',
  color: '#f59e0b', // Amber
  fields: [
    {
      name: 'engine',
      label: 'Engine',
      type: 'dropdown',
      options: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'MongoDB'],
      default: 'PostgreSQL',
    },
    {
      name: 'note',
      label: 'Note',
      type: 'text',
      placeholder: 'Description of this database',
    },
  ],
  compilation: {
    format: 'dbml',
    sectionHeader: '# Database Schema (DBML)',
  },
};

export default databaseSchema;
