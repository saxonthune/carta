import type { ConstructSchema, PortSchema, SchemaGroup } from '../types/index.js';

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
    color: '#7c7fca',
    description: 'Core software architecture constructs',
  },
  {
    id: 'database',
    name: 'Database',
    parentId: 'software-architecture',
    color: '#c49a4c',
    description: 'Database schema and table constructs',
  },
  {
    id: 'api',
    name: 'API',
    parentId: 'software-architecture',
    color: '#7c7fca',
    description: 'API endpoint and model constructs',
  },
  {
    id: 'ui',
    name: 'UI',
    parentId: 'software-architecture',
    color: '#6a8fc0',
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
    compatibleWith: ['flow-out'],
    expectedComplement: 'flow-out',
    defaultPosition: 'left',
    color: '#3b82f6',
  },
  {
    id: 'flow-out',
    displayName: 'Flow Out',
    semanticDescription: 'Sends data or control flow',
    polarity: 'source',
    compatibleWith: ['flow-in'],
    expectedComplement: 'flow-in',
    defaultPosition: 'right',
    color: '#22c55e',
  },
  {
    id: 'parent',
    displayName: 'Parent',
    semanticDescription: 'Contains or owns the connected construct',
    polarity: 'source',
    compatibleWith: ['child'],
    expectedComplement: 'child',
    defaultPosition: 'bottom',
    color: '#8b5cf6',
  },
  {
    id: 'child',
    displayName: 'Child',
    semanticDescription: 'Is contained by or owned by the connected construct',
    polarity: 'sink',
    compatibleWith: ['parent'],
    expectedComplement: 'parent',
    defaultPosition: 'top',
    color: '#8b5cf6',
  },
  {
    id: 'symmetric',
    displayName: 'Link',
    semanticDescription: 'Bidirectional peer connection',
    polarity: 'bidirectional',
    compatibleWith: [],
    defaultPosition: 'right',
    color: '#64748b',
  },
  {
    id: 'intercept',
    displayName: 'Intercept',
    semanticDescription: 'Pass-through input accepting any source connection (bypasses type checking)',
    polarity: 'intercept',
    compatibleWith: [],
    defaultPosition: 'left',
    color: '#f59e0b',
  },
  {
    id: 'relay',
    displayName: 'Relay',
    semanticDescription: 'Pass-through output connecting to any sink port (bypasses type checking)',
    polarity: 'relay',
    compatibleWith: [],
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
    color: '#7c7fca',
    semanticDescription: 'HTTP REST API endpoint controller',
    groupId: 'api',
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
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'verb',
        label: 'Method',
        type: 'enum',
        semanticDescription: 'HTTP method for this endpoint',
        options: [{ value: 'GET' }, { value: 'POST' }, { value: 'PUT' }, { value: 'PATCH' }, { value: 'DELETE' }],
        default: 'GET',
        displayTier: 'minimal',
        displayOrder: 1,
      },
      {
        name: 'summary',
        label: 'Summary',
        type: 'string',
        semanticDescription: 'Brief description of endpoint purpose and behavior',
        placeholder: 'Brief description of this endpoint',
        displayTier: 'details',
        displayOrder: 2,
      },
      {
        name: 'responseType',
        label: 'Response Type',
        type: 'enum',
        semanticDescription: 'Expected return type of this endpoint',
        options: [{ value: 'object' }, { value: 'array' }, { value: 'string' }, { value: 'number' }, { value: 'boolean' }, { value: 'void' }],
        default: 'object',
        displayTier: 'details',
        displayOrder: 3,
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
    color: '#c49a4c',
    semanticDescription: 'Database instance or schema container',
    groupId: 'database',
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
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'note',
        label: 'Note',
        type: 'string',
        semanticDescription: 'Additional notes or context about this database',
        placeholder: 'Description of this database',
        displayTier: 'details',
        displayOrder: 1,
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
    color: '#8a7cb8',
    semanticDescription: 'Database table or entity',
    groupId: 'database',
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
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'columns',
        label: 'Columns',
        type: 'string',
        semanticDescription: 'Column definitions for this table',
        placeholder: 'e.g., email VARCHAR(255)',
        displayTier: 'details',
        displayOrder: 1,
      },
      {
        name: 'constraints',
        label: 'Constraints',
        type: 'string',
        semanticDescription: 'Table-level constraints and rules',
        placeholder: 'e.g., (email) [unique], (age) [not null]',
        displayTier: 'full',
        displayOrder: 2,
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
    color: '#8a7cb8',
    semanticDescription: 'A database table attribute/column',
    groupId: 'database',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Column name', displayTier: 'pill', displayOrder: 0 },
      { name: 'dataType', label: 'Type', type: 'enum', semanticDescription: 'SQL data type for this column', options: [{ value: 'VARCHAR' }, { value: 'INT' }, { value: 'BIGINT' }, { value: 'BOOLEAN' }, { value: 'DATE' }, { value: 'TIMESTAMP' }, { value: 'TEXT' }, { value: 'JSON' }], displayTier: 'minimal', displayOrder: 1, default: 'VARCHAR' },
      { name: 'primaryKey', label: 'Primary Key', type: 'boolean', semanticDescription: 'Whether this column is part of the primary key', default: false, displayTier: 'details', displayOrder: 2 },
      { name: 'nullable', label: 'Nullable', type: 'boolean', semanticDescription: 'Whether this column allows NULL values', default: true, displayTier: 'details', displayOrder: 3 },
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
    color: '#9488b8',
    semanticDescription: 'A database constraint (unique, foreign key, check, etc.)',
    groupId: 'database',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Constraint name identifier', placeholder: 'e.g., fk_user_profile', displayTier: 'pill', displayOrder: 0 },
      { name: 'constraintType', label: 'Type', type: 'enum', semanticDescription: 'Type of database constraint', options: [{ value: 'PRIMARY KEY' }, { value: 'UNIQUE' }, { value: 'FOREIGN KEY' }, { value: 'CHECK' }, { value: 'NOT NULL' }, { value: 'DEFAULT' }], default: 'UNIQUE', displayTier: 'minimal', displayOrder: 1 },
      { name: 'columns', label: 'Columns', type: 'string', semanticDescription: 'Columns affected by this constraint', placeholder: 'e.g., user_id, profile_id', displayTier: 'details', displayOrder: 2 },
      { name: 'definition', label: 'Definition', type: 'string', semanticDescription: 'Full SQL constraint definition', displayHint: 'code', placeholder: 'Detailed constraint definition', displayTier: 'full', displayOrder: 3 },
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
    color: '#7c7fca',
    semanticDescription: 'Request or response model for an API endpoint',
    groupId: 'api',
    fields: [
      {
        name: 'modelName',
        label: 'Model Name',
        type: 'string',
        semanticDescription: 'Name of the request or response model type',
        placeholder: 'e.g., CreateUserRequest, UserResponse',
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'modelType',
        label: 'Model Type',
        type: 'enum',
        semanticDescription: 'Whether this is a request or response model',
        options: [{ value: 'request' }, { value: 'response' }],
        default: 'request',
        displayTier: 'minimal',
        displayOrder: 1,
      },
      {
        name: 'data',
        label: 'Data',
        type: 'string',
        semanticDescription: 'Structure and fields of the model',
        placeholder: 'Describe the data structure',
        displayTier: 'details',
        displayOrder: 2,
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
    color: '#5ba88e',
    semanticDescription: 'A user interaction or event in the UI',
    groupId: 'ui',
    fields: [
      {
        name: 'eventName',
        label: 'Event Name',
        type: 'string',
        semanticDescription: 'Name of the UI event or user action',
        placeholder: 'e.g., Click Submit, Load Page',
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'trigger',
        label: 'Trigger',
        type: 'string',
        semanticDescription: 'What causes this event to fire',
        placeholder: 'What triggers this event?',
        displayTier: 'minimal',
        displayOrder: 1,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        semanticDescription: 'Detailed description of the event behavior and purpose',
        placeholder: 'Describe the event or user action',
        displayTier: 'details',
        displayOrder: 2,
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
    color: '#6a8fc0',
    semanticDescription: 'A screen or view in the user interface',
    groupId: 'ui',
    fields: [
      {
        name: 'screenName',
        label: 'Screen Name',
        type: 'string',
        semanticDescription: 'Name of the UI screen or view',
        placeholder: 'e.g., Login, Dashboard, Profile',
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        semanticDescription: 'Purpose and content of this screen',
        placeholder: 'Describe the screen or view',
        displayTier: 'details',
        displayOrder: 1,
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
    color: '#5ba88e',
    semanticDescription: 'A user story or requirement',
    groupId: 'software-architecture',
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        semanticDescription: 'Short title summarizing the user story',
        placeholder: 'e.g., User Login, Create Account',
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        semanticDescription: 'Full user story in "As a X, I want Y, so that Z" format',
        placeholder: 'As a [user], I want [goal] so that [benefit]',
        displayTier: 'minimal',
        displayOrder: 1,
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

  // Note
  {
    type: 'note',
    displayName: 'Note',
    color: '#c4a94e',
    semanticDescription: 'A freeform note or annotation',
    backgroundColorPolicy: 'any',
    portDisplayPolicy: 'collapsed',
    fields: [
      {
        name: 'content',
        label: 'Content',
        type: 'string',
        displayHint: 'multiline',
        semanticDescription: 'Freeform note content',
        placeholder: 'Type here...',
        displayTier: 'minimal',
        displayOrder: 0,
      },
    ],
    ports: [
      { id: 'link', portType: 'symmetric', position: 'right', offset: 50, label: 'Link' },
    ],
    compilation: {
      format: 'json',
      sectionHeader: '# Notes',
    },
  },

  // Implementation Details
  {
    type: 'implementation-details',
    displayName: 'Implementation Details',
    color: '#6b7280',
    semanticDescription: 'Technical implementation notes and documentation',
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
        displayTier: 'pill',
        displayOrder: 0,
      },
    ],
    compilation: {
      format: 'json',
      sectionHeader: '# Implementation Details',
    },
  },
];
