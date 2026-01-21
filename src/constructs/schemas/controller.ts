import type { ConstructSchema } from '../types';

/**
 * REST Controller Schema
 *
 * Represents an API endpoint with route, HTTP method, parameters, and response.
 * Compiles to OpenAPI format.
 */
export const controllerSchema: ConstructSchema = {
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
      placeholder: '/api/users/{id}'
    },
    {
      name: 'verb',
      label: 'Method',
      type: 'enum',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      default: 'GET'
    },
    {
      name: 'summary',
      label: 'Summary',
      type: 'string',
      placeholder: 'Brief description of this endpoint'
    },
    {
      name: 'responseType',
      label: 'Response Type',
      type: 'enum',
      options: ['object', 'array', 'string', 'number', 'boolean', 'void'],
      default: 'object'
    }
  ],
  compilation: {
    format: 'openapi',
    sectionHeader: '# OpenAPI Paths'
  }
};

export default controllerSchema;
