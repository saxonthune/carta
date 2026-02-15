import type { SchemaSeed } from '../seed-loader.js';
import { flowInPort, flowOutPort, childPort, parentPort, symmetricPort, relayPort, interceptPort } from '../port-schemas.js';

export const bpmnSeed: SchemaSeed = {
  package: {
    id: 'bpmn',
    name: 'BPMN',
    color: '#3b82f6',
    description: 'Simplified Business Process Model and Notation',
  },
  portSchemas: [flowInPort, flowOutPort, childPort, parentPort, symmetricPort, relayPort, interceptPort],
  schemas: [
    // BPMN Activity (Task / Subprocess)
    {
      type: 'bpmn-activity',
      displayName: 'Activity',
      color: '#3b82f6',
      semanticDescription: 'A task or subprocess in a business process',
      groupId: 'bpmn',
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Activity name', placeholder: 'e.g., Review Application', displayTier: 'pill', displayOrder: 0 },
        { name: 'activityType', label: 'Type', type: 'enum', semanticDescription: 'Kind of activity', options: [{ value: 'Task' }, { value: 'Subprocess' }, { value: 'Call Activity' }], default: 'Task', displayTier: 'summary', displayOrder: 1 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'What this activity does', placeholder: 'Describe the activity', displayTier: 'summary', displayOrder: 2 },
      ],
      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'Sequence In', semanticDescription: 'Incoming sequence flow' },
        { id: 'seq-out', portType: 'flow-out', label: 'Sequence Out', semanticDescription: 'Outgoing sequence flow' },
        { id: 'child', portType: 'child', label: 'Lane', semanticDescription: 'Lane or pool containing this activity' },
        { id: 'parent', portType: 'parent', label: 'Sub-activities', semanticDescription: 'Child activities within this subprocess' },
        { id: 'data-link', portType: 'symmetric', label: 'Data', semanticDescription: 'Associated data objects' },
      ],
      compilation: { format: 'json' },
    },

    // BPMN Event (Start / Intermediate / End)
    {
      type: 'bpmn-event',
      displayName: 'Event',
      color: '#22c55e',
      nodeShape: 'circle',
      semanticDescription: 'A start, intermediate, or end event in a business process',
      groupId: 'bpmn',
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Event label', placeholder: 'e.g., Order Received', displayTier: 'pill', displayOrder: 0 },
        { name: 'eventPosition', label: 'Position', type: 'enum', semanticDescription: 'Where this event occurs in the process', options: [{ value: 'Start' }, { value: 'Intermediate' }, { value: 'End' }], default: 'Start', displayTier: 'summary', displayOrder: 1 },
        { name: 'trigger', label: 'Trigger', type: 'enum', semanticDescription: 'What causes this event', options: [{ value: 'None' }, { value: 'Message' }, { value: 'Timer' }, { value: 'Error' }, { value: 'Signal' }], default: 'None', displayTier: 'summary', displayOrder: 2 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Event details', placeholder: 'Describe the event', displayTier: 'summary', displayOrder: 3 },
      ],
      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'Sequence In', semanticDescription: 'Incoming sequence flow (intermediate/end)' },
        { id: 'seq-out', portType: 'flow-out', label: 'Sequence Out', semanticDescription: 'Outgoing sequence flow (start/intermediate)' },
        { id: 'child', portType: 'child', label: 'Lane', semanticDescription: 'Lane or pool containing this event' },
      ],
      compilation: { format: 'json' },
    },

    // BPMN Gateway (Exclusive / Parallel / Inclusive)
    {
      type: 'bpmn-gateway',
      displayName: 'Gateway',
      color: '#f59e0b',
      nodeShape: 'diamond',
      semanticDescription: 'A decision or merge point in a business process',
      groupId: 'bpmn',
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Gateway label', placeholder: 'e.g., Approved?', displayTier: 'pill', displayOrder: 0 },
        { name: 'gatewayType', label: 'Type', type: 'enum', semanticDescription: 'Gateway behavior', options: [{ value: 'Exclusive (XOR)' }, { value: 'Parallel (AND)' }, { value: 'Inclusive (OR)' }, { value: 'Event-Based' }], default: 'Exclusive (XOR)', displayTier: 'summary', displayOrder: 1 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Decision logic or merge conditions', placeholder: 'Describe the branching logic', displayTier: 'summary', displayOrder: 2 },
      ],
      ports: [
        { id: 'seq-in', portType: 'flow-in', label: 'Sequence In', semanticDescription: 'Incoming sequence flows to merge' },
        { id: 'seq-out', portType: 'flow-out', label: 'Sequence Out', semanticDescription: 'Outgoing sequence flows to branch' },
        { id: 'child', portType: 'child', label: 'Lane', semanticDescription: 'Lane or pool containing this gateway' },
      ],
      compilation: { format: 'json' },
    },

    // BPMN Pool (Participant)
    {
      type: 'bpmn-pool',
      displayName: 'Pool',
      color: '#6366f1',
      semanticDescription: 'A participant or organization in a business process',
      groupId: 'bpmn',
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Participant name', placeholder: 'e.g., Customer, Fulfillment', displayTier: 'pill', displayOrder: 0 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Role or responsibility of this participant', placeholder: 'Describe the participant', displayTier: 'summary', displayOrder: 1 },
      ],
      ports: [
        { id: 'parent', portType: 'parent', label: 'Lanes', semanticDescription: 'Lanes within this pool' },
        { id: 'msg-out', portType: 'relay', label: 'Message Out', semanticDescription: 'Sends messages to other pools' },
        { id: 'msg-in', portType: 'intercept', label: 'Message In', semanticDescription: 'Receives messages from other pools' },
      ],
      compilation: { format: 'json', sectionHeader: '# Business Process' },
    },

    // BPMN Lane (Role subdivision within a Pool)
    {
      type: 'bpmn-lane',
      displayName: 'Lane',
      color: '#818cf8',
      semanticDescription: 'A role or department subdivision within a pool',
      groupId: 'bpmn',
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Lane role name', placeholder: 'e.g., Sales, Accounting', displayTier: 'pill', displayOrder: 0 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Responsibility of this lane', placeholder: 'Describe the role', displayTier: 'summary', displayOrder: 1 },
      ],
      ports: [
        { id: 'child', portType: 'child', label: 'Pool', semanticDescription: 'Pool that contains this lane' },
        { id: 'parent', portType: 'parent', label: 'Elements', semanticDescription: 'Activities, events, and gateways in this lane' },
      ],
      compilation: { format: 'json' },
    },

    // BPMN Data Object (reified)
    {
      type: 'bpmn-data-object',
      displayName: 'Data Object',
      color: '#8b5cf6',
      nodeShape: 'document',
      semanticDescription: 'An information artifact used or produced by activities',
      groupId: 'bpmn',
      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Data object name', placeholder: 'e.g., Invoice, Purchase Order', displayTier: 'pill', displayOrder: 0 },
        { name: 'state', label: 'State', type: 'string', semanticDescription: 'Current state of the data', placeholder: 'e.g., Draft, Approved', displayTier: 'summary', displayOrder: 1 },
        { name: 'description', label: 'Description', type: 'string', semanticDescription: 'Data content and structure', placeholder: 'Describe the data', displayTier: 'summary', displayOrder: 2 },
      ],
      ports: [
        { id: 'data-link', portType: 'symmetric', label: 'Used By', semanticDescription: 'Activities that use or produce this data' },
      ],
      compilation: { format: 'json' },
    },
  ],
  relationships: [
    // Activity relationships
    { sourceSchemaType: 'bpmn-activity', sourcePortId: 'seq-out', targetSchemaType: 'bpmn-gateway', targetPortId: 'seq-in', label: 'Add Gateway' },
    { sourceSchemaType: 'bpmn-activity', sourcePortId: 'seq-out', targetSchemaType: 'bpmn-event', targetPortId: 'seq-in', label: 'Add Event' },
    { sourceSchemaType: 'bpmn-activity', sourcePortId: 'data-link', targetSchemaType: 'bpmn-data-object', targetPortId: 'data-link', label: 'Add Data Object' },
    // Event relationships
    { sourceSchemaType: 'bpmn-event', sourcePortId: 'seq-out', targetSchemaType: 'bpmn-activity', targetPortId: 'seq-in', label: 'Add Activity' },
    // Gateway relationships
    { sourceSchemaType: 'bpmn-gateway', sourcePortId: 'seq-out', targetSchemaType: 'bpmn-activity', targetPortId: 'seq-in', label: 'Add Activity' },
    { sourceSchemaType: 'bpmn-gateway', sourcePortId: 'seq-out', targetSchemaType: 'bpmn-event', targetPortId: 'seq-in', label: 'Add End Event' },
    // Pool-Lane relationships
    { sourceSchemaType: 'bpmn-pool', sourcePortId: 'parent', targetSchemaType: 'bpmn-lane', targetPortId: 'child', label: 'Add Lane' },
    // Lane relationships
    { sourceSchemaType: 'bpmn-lane', sourcePortId: 'parent', targetSchemaType: 'bpmn-activity', targetPortId: 'child', label: 'Add Activity' },
    { sourceSchemaType: 'bpmn-lane', sourcePortId: 'parent', targetSchemaType: 'bpmn-event', targetPortId: 'child', label: 'Add Event' },
  ],
};
