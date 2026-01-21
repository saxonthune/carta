import type { ConstructSchema } from '../types';

/**
 * API Parameter Schema
 *
 * Represents a parameter for an API endpoint.
 * Connect to a Controller node via parent port.
 */
export const apiParameterSchema: ConstructSchema = {
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
};

export default apiParameterSchema;
