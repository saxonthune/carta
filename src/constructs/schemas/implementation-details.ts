import type { ConstructSchema } from '../types';

/**
 * Implementation Details Schema
 *
 * A simple construct for capturing implementation notes, documentation,
 * or any text-based details. Useful for annotating your architecture.
 */
export const implementationDetailsSchema: ConstructSchema = {
  type: 'implementation-details',
  displayName: 'Implementation Details',
  color: '#6b7280', // Gray
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
};

export default implementationDetailsSchema;
