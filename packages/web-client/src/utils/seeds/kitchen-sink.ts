import type { DocumentAdapter, OrganizerNodeData, ConstructSchema, PortSchema } from '@carta/domain';
import { generateSemanticId } from '@carta/domain';
import { generateDeployableColor } from '@carta/document';

/**
 * Kitchen-sink seed exercising every core feature:
 * - Custom schemas with custom ports
 * - All 5 port polarities (source, sink, bidirectional, relay, intercept)
 * - Organizer with children
 * - Deployable assignment
 * - Multiple connection types on same node
 *
 * If this seed compiles and renders, the core features work.
 */
export function kitchenSink(adapter: DocumentAdapter): void {
  // --- Custom port schemas ---
  const customPorts: PortSchema[] = [
    {
      id: 'data-source',
      displayName: 'Data Source',
      semanticDescription: 'Emits data records',
      polarity: 'source',
      compatibleWith: ['data-sink'],
      expectedComplement: 'data-sink',
      color: '#e11d48',
    },
    {
      id: 'data-sink',
      displayName: 'Data Sink',
      semanticDescription: 'Consumes data records',
      polarity: 'sink',
      compatibleWith: ['data-source'],
      expectedComplement: 'data-source',
      color: '#0891b2',
    },
  ];

  for (const port of customPorts) {
    adapter.addPortSchema(port);
  }

  // --- Custom construct schemas ---
  const pipelineSchema: ConstructSchema = {
    type: 'ks-pipeline',
    displayName: 'Pipeline',
    color: '#7c3aed',
    semanticDescription: 'Data processing pipeline (kitchen-sink demo)',
    fields: [
      { name: 'name', label: 'Name', type: 'string', displayTier: 'pill', displayOrder: 0, placeholder: 'Pipeline name' },
      { name: 'throughput', label: 'Throughput', type: 'number', displayTier: 'minimal', displayOrder: 1, default: 1000 },
      { name: 'notes', label: 'Notes', type: 'string', displayHint: 'multiline', displayTier: 'details', displayOrder: 2 },
    ],
    ports: [
      { id: 'data-in', portType: 'data-sink', label: 'Data In', semanticDescription: 'Incoming data stream' },
      { id: 'data-out', portType: 'data-source', label: 'Data Out', semanticDescription: 'Processed data output' },
      { id: 'relay-out', portType: 'relay', label: 'Relay', semanticDescription: 'Pass-through relay port' },
      { id: 'intercept-in', portType: 'intercept', label: 'Intercept', semanticDescription: 'Pass-through intercept port' },
      { id: 'peer', portType: 'symmetric', label: 'Peer', semanticDescription: 'Bidirectional peer link' },
      { id: 'parent', portType: 'parent', label: 'Stages', semanticDescription: 'Pipeline stages' },
    ],
    compilation: { format: 'json', sectionHeader: '# Pipelines' },
  };

  const stageSchema: ConstructSchema = {
    type: 'ks-stage',
    displayName: 'Stage',
    color: '#db2777',
    semanticDescription: 'A processing stage within a pipeline (kitchen-sink demo)',
    fields: [
      { name: 'name', label: 'Name', type: 'string', displayTier: 'pill', displayOrder: 0, placeholder: 'Stage name' },
      { name: 'transform', label: 'Transform', type: 'enum', options: [{ value: 'filter' }, { value: 'map' }, { value: 'reduce' }, { value: 'aggregate' }], default: 'map', displayTier: 'minimal', displayOrder: 1 },
    ],
    ports: [
      { id: 'child', portType: 'child', label: 'Pipeline', semanticDescription: 'Parent pipeline' },
      { id: 'flow-in', portType: 'flow-in', label: 'In', semanticDescription: 'Stage input' },
      { id: 'flow-out', portType: 'flow-out', label: 'Out', semanticDescription: 'Stage output' },
    ],
    compilation: { format: 'json' },
  };

  adapter.addSchema(pipelineSchema);
  adapter.addSchema(stageSchema);

  // --- Node IDs ---
  const pipeline1 = crypto.randomUUID();
  const pipeline2 = crypto.randomUUID();
  const stageFilter = crypto.randomUUID();
  const stageMap = crypto.randomUUID();
  const stageReduce = crypto.randomUUID();
  const noteA = crypto.randomUUID();
  const noteB = crypto.randomUUID();
  const endpoint = crypto.randomUUID();
  const dbNode = crypto.randomUUID();
  const tableNode = crypto.randomUUID();

  // --- Organizer ---
  const organizerId = crypto.randomUUID();
  const orgColor = generateDeployableColor();

  // --- Deployable ---
  const dep = adapter.addDeployable({ name: 'Data Platform', description: 'All pipeline infrastructure', color: '#7c3aed' });

  const PADDING = 20;
  const HEADER_HEIGHT = 40;

  adapter.setTitle('Kitchen Sink');
  adapter.setDescription('Exercises every core feature: custom schemas, all port polarities, organizers, deployables');

  adapter.setNodes([
    // Organizer containing pipeline stages
    {
      id: organizerId,
      type: 'organizer',
      position: { x: 50, y: 50 },
      style: { width: 540, height: 320 },
      data: {
        isOrganizer: true,
        name: 'ETL Pipeline',
        color: orgColor,
        collapsed: false,
        layout: 'freeform',
      } satisfies OrganizerNodeData,
    },

    // Pipeline 1 (inside organizer)
    {
      id: pipeline1,
      type: 'construct',
      parentId: organizerId,
      position: { x: PADDING, y: HEADER_HEIGHT + 10 },
      data: {
        constructType: 'ks-pipeline',
        semanticId: generateSemanticId('ks-pipeline'),
        values: { name: 'Ingest Pipeline', throughput: 5000 },
        viewLevel: 'summary',
        deployableId: dep.id,
      },
    },

    // Stages (inside organizer)
    {
      id: stageFilter,
      type: 'construct',
      parentId: organizerId,
      position: { x: PADDING, y: HEADER_HEIGHT + 170 },
      data: {
        constructType: 'ks-stage',
        semanticId: generateSemanticId('ks-stage'),
        values: { name: 'Filter Invalid', transform: 'filter' },
        viewLevel: 'summary',
        deployableId: dep.id,
      },
    },
    {
      id: stageMap,
      type: 'construct',
      parentId: organizerId,
      position: { x: 200, y: HEADER_HEIGHT + 170 },
      data: {
        constructType: 'ks-stage',
        semanticId: generateSemanticId('ks-stage'),
        values: { name: 'Normalize', transform: 'map' },
        viewLevel: 'summary',
        deployableId: dep.id,
      },
    },
    {
      id: stageReduce,
      type: 'construct',
      parentId: organizerId,
      position: { x: 370, y: HEADER_HEIGHT + 170 },
      data: {
        constructType: 'ks-stage',
        semanticId: generateSemanticId('ks-stage'),
        values: { name: 'Aggregate', transform: 'reduce' },
        viewLevel: 'summary',
        deployableId: dep.id,
      },
    },

    // Pipeline 2 (standalone, exercises relay/intercept)
    {
      id: pipeline2,
      type: 'construct',
      position: { x: 650, y: 100 },
      data: {
        constructType: 'ks-pipeline',
        semanticId: generateSemanticId('ks-pipeline'),
        values: { name: 'Export Pipeline', throughput: 2000, notes: 'Forwards processed data to API' },
        viewLevel: 'summary',
        deployableId: dep.id,
      },
    },

    // Built-in schema nodes to verify cross-schema connections
    {
      id: endpoint,
      type: 'construct',
      position: { x: 650, y: 350 },
      data: {
        constructType: 'rest-endpoint',
        semanticId: generateSemanticId('rest-endpoint'),
        values: { route: '/api/ingest', verb: 'POST', summary: 'Receive raw data' },
        viewLevel: 'summary',
      },
    },
    {
      id: dbNode,
      type: 'construct',
      position: { x: 100, y: 450 },
      data: {
        constructType: 'database',
        semanticId: generateSemanticId('database'),
        values: { engine: 'PostgreSQL', note: 'Analytics warehouse' },
        viewLevel: 'summary',
      },
    },
    {
      id: tableNode,
      type: 'construct',
      position: { x: 100, y: 620 },
      data: {
        constructType: 'table',
        semanticId: generateSemanticId('table'),
        values: { tableName: 'events', columns: 'id UUID PK, type VARCHAR, payload JSON, ts TIMESTAMP' },
        viewLevel: 'summary',
      },
    },

    // Notes (bidirectional link)
    {
      id: noteA,
      type: 'construct',
      position: { x: 400, y: 450 },
      data: {
        constructType: 'note',
        semanticId: generateSemanticId('note'),
        values: { content: 'TODO: Add retry logic for failed ingests' },
        viewLevel: 'summary',
      },
    },
    {
      id: noteB,
      type: 'construct',
      position: { x: 400, y: 620 },
      data: {
        constructType: 'note',
        semanticId: generateSemanticId('note'),
        values: { content: 'Consider adding CDC from the events table' },
        viewLevel: 'summary',
      },
    },
  ]);

  adapter.setEdges([
    // Pipeline 1 -> stages (parent -> child)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: pipeline1,
      target: stageFilter,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: pipeline1,
      target: stageMap,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: pipeline1,
      target: stageReduce,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    // Stage flow: filter -> map -> reduce (flow-out -> flow-in)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: stageFilter,
      target: stageMap,
      sourceHandle: 'flow-out',
      targetHandle: 'flow-in',
    },
    {
      id: `edge-${crypto.randomUUID()}`,
      source: stageMap,
      target: stageReduce,
      sourceHandle: 'flow-out',
      targetHandle: 'flow-in',
    },
    // Custom port: pipeline1 data-out -> pipeline2 data-in (source -> sink)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: pipeline1,
      target: pipeline2,
      sourceHandle: 'data-out',
      targetHandle: 'data-in',
    },
    // Bidirectional: pipelines peer link
    {
      id: `edge-${crypto.randomUUID()}`,
      source: pipeline1,
      target: pipeline2,
      sourceHandle: 'peer',
      targetHandle: 'peer',
    },
    // Relay: pipeline2 relay-out -> endpoint flow-in
    {
      id: `edge-${crypto.randomUUID()}`,
      source: pipeline2,
      target: endpoint,
      sourceHandle: 'relay-out',
      targetHandle: 'flow-in',
    },
    // Intercept: endpoint flow-out -> pipeline1 intercept-in
    {
      id: `edge-${crypto.randomUUID()}`,
      source: endpoint,
      target: pipeline1,
      sourceHandle: 'flow-out',
      targetHandle: 'intercept-in',
    },
    // Database -> Table (child -> parent on table, child port on database)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: tableNode,
      target: dbNode,
      sourceHandle: 'parent',
      targetHandle: 'child',
    },
    // Notes linked bidirectionally
    {
      id: `edge-${crypto.randomUUID()}`,
      source: noteA,
      target: noteB,
      sourceHandle: 'link',
      targetHandle: 'link',
    },
    // Endpoint -> database (flow-out -> link-in)
    {
      id: `edge-${crypto.randomUUID()}`,
      source: endpoint,
      target: dbNode,
      sourceHandle: 'flow-out',
      targetHandle: 'link-in',
    },
  ]);
}
