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
  category: 'api',
  color: '#6366f1',
  fields: [
    {
      name: 'route',
      label: 'Route',
      type: 'text',
      default: '/api/',
      placeholder: '/api/users/{id}'
    },
    {
      name: 'verb',
      label: 'Method',
      type: 'dropdown',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      default: 'GET'
    },
    {
      name: 'summary',
      label: 'Summary',
      type: 'text',
      placeholder: 'Brief description of this endpoint'
    },
    {
      name: 'params',
      label: 'Parameters',
      type: 'table',
      columns: [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'in', label: 'Location', type: 'dropdown', options: ['path', 'query', 'header', 'body'] },
        { name: 'type', label: 'Type', type: 'dropdown', options: ['string', 'number', 'integer', 'boolean', 'array', 'object'] },
        { name: 'required', label: 'Required', type: 'boolean' }
      ],
      default: []
    },
    {
      name: 'responseType',
      label: 'Response Type',
      type: 'dropdown',
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
