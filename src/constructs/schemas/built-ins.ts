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
      { id: 'flow-in', direction: 'in', position: 'left', offset: 50, label: 'Flow In', description: 'Incoming request flow from upstream' },
      { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out', description: 'Downstream flow to services or handlers' },
      { id: 'parent', direction: 'parent', position: 'bottom', offset: 50, label: 'Models', description: 'Owns API request/response models' },
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
    suggestedRelated: [
      {
        constructType: 'database',
        fromPortId: 'flow-out',
        toPortId: 'link-in',
        label: 'Connect to Database'
      }
    ],
    compilation: {
      format: 'json',
      sectionHeader: '# REST Endpoints',
    },
  },

  // Database
  {
    type: 'database',
    displayName: 'Database',
    color: '#f59e0b',
    ports: [
      { id: 'child', direction: 'child', position: 'bottom', offset: 50, label: 'Tables', description: 'Tables that belong to this database' },
      { id: 'link-in', direction: 'in', position: 'left', offset: 50, label: 'Referenced By', description: 'External constructs referencing this database' },
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
    suggestedRelated: [
      {
        constructType: 'controller',
        fromPortId: 'link-in',
        toPortId: 'flow-out',
        label: 'Add REST Controller'
      },
      {
        constructType: 'table',
        fromPortId: 'child',
        toPortId: 'parent',
        label: 'Add Table'
      }
    ],
    compilation: {
      format: 'json',
      sectionHeader: '# Database Schema',
    },
  },

  // Table
  {
    type: 'table',
    displayName: 'Table',
    color: '#8b5cf6',
    ports: [
      { id: 'parent', direction: 'parent', position: 'top', offset: 50, label: 'Database', description: 'Database that owns this table' },
      { id: 'link-in', direction: 'in', position: 'left', offset: 50, label: 'Referenced By', description: 'Tables or constructs that reference this table' },
      { id: 'link-out', direction: 'out', position: 'right', offset: 50, label: 'References', description: 'Tables or constructs this table references' },
      { id: 'child', direction: 'child', position: 'bottom', offset: 75, label: 'Attributes & Constraints', description: 'Attributes and constraints that belong to this table' },
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
    suggestedRelated: [
      {
        constructType: 'database',
        fromPortId: 'parent',
        toPortId: 'child',
        label: 'Add to Database'
      },
      {
        constructType: 'db-attribute',
        fromPortId: 'child',
        toPortId: 'parent',
        label: 'Add Attribute'
      },
      {
        constructType: 'constraint',
        fromPortId: 'child',
        toPortId: 'parent',
        label: 'Add Constraint'
      }
    ],
    compilation: {
      format: 'json',
    },
  },

  // DB Attribute
  {
    type: 'db-attribute',
    displayName: 'DB Attribute',
    color: '#8b5cf6',
    description: 'A database table attribute/column',
    fields: [
      { name: 'name', label: 'Name', type: 'string' },
      { name: 'dataType', label: 'Type', type: 'enum', options: ['VARCHAR', 'INT', 'BIGINT', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'TEXT', 'JSON'] },
      { name: 'primaryKey', label: 'Primary Key', type: 'boolean', default: false },
      { name: 'nullable', label: 'Nullable', type: 'boolean', default: true },
    ],
    ports: [
      { id: 'parent', direction: 'parent', position: 'top', offset: 50, label: 'Table', description: 'Table that owns this attribute' },
    ],
    suggestedRelated: [
      {
        constructType: 'table',
        fromPortId: 'parent',
        toPortId: 'child',
        label: 'Add to Table'
      }
    ],
    compilation: { format: 'json' },
  },

  // Constraint
  {
    type: 'constraint',
    displayName: 'Constraint',
    color: '#a78bfa',
    description: 'A database constraint (unique, foreign key, check, etc.)',
    fields: [
      { name: 'name', label: 'Name', type: 'string', placeholder: 'e.g., fk_user_profile' },
      { name: 'constraintType', label: 'Type', type: 'enum', options: ['PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK', 'NOT NULL', 'DEFAULT'], default: 'UNIQUE' },
      { name: 'columns', label: 'Columns', type: 'string', placeholder: 'e.g., user_id, profile_id' },
      { name: 'definition', label: 'Definition', type: 'string', displayHint: 'code', placeholder: 'Detailed constraint definition' },
    ],
    ports: [
      { id: 'parent', direction: 'parent', position: 'top', offset: 50, label: 'Table', description: 'Table that owns this constraint' },
    ],
    suggestedRelated: [
      {
        constructType: 'table',
        fromPortId: 'parent',
        toPortId: 'child',
        label: 'Add to Table'
      }
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
      { id: 'child', direction: 'child', position: 'top', offset: 50, label: 'Controller', description: 'Controller endpoint that uses this model' },
    ],
    suggestedRelated: [
      {
        constructType: 'controller',
        fromPortId: 'child',
        toPortId: 'parent',
        label: 'Add to Controller'
      }
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
      { id: 'child', direction: 'child', position: 'left', offset: 50, label: 'Events', description: 'Child events that originate from this event' },
      { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out', description: 'Next UI flow that follows this event' },
    ],
    suggestedRelated: [
      {
        constructType: 'ui-screen',
        fromPortId: 'child',
        toPortId: 'parent',
        label: 'Add to UI Screen'
      }
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
      { id: 'flow-in', direction: 'in', position: 'left', offset: 50, label: 'Flow In', description: 'Incoming UI flow into this screen' },
      { id: 'parent', direction: 'parent', position: 'right', offset: 50, label: 'Events', description: 'Events that belong to this screen' },
    ],
    suggestedRelated: [
      {
        constructType: 'user-story',
        fromPortId: 'flow-in',
        toPortId: 'flow-out',
        label: 'Connect from User Story'
      },
      {
        constructType: 'ui-event',
        fromPortId: 'parent',
        toPortId: 'child',
        label: 'Add Event'
      }
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
      { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out', description: 'Outcome or follow-on user story' },
    ],
    suggestedRelated: [
      {
        constructType: 'ui-screen',
        fromPortId: 'flow-out',
        toPortId: 'flow-in',
        label: 'Connect to UI Screen'
      }
    ],
    compilation: { format: 'json' },
  },

  // Implementation Details
  {
    type: 'implementation-details',
    displayName: 'Implementation Details',
    color: '#6b7280',
    ports: [
      { id: 'link', direction: 'bidi', position: 'left', offset: 50, label: 'Related To', description: 'Bidirectional relationship to related constructs' },
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
