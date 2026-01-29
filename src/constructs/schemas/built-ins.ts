import type { ConstructSchema, PortSchema, SchemaGroup } from '../types';

/**
 * Built-in Schema Groups
 *
 * Default hierarchical grouping for construct and port schemas.
 * Uses flat storage with parentId references.
 */
export const builtInSchemaGroups: SchemaGroup[] = [
  {
    id: 'software-architecture',
    name: 'Software Architecture',
    color: '#6366f1',
    description: 'Core software architecture constructs',
  },
  {
    id: 'database',
    name: 'Database',
    parentId: 'software-architecture',
    color: '#f59e0b',
    description: 'Database schema and table constructs',
  },
  {
    id: 'api',
    name: 'API',
    parentId: 'software-architecture',
    color: '#6366f1',
    description: 'API endpoint and model constructs',
  },
  {
    id: 'ui',
    name: 'UI',
    parentId: 'software-architecture',
    color: '#3b82f6',
    description: 'User interface constructs',
  },
];

/**
 * Built-in Port Schemas
 *
 * Default port type definitions with polarity-based connection semantics.
 * These define the reusable port types and their connection rules.
 */
export const builtInPortSchemas: PortSchema[] = [
  {
    id: 'flow-in',
    displayName: 'Flow In',
    semanticDescription: 'Receives data or control flow',
    polarity: 'sink',
    compatibleWith: ['flow-out', 'forward'],
    expectedComplement: 'flow-out',
    defaultPosition: 'left',
    color: '#3b82f6',
  },
  {
    id: 'flow-out',
    displayName: 'Flow Out',
    semanticDescription: 'Sends data or control flow',
    polarity: 'source',
    compatibleWith: ['flow-in', 'intercept'],
    expectedComplement: 'flow-in',
    defaultPosition: 'right',
    color: '#22c55e',
  },
  {
    id: 'parent',
    displayName: 'Parent',
    semanticDescription: 'Contains or owns the connected construct',
    polarity: 'source',
    compatibleWith: ['child', 'intercept'],
    expectedComplement: 'child',
    defaultPosition: 'bottom',
    color: '#8b5cf6',
  },
  {
    id: 'child',
    displayName: 'Child',
    semanticDescription: 'Is contained by or owned by the connected construct',
    polarity: 'sink',
    compatibleWith: ['parent', 'forward'],
    expectedComplement: 'parent',
    defaultPosition: 'top',
    color: '#8b5cf6',
  },
  {
    id: 'symmetric',
    displayName: 'Link',
    semanticDescription: 'Bidirectional peer connection',
    polarity: 'bidirectional',
    compatibleWith: ['*'],
    defaultPosition: 'right',
    color: '#64748b',
  },
  {
    id: 'intercept',
    displayName: 'Intercept',
    semanticDescription: 'Pass-through input accepting any outgoing connection',
    polarity: 'sink',
    compatibleWith: ['*source*'],
    defaultPosition: 'left',
    color: '#f59e0b',
  },
  {
    id: 'forward',
    displayName: 'Forward',
    semanticDescription: 'Pass-through output connecting to any incoming port',
    polarity: 'source',
    compatibleWith: ['*sink*'],
    defaultPosition: 'right',
    color: '#f59e0b',
  },
];

/**
 * Built-in Construct Schemas
 *
 * All default schema definitions in one place for easy modification.
 * These schemas are registered automatically on app startup.
 */
export const builtInConstructSchemas: ConstructSchema[] = [
  // REST Controller
  {
    type: 'controller',
    displayName: 'REST Controller',
    color: '#6366f1',
    semanticDescription: 'HTTP REST API endpoint controller',
    groupId: 'api',
    displayField: 'route',
    ports: [
      { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Flow In', semanticDescription: 'Incoming request flow from upstream' },
      { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Flow Out', semanticDescription: 'Downstream flow to services or handlers' },
      { id: 'parent', portType: 'parent', position: 'bottom', offset: 50, label: 'Models', semanticDescription: 'Owns API request/response models' },
    ],
    fields: [
      {
        name: 'route',
        label: 'Route',
        type: 'string',
        semanticDescription: 'URL path pattern for this endpoint',
        default: '/api/',
        placeholder: '/api/users/{id}',
      },
      {
        name: 'verb',
        label: 'Method',
        type: 'enum',
        semanticDescription: 'HTTP method for this endpoint',
        options: [{ value: 'GET' }, { value: 'POST' }, { value: 'PUT' }, { value: 'PATCH' }, { value: 'DELETE' }],
        default: 'GET',
      },
      {
        name: 'summary',
        label: 'Summary',
        type: 'string',
        semanticDescription: 'Brief description of endpoint purpose and behavior',
        placeholder: 'Brief description of this endpoint',
      },
      {
        name: 'responseType',
        label: 'Response Type',
        type: 'enum',
        semanticDescription: 'Expected return type of this endpoint',
        options: [{ value: 'object' }, { value: 'array' }, { value: 'string' }, { value: 'number' }, { value: 'boolean' }, { value: 'void' }],
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
    semanticDescription: 'Database instance or schema container',
    groupId: 'database',
    displayField: 'engine',
    ports: [
      { id: 'child', portType: 'child', position: 'bottom', offset: 50, label: 'Tables', semanticDescription: 'Tables that belong to this database' },
      { id: 'link-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Referenced By', semanticDescription: 'External constructs referencing this database' },
    ],
    fields: [
      {
        name: 'engine',
        label: 'Engine',
        type: 'enum',
        semanticDescription: 'Database management system type',
        options: [{ value: 'PostgreSQL' }, { value: 'MySQL' }, { value: 'SQLite' }, { value: 'SQL Server' }, { value: 'MongoDB' }],
        default: 'PostgreSQL',
      },
      {
        name: 'note',
        label: 'Note',
        type: 'string',
        semanticDescription: 'Additional notes or context about this database',
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
    semanticDescription: 'Database table or entity',
    groupId: 'database',
    displayField: 'tableName',
    ports: [
      { id: 'parent', portType: 'parent', position: 'top', offset: 50, label: 'Database', semanticDescription: 'Database that owns this table' },
      { id: 'link-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Referenced By', semanticDescription: 'Tables or constructs that reference this table' },
      { id: 'link-out', portType: 'flow-out', position: 'right', offset: 50, label: 'References', semanticDescription: 'Tables or constructs this table references' },
      { id: 'child', portType: 'child', position: 'bottom', offset: 75, label: 'Attributes & Constraints', semanticDescription: 'Attributes and constraints that belong to this table' },
    ],
    fields: [
      {
        name: 'tableName',
        label: 'Table Name',
        type: 'string',
        semanticDescription: 'Name of the database table',
        placeholder: 'e.g., users, orders',
      },
      {
        name: 'columns',
        label: 'Columns',
        type: 'string',
        semanticDescription: 'Column definitions for this table',
        placeholder: 'e.g., email VARCHAR(255)',
      },
      {
        name: 'constraints',
        label: 'Constraints',
        type: 'string',
        semanticDescription: 'Table-level constraints and rules',
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
    semanticDescription: 'A database table attribute/column',
    groupId: 'database',
    displayField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Column name' },
      { name: 'dataType', label: 'Type', type: 'enum', semanticDescription: 'SQL data type for this column', options: [{ value: 'VARCHAR' }, { value: 'INT' }, { value: 'BIGINT' }, { value: 'BOOLEAN' }, { value: 'DATE' }, { value: 'TIMESTAMP' }, { value: 'TEXT' }, { value: 'JSON' }] },
      { name: 'primaryKey', label: 'Primary Key', type: 'boolean', semanticDescription: 'Whether this column is part of the primary key', default: false },
      { name: 'nullable', label: 'Nullable', type: 'boolean', semanticDescription: 'Whether this column allows NULL values', default: true },
    ],
    ports: [
      { id: 'parent', portType: 'parent', position: 'top', offset: 50, label: 'Table', semanticDescription: 'Table that owns this attribute' },
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
    semanticDescription: 'A database constraint (unique, foreign key, check, etc.)',
    groupId: 'database',
    displayField: 'name',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Constraint name identifier', placeholder: 'e.g., fk_user_profile' },
      { name: 'constraintType', label: 'Type', type: 'enum', semanticDescription: 'Type of database constraint', options: [{ value: 'PRIMARY KEY' }, { value: 'UNIQUE' }, { value: 'FOREIGN KEY' }, { value: 'CHECK' }, { value: 'NOT NULL' }, { value: 'DEFAULT' }], default: 'UNIQUE' },
      { name: 'columns', label: 'Columns', type: 'string', semanticDescription: 'Columns affected by this constraint', placeholder: 'e.g., user_id, profile_id' },
      { name: 'definition', label: 'Definition', type: 'string', semanticDescription: 'Full SQL constraint definition', displayHint: 'code', placeholder: 'Detailed constraint definition' },
    ],
    ports: [
      { id: 'parent', portType: 'parent', position: 'top', offset: 50, label: 'Table', semanticDescription: 'Table that owns this constraint' },
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
    semanticDescription: 'Request or response model for an API endpoint',
    groupId: 'api',
    displayField: 'modelName',
    fields: [
      {
        name: 'modelName',
        label: 'Model Name',
        type: 'string',
        semanticDescription: 'Name of the request or response model type',
        placeholder: 'e.g., CreateUserRequest, UserResponse',
      },
      {
        name: 'modelType',
        label: 'Model Type',
        type: 'enum',
        semanticDescription: 'Whether this is a request or response model',
        options: [{ value: 'request' }, { value: 'response' }],
        default: 'request',
        showInMinimalDisplay: true,
      },
      {
        name: 'data',
        label: 'Data',
        type: 'string',
        semanticDescription: 'Structure and fields of the model',
        placeholder: 'Describe the data structure',
      },
    ],
    ports: [
      { id: 'child', portType: 'child', position: 'top', offset: 50, label: 'Controller', semanticDescription: 'Controller endpoint that uses this model' },
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
    semanticDescription: 'A user interaction or event in the UI',
    groupId: 'ui',
    displayField: 'eventName',
    fields: [
      {
        name: 'eventName',
        label: 'Event Name',
        type: 'string',
        semanticDescription: 'Name of the UI event or user action',
        placeholder: 'e.g., Click Submit, Load Page',
      },
      {
        name: 'trigger',
        label: 'Trigger',
        type: 'string',
        semanticDescription: 'What causes this event to fire',
        placeholder: 'What triggers this event?',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        semanticDescription: 'Detailed description of the event behavior and purpose',
        placeholder: 'Describe the event or user action',
      },
    ],
    ports: [
      { id: 'child', portType: 'child', position: 'left', offset: 50, label: 'Events', semanticDescription: 'Child events that originate from this event' },
      { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Flow Out', semanticDescription: 'Next UI flow that follows this event' },
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
    semanticDescription: 'A screen or view in the user interface',
    groupId: 'ui',
    displayField: 'screenName',
    fields: [
      {
        name: 'screenName',
        label: 'Screen Name',
        type: 'string',
        semanticDescription: 'Name of the UI screen or view',
        placeholder: 'e.g., Login, Dashboard, Profile',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        semanticDescription: 'Purpose and content of this screen',
        placeholder: 'Describe the screen or view',
      },
    ],
    ports: [
      { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Flow In', semanticDescription: 'Incoming UI flow into this screen' },
      { id: 'parent', portType: 'parent', position: 'right', offset: 50, label: 'Events', semanticDescription: 'Events that belong to this screen' },
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
    semanticDescription: 'A user story or requirement',
    groupId: 'software-architecture',
    displayField: 'title',
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        semanticDescription: 'Short title summarizing the user story',
        placeholder: 'e.g., User Login, Create Account',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        semanticDescription: 'Full user story in "As a X, I want Y, so that Z" format',
        placeholder: 'As a [user], I want [goal] so that [benefit]',
        showInMinimalDisplay: true,
      },
    ],
    ports: [
      { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Flow Out', semanticDescription: 'Outcome or follow-on user story' },
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
    semanticDescription: 'Technical implementation notes and documentation',
    displayField: 'details',
    ports: [
      { id: 'link', portType: 'symmetric', position: 'left', offset: 50, label: 'Related To', semanticDescription: 'Bidirectional relationship to related constructs' },
    ],
    fields: [
      {
        name: 'details',
        label: 'Details',
        type: 'string',
        semanticDescription: 'Implementation notes, technical details, or documentation',
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
