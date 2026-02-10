import type { SchemaSeed } from '../seed-loader.js';

export const sketchingSeed: SchemaSeed = {
  group: {
    id: 'sketching',
    name: 'Sketching',
    color: '#64748b',
    description: 'Quick, low-friction constructs for rough modeling',
  },
  schemas: [
    // Note
    {
      type: 'note',
      displayName: 'Note',
      color: '#c4a94e',
      semanticDescription: 'A freeform note or annotation',
      nodeShape: 'simple',
      backgroundColorPolicy: 'tints',
      groupId: 'sketching',
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
      compilation: { format: 'json', sectionHeader: '# Notes' },
    },

    // Box
    {
      type: 'box',
      displayName: 'Box',
      color: '#64748b',
      nodeShape: 'simple',
      backgroundColorPolicy: 'tints',
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
  ],
};
