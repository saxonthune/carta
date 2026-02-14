export interface GuideSection {
  title: string;
  body: string;
}

export interface ShortcutEntry {
  keys: string;   // e.g. "Ctrl+Z"
  action: string; // e.g. "Undo"
}

export interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

export const readFirstSections: GuideSection[] = [
  {
    title: 'What is Carta?',
    body: 'Carta is a visual software architecture editor. You create typed nodes (called constructs), connect them with typed relationships, and compile the result into AI-readable output. Think of it as a whiteboard that understands your vocabulary.',
  },
  {
    title: 'Start with rough notes',
    body: 'Right-click the canvas and create Notes or Boxes. Label them with whatever comes to mind. Draw connections by dragging between nodes. Don\'t worry about types yet — just sketch your ideas.',
  },
  {
    title: 'Ask questions about your model',
    body: 'Look at your sketch. What types of things are there? What relationships exist between them? Are some things containers for others? These questions will guide the next step.',
  },
  {
    title: 'Define your vocabulary',
    body: 'Open the Metamap using the view switcher. Create schemas for the types you identified. Add fields for important attributes. Create ports to define how types relate to each other.',
  },
  {
    title: 'Upgrade your sketch',
    body: 'Back on the Map, right-click a Note and change its type to one of your new schemas. Fill in field values. Draw typed connections using your ports.',
  },
  {
    title: 'Organize with pages',
    body: 'If your model has separate concerns, create pages. Schemas are shared across all pages; construct instances are per-page.',
  },
  {
    title: 'Compile and iterate',
    body: 'Hit Compile. Is the output useful for your AI workflow? If not, your schemas might need more fields or your connections might need more specific port types. Iterate until the output captures what matters.',
  },
  {
    title: 'Hand off to AI',
    body: 'Copy the compiled output into your AI coding assistant, or use Carta\'s built-in AI sidebar if available. The structured output gives AI the context it needs to understand your architecture.',
  },
];

export const conceptSections: GuideSection[] = [
  {
    title: 'The Map',
    body: 'The primary canvas workspace. Pan by dragging, zoom with scroll wheel, and create constructs from the right-click context menu. Everything you build lives here.',
  },
  {
    title: 'Constructs',
    body: 'Typed nodes on the canvas. Each construct is an instance of a schema, with fields for data and ports for connections. They\'re the building blocks of your model.',
  },
  {
    title: 'Schemas',
    body: 'Type definitions for constructs. A schema defines what fields a construct has, what ports it exposes, and how it displays on the canvas. Design schemas in the Metamap.',
  },
  {
    title: 'Fields',
    body: 'Data slots on constructs. Five types: string, number, boolean, date, and enum. Display tiers control which fields are visible at different zoom levels.',
  },
  {
    title: 'Ports & Connections',
    body: 'Ports are attachment points on constructs. They have polarity (in, out, both, neutral, passive) which controls what can connect to what. Drag from a port circle to create a connection.',
  },
  {
    title: 'The Metamap',
    body: 'A schema-level view for designing your type vocabulary. Create and edit schemas, define relationships between types, and organize your metamodel visually.',
  },
  {
    title: 'Pages',
    body: 'Separate views within a document, each with its own canvas and layout. Schemas are shared across all pages, but construct instances belong to a specific page.',
  },
  {
    title: 'Organizers',
    body: 'Visual grouping containers on the canvas. They help organize constructs spatially but are cosmetic only — they don\'t affect connections or compilation output.',
  },
  {
    title: 'Compilation',
    body: 'Transforms your visual model into structured, AI-readable output. The compiler walks your constructs, connections, and field values to produce a text representation.',
  },
];

export const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Keyboard',
    entries: [
      { keys: 'Ctrl+Z', action: 'Undo' },
      { keys: 'Ctrl+Y / Ctrl+Shift+Z', action: 'Redo' },
      { keys: 'Ctrl+C', action: 'Copy' },
      { keys: 'Ctrl+V', action: 'Paste' },
      { keys: 'Delete / Backspace', action: 'Remove selected' },
      { keys: 'F2', action: 'Rename selected' },
      { keys: 'Ctrl+G', action: 'Group selected' },
      { keys: 'V', action: 'Toggle selection mode' },
    ],
  },
  {
    title: 'Mouse',
    entries: [
      { keys: 'Left-drag', action: 'Pan canvas' },
      { keys: 'Scroll wheel', action: 'Zoom' },
      { keys: 'Click', action: 'Select' },
      { keys: 'Shift+Click', action: 'Multi-select' },
      { keys: 'Double-click', action: 'Expand/collapse' },
      { keys: 'Right-click', action: 'Context menu' },
      { keys: 'Drag from port', action: 'Create connection' },
    ],
  },
  {
    title: 'Metamap',
    entries: [
      { keys: 'Double-click schema', action: 'Expand/collapse' },
      { keys: 'Drag schema onto group', action: 'Reparent' },
      { keys: 'Drag between schemas', action: 'Create relationship' },
    ],
  },
];
