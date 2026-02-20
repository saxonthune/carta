import type { SchemaPackageDefinition } from '../../types/index.js';

export const sketchingPackage: SchemaPackageDefinition = {
  id: 'std-pkg-sketching',
  name: 'Sketching',
  description: 'Quick, low-friction constructs for rough modeling',
  color: '#64748b',
  schemas: [
    // Note
    {
      type: 'note',
      displayName: 'Note',
      color: '#c4a94e',
      semanticDescription: 'A freeform note or annotation',
      nodeShape: 'simple',
      instanceColors: true,
      isFavorite: true,
      fields: [
        {
          name: 'title',
          label: 'Title',
          type: 'string',
          semanticDescription: 'Note title or heading',
          placeholder: 'Title...',
          displayTier: 'pill',
          displayOrder: 0,
        },
        {
          name: 'body',
          label: 'Body',
          type: 'string',
          displayHint: 'markdown',
          semanticDescription: 'Note body content',
          placeholder: 'Write something...',
          displayTier: 'summary',
          displayOrder: 1,
        },
      ],
      ports: [
        { id: 'in', portType: 'flow-in', label: 'In' },
        { id: 'out', portType: 'flow-out', label: 'Out' },
        { id: 'link', portType: 'symmetric', label: 'Link' },
      ],
      compilation: { format: 'json', sectionHeader: '# Notes' },
    },
  ],
  portSchemas: [],
  schemaGroups: [],
  schemaRelationships: [],
};
