import type { SchemaSeed } from '../seed-loader.js';

export const softwareArchitectureSeed: SchemaSeed = {
  group: {
    id: 'software-design',
    name: 'Software Design',
    color: '#7c7fca',
    description: 'Core software design constructs',
  },
  subgroups: [
    {
      id: 'api',
      name: 'API',
      color: '#7c7fca',
      description: 'API endpoint and model constructs',
    },
    {
      id: 'database',
      name: 'Database',
      color: '#c49a4c',
      description: 'Database schema and table constructs',
    },
    {
      id: 'ui',
      name: 'UI',
      color: '#6a8fc0',
      description: 'User interface constructs',
    },
    {
      id: 'user-story',
      name: 'User Story',
      color: '#5ba88e',
      description: 'User stories and requirements',
    },
  ],
  schemas: [
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
        { constructType: 'database', fromPortId: 'flow-out', toPortId: 'link-in', label: 'Connect to Database' },
        { constructType: 'auth-policy', fromPortId: 'policy-in', toPortId: 'flow-out', label: 'Add Auth Policy' },
        { constructType: 'rate-limit', fromPortId: 'policy-in', toPortId: 'flow-out', label: 'Add Rate Limit' },
      ],
      compilation: { format: 'json', sectionHeader: '# REST Endpoints' },
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
        { constructType: 'rest-endpoint', fromPortId: 'flow-out', toPortId: 'policy-in', label: 'Apply to Endpoint' },
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
        { constructType: 'rest-endpoint', fromPortId: 'flow-out', toPortId: 'policy-in', label: 'Apply to Endpoint' },
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
        { constructType: 'rest-endpoint', fromPortId: 'flow-out', toPortId: 'policy-in', label: 'Apply to Endpoint' },
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
        { constructType: 'rest-endpoint', fromPortId: 'link-in', toPortId: 'flow-out', label: 'Add REST Endpoint' },
        { constructType: 'table', fromPortId: 'child', toPortId: 'parent', label: 'Add Table' },
      ],
      compilation: { format: 'json', sectionHeader: '# Database Schema' },
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
        { constructType: 'database', fromPortId: 'parent', toPortId: 'child', label: 'Add to Database' },
        { constructType: 'db-attribute', fromPortId: 'child', toPortId: 'parent', label: 'Add Attribute' },
        { constructType: 'constraint', fromPortId: 'child', toPortId: 'parent', label: 'Add Constraint' },
      ],
      compilation: { format: 'json' },
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
        { constructType: 'table', fromPortId: 'parent', toPortId: 'child', label: 'Add to Table' },
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
        { constructType: 'table', fromPortId: 'parent', toPortId: 'child', label: 'Add to Table' },
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
        { constructType: 'rest-endpoint', fromPortId: 'child', toPortId: 'parent', label: 'Add to Endpoint' },
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
        { constructType: 'ui-screen', fromPortId: 'child', toPortId: 'parent', label: 'Add to UI Screen' },
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
        { constructType: 'user-story', fromPortId: 'flow-in', toPortId: 'flow-out', label: 'Connect from User Story' },
        { constructType: 'ui-event', fromPortId: 'parent', toPortId: 'child', label: 'Add Event' },
      ],
      compilation: { format: 'json' },
    },

    // User Story
    {
      type: 'user-story',
      displayName: 'User Story',
      color: '#5ba88e',
      semanticDescription: 'A user story or requirement',
      groupId: 'user-story',
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
        { constructType: 'ui-screen', fromPortId: 'flow-out', toPortId: 'flow-in', label: 'Connect to UI Screen' },
      ],
      compilation: { format: 'json' },
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
      compilation: { format: 'json', sectionHeader: '# Implementation Details' },
    },
  ],
};
