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
  {
    id: 'sketching',
    name: 'Sketching',
    color: '#64748b',
    description: 'Quick, low-friction constructs for rough modeling',
  },
  {
    id: 'bpmn',
    name: 'BPMN',
    color: '#3b82f6',
    description: 'Simplified Business Process Model and Notation',
  },
  {
    id: 'aws',
    name: 'AWS',
    color: '#ff9900',
    description: 'Amazon Web Services cloud architecture constructs',
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
    color: '#3b82f6',
  },
  {
    id: 'flow-out',
    displayName: 'Flow Out',
    semanticDescription: 'Sends data or control flow',
    polarity: 'source',
    compatibleWith: ['flow-in'],
    expectedComplement: 'flow-in',
    color: '#22c55e',
  },
  {
    id: 'parent',
    displayName: 'Parent',
    semanticDescription: 'Contains or owns the connected construct',
    polarity: 'source',
    compatibleWith: ['child'],
    expectedComplement: 'child',
    color: '#8b5cf6',
  },
  {
    id: 'child',
    displayName: 'Child',
    semanticDescription: 'Is contained by or owned by the connected construct',
    polarity: 'sink',
    compatibleWith: ['parent'],
    expectedComplement: 'parent',
    color: '#8b5cf6',
  },
  {
    id: 'symmetric',
    displayName: 'Link',
    semanticDescription: 'Bidirectional peer connection',
    polarity: 'bidirectional',
    compatibleWith: [],
    color: '#64748b',
  },
  {
    id: 'intercept',
    displayName: 'Intercept',
    semanticDescription: 'Pass-through input accepting any source connection (bypasses type checking)',
    polarity: 'intercept',
    compatibleWith: [],
    color: '#f59e0b',
  },
  {
    id: 'relay',
    displayName: 'Relay',
    semanticDescription: 'Pass-through output connecting to any sink port (bypasses type checking)',
    polarity: 'relay',
    compatibleWith: [],
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
  // REST Endpoint
  {
    type: 'rest-endpoint',
    displayName: 'REST Endpoint',
    color: '#7c7fca',
    semanticDescription: 'HTTP REST API endpoint',
    groupId: 'api',
    ports: [
      { id: 'flow-in', portType: 'flow-in', label: 'Flow In', semanticDescription: 'Incoming request flow from upstream' },
      { id: 'flow-out', portType: 'flow-out', label: 'Flow Out', semanticDescription: 'Downstream flow to services or handlers' },
      { id: 'parent', portType: 'parent', label: 'Models', semanticDescription: 'Owns API request/response models' },
      { id: 'policy-in', portType: 'flow-in', label: 'Policies', semanticDescription: 'Connected policies (auth, rate limit, cache)' },
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
      },
      {
        constructType: 'auth-policy',
        fromPortId: 'policy-in',
        toPortId: 'flow-out',
        label: 'Add Auth Policy'
      },
      {
        constructType: 'rate-limit',
        fromPortId: 'policy-in',
        toPortId: 'flow-out',
        label: 'Add Rate Limit'
      },
    ],
    compilation: {
      format: 'json',
      sectionHeader: '# REST Endpoints',
    },
  },

  // Auth Policy
  {
    type: 'auth-policy',
    displayName: 'Auth Policy',
    color: '#dc2626',
    semanticDescription: 'Authentication and authorization policy for API endpoints',
    groupId: 'api',
    ports: [
      { id: 'flow-out', portType: 'flow-out', label: 'Applies To', semanticDescription: 'Endpoints this policy applies to' },
    ],
    fields: [
      {
        name: 'name',
        label: 'Name',
        type: 'string',
        semanticDescription: 'Policy name',
        placeholder: 'e.g., JWT Auth, API Key',
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'authType',
        label: 'Auth Type',
        type: 'enum',
        semanticDescription: 'Authentication mechanism',
        options: [{ value: 'API Key' }, { value: 'JWT' }, { value: 'OAuth2' }, { value: 'Basic' }, { value: 'IAM' }, { value: 'Custom' }],
        default: 'JWT',
        displayTier: 'minimal',
        displayOrder: 1,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        semanticDescription: 'Policy details and requirements',
        placeholder: 'Describe auth requirements',
        displayTier: 'details',
        displayOrder: 2,
      },
    ],
    suggestedRelated: [
      {
        constructType: 'rest-endpoint',
        fromPortId: 'flow-out',
        toPortId: 'policy-in',
        label: 'Apply to Endpoint'
      },
    ],
    compilation: { format: 'json' },
  },

  // Rate Limit
  {
    type: 'rate-limit',
    displayName: 'Rate Limit',
    color: '#f59e0b',
    semanticDescription: 'Rate limiting policy for API endpoints',
    groupId: 'api',
    ports: [
      { id: 'flow-out', portType: 'flow-out', label: 'Applies To', semanticDescription: 'Endpoints this limit applies to' },
    ],
    fields: [
      {
        name: 'name',
        label: 'Name',
        type: 'string',
        semanticDescription: 'Rate limit name',
        placeholder: 'e.g., Standard, Premium',
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'requests',
        label: 'Requests',
        type: 'number',
        semanticDescription: 'Number of requests allowed',
        default: 100,
        displayTier: 'minimal',
        displayOrder: 1,
      },
      {
        name: 'window',
        label: 'Window',
        type: 'enum',
        semanticDescription: 'Time window for rate limit',
        options: [{ value: 'second' }, { value: 'minute' }, { value: 'hour' }, { value: 'day' }],
        default: 'minute',
        displayTier: 'minimal',
        displayOrder: 2,
      },
      {
        name: 'scope',
        label: 'Scope',
        type: 'enum',
        semanticDescription: 'How the limit is applied',
        options: [{ value: 'per-user' }, { value: 'per-ip' }, { value: 'global' }],
        default: 'per-user',
        displayTier: 'details',
        displayOrder: 3,
      },
    ],
    suggestedRelated: [
      {
        constructType: 'rest-endpoint',
        fromPortId: 'flow-out',
        toPortId: 'policy-in',
        label: 'Apply to Endpoint'
      },
    ],
    compilation: { format: 'json' },
  },

  // Cache Policy
  {
    type: 'cache-policy',
    displayName: 'Cache Policy',
    color: '#06b6d4',
    semanticDescription: 'Caching policy for API endpoints',
    groupId: 'api',
    ports: [
      { id: 'flow-out', portType: 'flow-out', label: 'Applies To', semanticDescription: 'Endpoints this policy applies to' },
    ],
    fields: [
      {
        name: 'name',
        label: 'Name',
        type: 'string',
        semanticDescription: 'Cache policy name',
        placeholder: 'e.g., Short TTL, Long TTL',
        displayTier: 'pill',
        displayOrder: 0,
      },
      {
        name: 'ttl',
        label: 'TTL (seconds)',
        type: 'number',
        semanticDescription: 'Cache time-to-live in seconds',
        default: 300,
        displayTier: 'minimal',
        displayOrder: 1,
      },
      {
        name: 'location',
        label: 'Location',
        type: 'enum',
        semanticDescription: 'Where caching occurs',
        options: [{ value: 'edge' }, { value: 'origin' }, { value: 'both' }],
        default: 'edge',
        displayTier: 'minimal',
        displayOrder: 2,
      },
      {
        name: 'varyBy',
        label: 'Vary By',
        type: 'string',
        semanticDescription: 'Cache key variations',
        placeholder: 'e.g., Authorization, Accept-Language',
        displayTier: 'details',
        displayOrder: 3,
      },
    ],
    suggestedRelated: [
      {
        constructType: 'rest-endpoint',
        fromPortId: 'flow-out',
        toPortId: 'policy-in',
        label: 'Apply to Endpoint'
      },
    ],
    compilation: { format: 'json' },
  },

  // Database
  {
    type: 'database',
    displayName: 'Database',
    color: '#c49a4c',
    semanticDescription: 'Database instance or schema container',
    groupId: 'database',
    ports: [
      { id: 'link-in', portType: 'flow-in', label: 'Referenced By', semanticDescription: 'External constructs referencing this database' },
      { id: 'child', portType: 'child', label: 'Tables', semanticDescription: 'Tables that belong to this database' },
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
        constructType: 'rest-endpoint',
        fromPortId: 'link-in',
        toPortId: 'flow-out',
        label: 'Add REST Endpoint'
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
      { id: 'link-in', portType: 'flow-in', label: 'Referenced By', semanticDescription: 'Tables or constructs that reference this table' },
      { id: 'link-out', portType: 'flow-out', label: 'References', semanticDescription: 'Tables or constructs this table references' },
      { id: 'parent', portType: 'parent', label: 'Database', semanticDescription: 'Database that owns this table' },
      { id: 'child', portType: 'child', label: 'Attributes & Constraints', semanticDescription: 'Attributes and constraints that belong to this table' },
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
      { id: 'parent', portType: 'parent', label: 'Table', semanticDescription: 'Table that owns this attribute' },
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
      { id: 'parent', portType: 'parent', label: 'Table', semanticDescription: 'Table that owns this constraint' },
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
      { id: 'child', portType: 'child', label: 'Controller', semanticDescription: 'Controller endpoint that uses this model' },
    ],
    suggestedRelated: [
      {
        constructType: 'rest-endpoint',
        fromPortId: 'child',
        toPortId: 'parent',
        label: 'Add to Endpoint'
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
      { id: 'child', portType: 'child', label: 'Events', semanticDescription: 'Child events that originate from this event' },
      { id: 'flow-out', portType: 'flow-out', label: 'Flow Out', semanticDescription: 'Next UI flow that follows this event' },
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
      { id: 'flow-in', portType: 'flow-in', label: 'Flow In', semanticDescription: 'Incoming UI flow into this screen' },
      { id: 'parent', portType: 'parent', label: 'Events', semanticDescription: 'Events that belong to this screen' },
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
      { id: 'flow-out', portType: 'flow-out', label: 'Flow Out', semanticDescription: 'Outcome or follow-on user story' },
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
      { id: 'link', portType: 'symmetric', label: 'Link' },
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
      { id: 'link', portType: 'symmetric', label: 'Related To', semanticDescription: 'Bidirectional relationship to related constructs' },
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

  // --- BPMN ---

  // BPMN Activity (Task / Subprocess)
  {
    type: 'bpmn-activity',
    displayName: 'Activity',
    color: '#3b82f6',
    semanticDescription: 'A task or subprocess in a business process',
    groupId: 'bpmn',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Activity name', placeholder: 'e.g., Review Application', displayTier: 'pill', displayOrder: 0 },
      { name: 'activityType', label: 'Type', type: 'enum', semanticDescription: 'Kind of activity', options: [{ value: 'Task' }, { value: 'Subprocess' }, { value: 'Call Activity' }], default: 'Task', displayTier: 'minimal', displayOrder: 1 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'What this activity does', placeholder: 'Describe the activity', displayTier: 'details', displayOrder: 2 },
    ],
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'Sequence In', semanticDescription: 'Incoming sequence flow' },
      { id: 'seq-out', portType: 'flow-out', label: 'Sequence Out', semanticDescription: 'Outgoing sequence flow' },
      { id: 'child', portType: 'child', label: 'Lane', semanticDescription: 'Lane or pool containing this activity' },
      { id: 'parent', portType: 'parent', label: 'Sub-activities', semanticDescription: 'Child activities within this subprocess' },
      { id: 'data-link', portType: 'symmetric', label: 'Data', semanticDescription: 'Associated data objects' },
    ],
    suggestedRelated: [
      { constructType: 'bpmn-gateway', fromPortId: 'seq-out', toPortId: 'seq-in', label: 'Add Gateway' },
      { constructType: 'bpmn-event', fromPortId: 'seq-out', toPortId: 'seq-in', label: 'Add Event' },
      { constructType: 'bpmn-data-object', fromPortId: 'data-link', toPortId: 'data-link', label: 'Add Data Object' },
    ],
    compilation: { format: 'json' },
  },

  // BPMN Event (Start / Intermediate / End)
  {
    type: 'bpmn-event',
    displayName: 'Event',
    color: '#22c55e',
    semanticDescription: 'A start, intermediate, or end event in a business process',
    groupId: 'bpmn',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Event label', placeholder: 'e.g., Order Received', displayTier: 'pill', displayOrder: 0 },
      { name: 'eventPosition', label: 'Position', type: 'enum', semanticDescription: 'Where this event occurs in the process', options: [{ value: 'Start' }, { value: 'Intermediate' }, { value: 'End' }], default: 'Start', displayTier: 'minimal', displayOrder: 1 },
      { name: 'trigger', label: 'Trigger', type: 'enum', semanticDescription: 'What causes this event', options: [{ value: 'None' }, { value: 'Message' }, { value: 'Timer' }, { value: 'Error' }, { value: 'Signal' }], default: 'None', displayTier: 'minimal', displayOrder: 2 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Event details', placeholder: 'Describe the event', displayTier: 'details', displayOrder: 3 },
    ],
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'Sequence In', semanticDescription: 'Incoming sequence flow (intermediate/end)' },
      { id: 'seq-out', portType: 'flow-out', label: 'Sequence Out', semanticDescription: 'Outgoing sequence flow (start/intermediate)' },
      { id: 'child', portType: 'child', label: 'Lane', semanticDescription: 'Lane or pool containing this event' },
    ],
    suggestedRelated: [
      { constructType: 'bpmn-activity', fromPortId: 'seq-out', toPortId: 'seq-in', label: 'Add Activity' },
    ],
    compilation: { format: 'json' },
  },

  // BPMN Gateway (Exclusive / Parallel / Inclusive)
  {
    type: 'bpmn-gateway',
    displayName: 'Gateway',
    color: '#f59e0b',
    semanticDescription: 'A decision or merge point in a business process',
    groupId: 'bpmn',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Gateway label', placeholder: 'e.g., Approved?', displayTier: 'pill', displayOrder: 0 },
      { name: 'gatewayType', label: 'Type', type: 'enum', semanticDescription: 'Gateway behavior', options: [{ value: 'Exclusive (XOR)' }, { value: 'Parallel (AND)' }, { value: 'Inclusive (OR)' }, { value: 'Event-Based' }], default: 'Exclusive (XOR)', displayTier: 'minimal', displayOrder: 1 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Decision logic or merge conditions', placeholder: 'Describe the branching logic', displayTier: 'details', displayOrder: 2 },
    ],
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'Sequence In', semanticDescription: 'Incoming sequence flows to merge' },
      { id: 'seq-out', portType: 'flow-out', label: 'Sequence Out', semanticDescription: 'Outgoing sequence flows to branch' },
      { id: 'child', portType: 'child', label: 'Lane', semanticDescription: 'Lane or pool containing this gateway' },
    ],
    suggestedRelated: [
      { constructType: 'bpmn-activity', fromPortId: 'seq-out', toPortId: 'seq-in', label: 'Add Activity' },
      { constructType: 'bpmn-event', fromPortId: 'seq-out', toPortId: 'seq-in', label: 'Add End Event' },
    ],
    compilation: { format: 'json' },
  },

  // BPMN Pool (Participant)
  {
    type: 'bpmn-pool',
    displayName: 'Pool',
    color: '#6366f1',
    semanticDescription: 'A participant or organization in a business process',
    groupId: 'bpmn',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Participant name', placeholder: 'e.g., Customer, Fulfillment', displayTier: 'pill', displayOrder: 0 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Role or responsibility of this participant', placeholder: 'Describe the participant', displayTier: 'details', displayOrder: 1 },
    ],
    ports: [
      { id: 'parent', portType: 'parent', label: 'Lanes', semanticDescription: 'Lanes within this pool' },
      { id: 'msg-out', portType: 'relay', label: 'Message Out', semanticDescription: 'Sends messages to other pools' },
      { id: 'msg-in', portType: 'intercept', label: 'Message In', semanticDescription: 'Receives messages from other pools' },
    ],
    suggestedRelated: [
      { constructType: 'bpmn-lane', fromPortId: 'parent', toPortId: 'child', label: 'Add Lane' },
    ],
    compilation: { format: 'json', sectionHeader: '# Business Process' },
  },

  // BPMN Lane (Role subdivision within a Pool)
  {
    type: 'bpmn-lane',
    displayName: 'Lane',
    color: '#818cf8',
    semanticDescription: 'A role or department subdivision within a pool',
    groupId: 'bpmn',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Lane role name', placeholder: 'e.g., Sales, Accounting', displayTier: 'pill', displayOrder: 0 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Responsibility of this lane', placeholder: 'Describe the role', displayTier: 'details', displayOrder: 1 },
    ],
    ports: [
      { id: 'child', portType: 'child', label: 'Pool', semanticDescription: 'Pool that contains this lane' },
      { id: 'parent', portType: 'parent', label: 'Elements', semanticDescription: 'Activities, events, and gateways in this lane' },
    ],
    suggestedRelated: [
      { constructType: 'bpmn-activity', fromPortId: 'parent', toPortId: 'child', label: 'Add Activity' },
      { constructType: 'bpmn-event', fromPortId: 'parent', toPortId: 'child', label: 'Add Event' },
    ],
    compilation: { format: 'json' },
  },

  // BPMN Data Object (reified)
  {
    type: 'bpmn-data-object',
    displayName: 'Data Object',
    color: '#8b5cf6',
    semanticDescription: 'An information artifact used or produced by activities',
    groupId: 'bpmn',
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Data object name', placeholder: 'e.g., Invoice, Purchase Order', displayTier: 'pill', displayOrder: 0 },
      { name: 'state', label: 'State', type: 'string', semanticDescription: 'Current state of the data', placeholder: 'e.g., Draft, Approved', displayTier: 'minimal', displayOrder: 1 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Data content and structure', placeholder: 'Describe the data', displayTier: 'details', displayOrder: 2 },
    ],
    ports: [
      { id: 'data-link', portType: 'symmetric', label: 'Used By', semanticDescription: 'Activities that use or produce this data' },
    ],
    suggestedRelated: [
      { constructType: 'bpmn-activity', fromPortId: 'data-link', toPortId: 'data-link', label: 'Link to Activity' },
    ],
    compilation: { format: 'json' },
  },

  // Box (Sketching)
  {
    type: 'box',
    displayName: 'Box',
    color: '#64748b',
    renderStyle: 'card',
    backgroundColorPolicy: 'any',
    groupId: 'sketching',
    semanticDescription: 'Generic box for rough modeling',
    fields: [
      { name: 'label', label: 'Label', type: 'string', displayTier: 'pill', displayOrder: 0, placeholder: 'Label...' },
      { name: 'notes', label: 'Notes', type: 'string', displayHint: 'multiline', displayTier: 'details', displayOrder: 1, placeholder: 'Notes...' },
    ],
    ports: [
      { id: 'flow-in', portType: 'flow-in', label: 'In' },
      { id: 'flow-out', portType: 'flow-out', label: 'Out' },
      { id: 'parent', portType: 'parent', label: 'Parent' },
      { id: 'child', portType: 'child', label: 'Child' },
    ],
    compilation: { format: 'json' },
  },

  // --- AWS ---

  // Lambda Function
  {
    type: 'aws-lambda',
    displayName: 'Lambda',
    color: '#ff9900',
    semanticDescription: 'AWS Lambda serverless function',
    groupId: 'aws',
    ports: [
      { id: 'trigger-in', portType: 'flow-in', label: 'Triggers', semanticDescription: 'Event sources that invoke this function' },
      { id: 'invoke-out', portType: 'flow-out', label: 'Invokes', semanticDescription: 'Services this function calls' },
      { id: 'child', portType: 'child', label: 'VPC', semanticDescription: 'VPC this function runs in' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Function name', placeholder: 'e.g., processOrder', displayTier: 'pill', displayOrder: 0 },
      { name: 'runtime', label: 'Runtime', type: 'enum', semanticDescription: 'Execution runtime', options: [{ value: 'Node.js 20' }, { value: 'Python 3.12' }, { value: 'Java 21' }, { value: 'Go' }, { value: '.NET 8' }, { value: 'Ruby' }, { value: 'Custom' }], default: 'Node.js 20', displayTier: 'minimal', displayOrder: 1 },
      { name: 'memory', label: 'Memory (MB)', type: 'number', semanticDescription: 'Allocated memory in MB', default: 128, displayTier: 'details', displayOrder: 2 },
      { name: 'timeout', label: 'Timeout (s)', type: 'number', semanticDescription: 'Execution timeout in seconds', default: 30, displayTier: 'details', displayOrder: 3 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Function purpose', placeholder: 'What does this function do?', displayTier: 'details', displayOrder: 4 },
    ],
    suggestedRelated: [
      { constructType: 'aws-dynamodb', fromPortId: 'invoke-out', toPortId: 'access-in', label: 'Access DynamoDB' },
      { constructType: 'aws-s3', fromPortId: 'invoke-out', toPortId: 'access-in', label: 'Access S3' },
      { constructType: 'aws-sqs', fromPortId: 'invoke-out', toPortId: 'access-in', label: 'Send to SQS' },
    ],
    compilation: { format: 'json', sectionHeader: '# AWS Lambda Functions' },
  },

  // API Gateway
  {
    type: 'aws-api-gateway',
    displayName: 'API Gateway',
    color: '#ff9900',
    semanticDescription: 'AWS API Gateway REST or HTTP API',
    groupId: 'aws',
    ports: [
      { id: 'flow-in', portType: 'flow-in', label: 'Requests', semanticDescription: 'Incoming API requests' },
      { id: 'invoke-out', portType: 'flow-out', label: 'Backend', semanticDescription: 'Backend integrations (Lambda, HTTP)' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'API name', placeholder: 'e.g., OrderAPI', displayTier: 'pill', displayOrder: 0 },
      { name: 'apiType', label: 'Type', type: 'enum', semanticDescription: 'API type', options: [{ value: 'REST' }, { value: 'HTTP' }, { value: 'WebSocket' }], default: 'REST', displayTier: 'minimal', displayOrder: 1 },
      { name: 'stage', label: 'Stage', type: 'string', semanticDescription: 'Deployment stage', placeholder: 'e.g., prod, dev', default: 'prod', displayTier: 'minimal', displayOrder: 2 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'API purpose', placeholder: 'What does this API do?', displayTier: 'details', displayOrder: 3 },
    ],
    suggestedRelated: [
      { constructType: 'aws-lambda', fromPortId: 'invoke-out', toPortId: 'trigger-in', label: 'Invoke Lambda' },
    ],
    compilation: { format: 'json' },
  },

  // S3 Bucket
  {
    type: 'aws-s3',
    displayName: 'S3 Bucket',
    color: '#569a31',
    semanticDescription: 'AWS S3 object storage bucket',
    groupId: 'aws',
    ports: [
      { id: 'access-in', portType: 'flow-in', label: 'Accessed By', semanticDescription: 'Services that read/write this bucket' },
      { id: 'trigger-out', portType: 'flow-out', label: 'Triggers', semanticDescription: 'Event notifications to Lambda/SQS/SNS' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Bucket name', placeholder: 'e.g., my-app-uploads', displayTier: 'pill', displayOrder: 0 },
      { name: 'accessLevel', label: 'Access', type: 'enum', semanticDescription: 'Bucket access level', options: [{ value: 'Private' }, { value: 'Public Read' }, { value: 'Public Read/Write' }], default: 'Private', displayTier: 'minimal', displayOrder: 1 },
      { name: 'versioning', label: 'Versioning', type: 'boolean', semanticDescription: 'Enable versioning', default: false, displayTier: 'details', displayOrder: 2 },
      { name: 'purpose', label: 'Purpose', type: 'string', semanticDescription: 'What this bucket stores', placeholder: 'e.g., User uploads, Static assets', displayTier: 'details', displayOrder: 3 },
    ],
    suggestedRelated: [
      { constructType: 'aws-lambda', fromPortId: 'trigger-out', toPortId: 'trigger-in', label: 'Trigger Lambda' },
    ],
    compilation: { format: 'json' },
  },

  // DynamoDB Table
  {
    type: 'aws-dynamodb',
    displayName: 'DynamoDB',
    color: '#4053d6',
    semanticDescription: 'AWS DynamoDB NoSQL table',
    groupId: 'aws',
    ports: [
      { id: 'access-in', portType: 'flow-in', label: 'Accessed By', semanticDescription: 'Services that read/write this table' },
      { id: 'stream-out', portType: 'flow-out', label: 'Streams', semanticDescription: 'DynamoDB Streams triggers' },
    ],
    fields: [
      { name: 'tableName', label: 'Table Name', type: 'string', semanticDescription: 'Table name', placeholder: 'e.g., Orders', displayTier: 'pill', displayOrder: 0 },
      { name: 'partitionKey', label: 'Partition Key', type: 'string', semanticDescription: 'Primary partition key', placeholder: 'e.g., userId', displayTier: 'minimal', displayOrder: 1 },
      { name: 'sortKey', label: 'Sort Key', type: 'string', semanticDescription: 'Optional sort key', placeholder: 'e.g., timestamp', displayTier: 'minimal', displayOrder: 2 },
      { name: 'billingMode', label: 'Billing', type: 'enum', semanticDescription: 'Capacity billing mode', options: [{ value: 'On-Demand' }, { value: 'Provisioned' }], default: 'On-Demand', displayTier: 'details', displayOrder: 3 },
    ],
    suggestedRelated: [
      { constructType: 'aws-lambda', fromPortId: 'stream-out', toPortId: 'trigger-in', label: 'Stream to Lambda' },
    ],
    compilation: { format: 'json' },
  },

  // SQS Queue
  {
    type: 'aws-sqs',
    displayName: 'SQS Queue',
    color: '#ff4f8b',
    semanticDescription: 'AWS SQS message queue',
    groupId: 'aws',
    ports: [
      { id: 'access-in', portType: 'flow-in', label: 'Producers', semanticDescription: 'Services that send messages to this queue' },
      { id: 'trigger-out', portType: 'flow-out', label: 'Consumers', semanticDescription: 'Services that consume from this queue' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Queue name', placeholder: 'e.g., order-processing', displayTier: 'pill', displayOrder: 0 },
      { name: 'queueType', label: 'Type', type: 'enum', semanticDescription: 'Queue type', options: [{ value: 'Standard' }, { value: 'FIFO' }], default: 'Standard', displayTier: 'minimal', displayOrder: 1 },
      { name: 'visibilityTimeout', label: 'Visibility (s)', type: 'number', semanticDescription: 'Visibility timeout in seconds', default: 30, displayTier: 'details', displayOrder: 2 },
      { name: 'dlq', label: 'DLQ', type: 'boolean', semanticDescription: 'Has dead-letter queue', default: true, displayTier: 'details', displayOrder: 3 },
    ],
    suggestedRelated: [
      { constructType: 'aws-lambda', fromPortId: 'trigger-out', toPortId: 'trigger-in', label: 'Trigger Lambda' },
    ],
    compilation: { format: 'json' },
  },

  // SNS Topic
  {
    type: 'aws-sns',
    displayName: 'SNS Topic',
    color: '#d93f68',
    semanticDescription: 'AWS SNS pub/sub topic',
    groupId: 'aws',
    ports: [
      { id: 'publish-in', portType: 'flow-in', label: 'Publishers', semanticDescription: 'Services that publish to this topic' },
      { id: 'subscribe-out', portType: 'flow-out', label: 'Subscribers', semanticDescription: 'Services subscribed to this topic' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Topic name', placeholder: 'e.g., order-events', displayTier: 'pill', displayOrder: 0 },
      { name: 'topicType', label: 'Type', type: 'enum', semanticDescription: 'Topic type', options: [{ value: 'Standard' }, { value: 'FIFO' }], default: 'Standard', displayTier: 'minimal', displayOrder: 1 },
      { name: 'purpose', label: 'Purpose', type: 'string', semanticDescription: 'What events this topic handles', placeholder: 'e.g., Order lifecycle events', displayTier: 'details', displayOrder: 2 },
    ],
    suggestedRelated: [
      { constructType: 'aws-sqs', fromPortId: 'subscribe-out', toPortId: 'access-in', label: 'Subscribe SQS' },
      { constructType: 'aws-lambda', fromPortId: 'subscribe-out', toPortId: 'trigger-in', label: 'Subscribe Lambda' },
    ],
    compilation: { format: 'json' },
  },

  // RDS Instance
  {
    type: 'aws-rds',
    displayName: 'RDS Database',
    color: '#4053d6',
    semanticDescription: 'AWS RDS relational database instance',
    groupId: 'aws',
    ports: [
      { id: 'access-in', portType: 'flow-in', label: 'Clients', semanticDescription: 'Services that connect to this database' },
      { id: 'child', portType: 'child', label: 'VPC', semanticDescription: 'VPC this database runs in' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Instance identifier', placeholder: 'e.g., orders-db', displayTier: 'pill', displayOrder: 0 },
      { name: 'engine', label: 'Engine', type: 'enum', semanticDescription: 'Database engine', options: [{ value: 'PostgreSQL' }, { value: 'MySQL' }, { value: 'MariaDB' }, { value: 'SQL Server' }, { value: 'Oracle' }, { value: 'Aurora PostgreSQL' }, { value: 'Aurora MySQL' }], default: 'PostgreSQL', displayTier: 'minimal', displayOrder: 1 },
      { name: 'instanceClass', label: 'Instance', type: 'string', semanticDescription: 'Instance class', placeholder: 'e.g., db.t3.micro', default: 'db.t3.micro', displayTier: 'details', displayOrder: 2 },
      { name: 'multiAz', label: 'Multi-AZ', type: 'boolean', semanticDescription: 'Multi-AZ deployment', default: false, displayTier: 'details', displayOrder: 3 },
    ],
    suggestedRelated: [
      { constructType: 'aws-vpc', fromPortId: 'child', toPortId: 'parent', label: 'Place in VPC' },
    ],
    compilation: { format: 'json' },
  },

  // VPC
  {
    type: 'aws-vpc',
    displayName: 'VPC',
    color: '#8c4fff',
    semanticDescription: 'AWS Virtual Private Cloud network',
    groupId: 'aws',
    ports: [
      { id: 'parent', portType: 'parent', label: 'Resources', semanticDescription: 'Resources running in this VPC' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'VPC name', placeholder: 'e.g., production-vpc', displayTier: 'pill', displayOrder: 0 },
      { name: 'cidr', label: 'CIDR', type: 'string', semanticDescription: 'IP address range', placeholder: 'e.g., 10.0.0.0/16', default: '10.0.0.0/16', displayTier: 'minimal', displayOrder: 1 },
      { name: 'purpose', label: 'Purpose', type: 'string', semanticDescription: 'VPC purpose', placeholder: 'e.g., Production workloads', displayTier: 'details', displayOrder: 2 },
    ],
    suggestedRelated: [
      { constructType: 'aws-lambda', fromPortId: 'parent', toPortId: 'child', label: 'Add Lambda' },
      { constructType: 'aws-rds', fromPortId: 'parent', toPortId: 'child', label: 'Add RDS' },
    ],
    compilation: { format: 'json', sectionHeader: '# AWS Infrastructure' },
  },

  // Step Functions State Machine
  {
    type: 'aws-sfn-state-machine',
    displayName: 'State Machine',
    color: '#ff4f8b',
    semanticDescription: 'AWS Step Functions state machine workflow',
    groupId: 'aws',
    ports: [
      { id: 'trigger-in', portType: 'flow-in', label: 'Triggers', semanticDescription: 'Services that start this workflow' },
      { id: 'parent', portType: 'parent', label: 'States', semanticDescription: 'States within this state machine' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State machine name', placeholder: 'e.g., OrderProcessing', displayTier: 'pill', displayOrder: 0 },
      { name: 'type', label: 'Type', type: 'enum', semanticDescription: 'Execution type', options: [{ value: 'Standard' }, { value: 'Express' }], default: 'Standard', displayTier: 'minimal', displayOrder: 1 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Workflow purpose', placeholder: 'What does this workflow do?', displayTier: 'details', displayOrder: 2 },
    ],
    suggestedRelated: [
      { constructType: 'aws-sfn-task', fromPortId: 'parent', toPortId: 'child', label: 'Add Task' },
      { constructType: 'aws-sfn-choice', fromPortId: 'parent', toPortId: 'child', label: 'Add Choice' },
    ],
    compilation: { format: 'json', sectionHeader: '# Step Functions Workflows' },
  },

  // Step Functions Task State
  {
    type: 'aws-sfn-task',
    displayName: 'Task State',
    color: '#ff9900',
    semanticDescription: 'Step Functions task state that performs work',
    groupId: 'aws',
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
      { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state in sequence' },
      { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
      { id: 'invoke-out', portType: 'flow-out', label: 'Resource', semanticDescription: 'Resource this task invokes' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., ProcessPayment', displayTier: 'pill', displayOrder: 0 },
      { name: 'resourceType', label: 'Resource', type: 'enum', semanticDescription: 'Task resource type', options: [{ value: 'Lambda' }, { value: 'ECS' }, { value: 'SNS' }, { value: 'SQS' }, { value: 'DynamoDB' }, { value: 'Step Functions' }, { value: 'HTTP' }], default: 'Lambda', displayTier: 'minimal', displayOrder: 1 },
      { name: 'timeout', label: 'Timeout (s)', type: 'number', semanticDescription: 'Task timeout', default: 300, displayTier: 'details', displayOrder: 2 },
      { name: 'retry', label: 'Retry', type: 'boolean', semanticDescription: 'Enable automatic retries', default: true, displayTier: 'details', displayOrder: 3 },
    ],
    suggestedRelated: [
      { constructType: 'aws-lambda', fromPortId: 'invoke-out', toPortId: 'trigger-in', label: 'Invoke Lambda' },
      { constructType: 'aws-sfn-choice', fromPortId: 'seq-out', toPortId: 'seq-in', label: 'Add Choice' },
    ],
    compilation: { format: 'json' },
  },

  // Step Functions Choice State
  {
    type: 'aws-sfn-choice',
    displayName: 'Choice State',
    color: '#f59e0b',
    semanticDescription: 'Step Functions choice state for branching logic',
    groupId: 'aws',
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
      { id: 'branch-out', portType: 'flow-out', label: 'Branches', semanticDescription: 'Conditional branches' },
      { id: 'default-out', portType: 'flow-out', label: 'Default', semanticDescription: 'Default branch if no conditions match' },
      { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., CheckOrderStatus', displayTier: 'pill', displayOrder: 0 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Decision logic description', placeholder: 'What conditions are evaluated?', displayTier: 'details', displayOrder: 1 },
    ],
    suggestedRelated: [
      { constructType: 'aws-sfn-task', fromPortId: 'branch-out', toPortId: 'seq-in', label: 'Add Branch Task' },
      { constructType: 'aws-sfn-terminal', fromPortId: 'branch-out', toPortId: 'seq-in', label: 'Add Terminal' },
    ],
    compilation: { format: 'json' },
  },

  // Step Functions Parallel State
  {
    type: 'aws-sfn-parallel',
    displayName: 'Parallel State',
    color: '#22c55e',
    semanticDescription: 'Step Functions parallel state for concurrent execution',
    groupId: 'aws',
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
      { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state after all branches complete' },
      { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
      { id: 'parent', portType: 'parent', label: 'Branches', semanticDescription: 'Parallel branch states' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., ParallelProcessing', displayTier: 'pill', displayOrder: 0 },
      { name: 'description', label: 'Description', type: 'string', semanticDescription: 'What runs in parallel', placeholder: 'What branches run concurrently?', displayTier: 'details', displayOrder: 1 },
    ],
    suggestedRelated: [
      { constructType: 'aws-sfn-task', fromPortId: 'parent', toPortId: 'child', label: 'Add Branch' },
    ],
    compilation: { format: 'json' },
  },

  // Step Functions Map State
  {
    type: 'aws-sfn-map',
    displayName: 'Map State',
    color: '#8b5cf6',
    semanticDescription: 'Step Functions map state for iterating over arrays',
    groupId: 'aws',
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
      { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state after iteration completes' },
      { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
      { id: 'parent', portType: 'parent', label: 'Iterator', semanticDescription: 'States executed for each item' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., ProcessItems', displayTier: 'pill', displayOrder: 0 },
      { name: 'maxConcurrency', label: 'Max Concurrency', type: 'number', semanticDescription: 'Maximum parallel iterations', default: 0, displayTier: 'minimal', displayOrder: 1 },
      { name: 'itemsPath', label: 'Items Path', type: 'string', semanticDescription: 'JSONPath to array to iterate', placeholder: '$.items', displayTier: 'details', displayOrder: 2 },
    ],
    suggestedRelated: [
      { constructType: 'aws-sfn-task', fromPortId: 'parent', toPortId: 'child', label: 'Add Iterator Task' },
    ],
    compilation: { format: 'json' },
  },

  // Step Functions Wait State
  {
    type: 'aws-sfn-wait',
    displayName: 'Wait State',
    color: '#64748b',
    semanticDescription: 'Step Functions wait state for delays',
    groupId: 'aws',
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
      { id: 'seq-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Next state after wait' },
      { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., WaitForApproval', displayTier: 'pill', displayOrder: 0 },
      { name: 'waitType', label: 'Wait Type', type: 'enum', semanticDescription: 'How to determine wait duration', options: [{ value: 'Seconds' }, { value: 'Timestamp' }, { value: 'SecondsPath' }, { value: 'TimestampPath' }], default: 'Seconds', displayTier: 'minimal', displayOrder: 1 },
      { name: 'duration', label: 'Duration', type: 'string', semanticDescription: 'Wait duration or path', placeholder: 'e.g., 300 or $.waitTime', displayTier: 'minimal', displayOrder: 2 },
    ],
    compilation: { format: 'json' },
  },

  // Step Functions Terminal State (Succeed/Fail)
  {
    type: 'aws-sfn-terminal',
    displayName: 'Terminal State',
    color: '#dc2626',
    semanticDescription: 'Step Functions succeed or fail terminal state',
    groupId: 'aws',
    ports: [
      { id: 'seq-in', portType: 'flow-in', label: 'From', semanticDescription: 'Previous state in sequence' },
      { id: 'child', portType: 'child', label: 'State Machine', semanticDescription: 'State machine containing this state' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'string', semanticDescription: 'State name', placeholder: 'e.g., OrderComplete', displayTier: 'pill', displayOrder: 0 },
      { name: 'terminalType', label: 'Type', type: 'enum', semanticDescription: 'Terminal state type', options: [{ value: 'Succeed' }, { value: 'Fail' }], default: 'Succeed', displayTier: 'minimal', displayOrder: 1 },
      { name: 'error', label: 'Error', type: 'string', semanticDescription: 'Error code (Fail only)', placeholder: 'e.g., OrderFailed', displayTier: 'details', displayOrder: 2 },
      { name: 'cause', label: 'Cause', type: 'string', semanticDescription: 'Error cause (Fail only)', placeholder: 'Describe the failure reason', displayTier: 'details', displayOrder: 3 },
    ],
    compilation: { format: 'json' },
  },
];
