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
      { id: 'parent', direction: 'parent', position: 'bottom', offset: 50, label: 'Models' },
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
        name: 'columns',
        label: 'Columns',
        type: 'string',
        placeholder: 'e.g., email VARCHAR(255)',
      },
      {
        name: 'constraints',
        label: 'Constraints',
        type: 'string',
        placeholder: 'e.g., (email) [unique], (age) [not null]',
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

  // API Model
  {
    type: 'api-model',
    displayName: 'API Model',
    color: '#6366f1',
    description: 'Request or response model for an API endpoint',
    fields: [
      { 
        name: 'modelType', 
        label: 'Model Type', 
        type: 'enum', 
        options: ['request', 'response'],
        default: 'request',
        displayInMap: true,
      },
      {
        name: 'data',
        label: 'Data',
        type: 'string',
        placeholder: 'Describe the data structure',
      },
    ],
    ports: [
      { id: 'child', direction: 'child', position: 'top', offset: 50, label: 'Controller' },
    ],
    compilation: { format: 'json' },
  },

  // UI Event
  {
    type: 'ui-event',
    displayName: 'UI Event',
    color: '#10b981',
    description: 'A user interaction or event in the UI',
    fields: [
      {
        name: 'trigger',
        label: 'Trigger',
        type: 'string',
        placeholder: 'What triggers this event?',
      },
      { 
        name: 'description', 
        label: 'Description', 
        type: 'string',
        placeholder: 'Describe the event or user action',
      },
    ],
    ports: [
      { id: 'child', direction: 'child', position: 'left', offset: 50, label: 'Events' },
      { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out' },
    ],
    compilation: { format: 'json' },
  },

  // UI Screen
  {
    type: 'ui-screen',
    displayName: 'UI Screen',
    color: '#3b82f6',
    description: 'A screen or view in the user interface',
    fields: [
      { 
        name: 'description', 
        label: 'Description', 
        type: 'string',
        placeholder: 'Describe the screen or view',
      },
    ],
    ports: [
      { id: 'flow-in', direction: 'in', position: 'left', offset: 50, label: 'Flow In' },
      { id: 'parent', direction: 'parent', position: 'right', offset: 50, label: 'Events' },
    ],
    compilation: { format: 'json' },
  },

  // User Story
  {
    type: 'user-story',
    displayName: 'User Story',
    color: '#10b981',
    description: 'A user story or requirement',
    fields: [
      { 
        name: 'description', 
        label: 'Description', 
        type: 'string',
        placeholder: 'As a [user], I want [goal] so that [benefit]',
        displayInMap: true,
      },
    ],
    ports: [
      { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out' },
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
