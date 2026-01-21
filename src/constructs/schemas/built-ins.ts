import type { ConstructSchema } from '../types';

/**
 * Built-in Construct Schemas
 *
 * All default schema definitions in one place for easy modification.
 * These schemas are registered automatically on app startup.
 */
export const builtInSchemas: ConstructSchema[] = [
  // REST Controller
  {
    type: 'controller',
    displayName: 'REST Controller',
    color: '#6366f1',
    ports: [
      { id: 'flow-in', direction: 'in', position: 'left', offset: 50, label: 'Flow In' },
      { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out' },
      { id: 'data-source', direction: 'out', position: 'bottom', offset: 50, label: 'Data Source' },
      { id: 'child', direction: 'child', position: 'bottom', offset: 25, label: 'Parameters' },
    ],
    fields: [
      {
        name: 'route',
        label: 'Route',
        type: 'string',
        default: '/api/',
        placeholder: '/api/users/{id}',
      },
      {
        name: 'verb',
        label: 'Method',
        type: 'enum',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        default: 'GET',
      },
      {
        name: 'summary',
        label: 'Summary',
        type: 'string',
        placeholder: 'Brief description of this endpoint',
      },
      {
        name: 'responseType',
        label: 'Response Type',
        type: 'enum',
        options: ['object', 'array', 'string', 'number', 'boolean', 'void'],
        default: 'object',
      },
    ],
    compilation: {
      format: 'openapi',
      sectionHeader: '# OpenAPI Paths',
    },
  },

  // Database
  {
    type: 'database',
    displayName: 'Database',
    color: '#f59e0b',
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
  },

  // Table
  {
    type: 'table',
    displayName: 'Table',
    color: '#8b5cf6',
    ports: [
      { id: 'parent', direction: 'parent', position: 'top', offset: 50, label: 'Database' },
      { id: 'link-in', direction: 'in', position: 'left', offset: 50, label: 'Referenced By' },
      { id: 'link-out', direction: 'out', position: 'right', offset: 50, label: 'References' },
      { id: 'child', direction: 'child', position: 'bottom', offset: 75, label: 'Columns' },
    ],
    fields: [
      {
        name: 'indexes',
        label: 'Indexes',
        type: 'string',
        placeholder: 'e.g., (email) [unique]',
      },
    ],
    compilation: {
      format: 'dbml',
    },
  },

  // Column
  {
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
  },

  // API Parameter
  {
    type: 'api-parameter',
    displayName: 'API Parameter',
    color: '#6366f1',
    description: 'A parameter for an API endpoint',
    fields: [
      { name: 'name', label: 'Name', type: 'string' },
      { name: 'location', label: 'Location', type: 'enum', options: ['path', 'query', 'header', 'body'] },
      { name: 'dataType', label: 'Type', type: 'enum', options: ['string', 'number', 'boolean', 'object', 'array'] },
      { name: 'required', label: 'Required', type: 'boolean', default: false },
    ],
    ports: [
      { id: 'parent', direction: 'parent', position: 'top', offset: 50, label: 'Controller' },
    ],
    compilation: { format: 'json' },
  },

  // Implementation Details
  {
    type: 'implementation-details',
    displayName: 'Implementation Details',
    color: '#6b7280',
    ports: [
      { id: 'link', direction: 'bidi', position: 'left', offset: 50, label: 'Related To' },
    ],
    fields: [
      {
        name: 'details',
        label: 'Details',
        type: 'string',
        displayHint: 'code',
        placeholder: 'Enter implementation details, notes, or documentation here...',
        default: '',
      },
    ],
    compilation: {
      format: 'json',
      sectionHeader: '# Implementation Details',
    },
  },
];
