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
  category: 'documentation',
  color: '#6b7280', // Gray
  fields: [
    {
      name: 'details',
      label: 'Details',
      type: 'code',
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
