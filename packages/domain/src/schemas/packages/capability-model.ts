import type { SchemaPackageDefinition } from '../../types/index.js';

export const capabilityModelPackage: SchemaPackageDefinition = {
  id: 'std-pkg-capability-model',
  name: 'Capability Model',
  description: 'Domain > Feature > Capability hierarchy with User Stories and Flows',
  color: '#0ea5e9',
  schemas: [
    // Domain
    {
      type: 'cm-domain',
      displayName: 'Domain',
      color: '#0ea5e9',
      semanticDescription: 'A top-level business or product domain grouping related features',

      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Domain name', placeholder: 'e.g., Commerce, Identity, Content', displayTier: 'pill', displayOrder: 0 },
        { name: 'description', label: 'Description', type: 'string', displayHint: 'multiline', semanticDescription: 'What this domain encompasses', placeholder: 'Describe the domain boundary and responsibilities', displayTier: 'summary', displayOrder: 1 },
      ],
      ports: [
        { id: 'parent', portType: 'parent', label: 'Features', semanticDescription: 'Features belonging to this domain' },
        { id: 'flow-in', portType: 'flow-in', label: 'Depends On', semanticDescription: 'Domains this domain depends on' },
        { id: 'flow-out', portType: 'flow-out', label: 'Depended By', semanticDescription: 'Domains that depend on this domain' },
      ],
      compilation: { format: 'json', sectionHeader: '# Domains' },
    },

    // Feature
    {
      type: 'cm-feature',
      displayName: 'Feature',
      color: '#38bdf8',
      semanticDescription: 'A coherent set of capabilities within a domain',

      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Feature name', placeholder: 'e.g., Authentication, Checkout, Search', displayTier: 'pill', displayOrder: 0 },
        { name: 'status', label: 'Status', type: 'enum', semanticDescription: 'Implementation maturity', options: [{ value: 'Planned' }, { value: 'In Progress' }, { value: 'Shipped' }, { value: 'Deprecated' }], default: 'Planned', displayTier: 'summary', displayOrder: 1 },
        { name: 'description', label: 'Description', type: 'string', displayHint: 'multiline', semanticDescription: 'What this feature provides', placeholder: 'Describe the feature scope', displayTier: 'summary', displayOrder: 2 },
      ],
      ports: [
        { id: 'child', portType: 'child', label: 'Domain', semanticDescription: 'Domain this feature belongs to' },
        { id: 'parent', portType: 'parent', label: 'Capabilities', semanticDescription: 'Capabilities this feature provides' },
        { id: 'flow-in', portType: 'flow-in', label: 'Depends On', semanticDescription: 'Features this feature depends on' },
        { id: 'flow-out', portType: 'flow-out', label: 'Depended By', semanticDescription: 'Features that depend on this feature' },
      ],
      compilation: { format: 'json' },
    },

    // Capability
    {
      type: 'cm-capability',
      displayName: 'Capability',
      color: '#7dd3fc',
      semanticDescription: 'An atomic ability the system provides, materialized in user flows',

      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Capability name (verb phrase)', placeholder: 'e.g., Validate Credentials, Process Payment', displayTier: 'pill', displayOrder: 0 },
        { name: 'preconditions', label: 'Preconditions', type: 'string', semanticDescription: 'What must be true before this capability can execute', placeholder: 'e.g., User is authenticated', displayTier: 'summary', displayOrder: 1 },
        { name: 'effects', label: 'Effects', type: 'string', semanticDescription: 'What becomes true after this capability executes', placeholder: 'e.g., Session is created', displayTier: 'summary', displayOrder: 2 },
        { name: 'description', label: 'Description', type: 'string', displayHint: 'multiline', semanticDescription: 'Detailed behavior description', placeholder: 'Describe inputs, outputs, and behavior', displayTier: 'summary', displayOrder: 3 },
      ],
      ports: [
        { id: 'child', portType: 'child', label: 'Feature', semanticDescription: 'Feature this capability belongs to' },
        { id: 'flow-in', portType: 'flow-in', label: 'Flow In', semanticDescription: 'Previous step in a user flow' },
        { id: 'flow-out', portType: 'flow-out', label: 'Flow Out', semanticDescription: 'Next step in a user flow' },
      ],
      compilation: { format: 'json' },
    },

    // User Story
    {
      type: 'cm-user-story',
      displayName: 'User Story',
      color: '#f472b6',
      semanticDescription: 'A user need or goal, implemented by one or more user flows',

      fields: [
        { name: 'title', label: 'Title', type: 'string', semanticDescription: 'Short story title', placeholder: 'e.g., Subscribe to Premium Plan', displayTier: 'pill', displayOrder: 0 },
        { name: 'story', label: 'Story', type: 'string', semanticDescription: 'Full user story', placeholder: 'As a [persona], I want [goal] so that [benefit]', displayTier: 'summary', displayOrder: 1 },
        { name: 'acceptance', label: 'Acceptance Criteria', type: 'string', displayHint: 'multiline', semanticDescription: 'Conditions that must be true for this story to be satisfied', placeholder: 'Given... When... Then...', displayTier: 'summary', displayOrder: 2 },
      ],
      ports: [
        { id: 'flow-out', portType: 'flow-out', label: 'Implemented By', semanticDescription: 'User flows that implement this story' },
      ],
      compilation: { format: 'json', sectionHeader: '# User Stories' },
    },

    // User Flow
    {
      type: 'cm-user-flow',
      displayName: 'User Flow',
      color: '#c084fc',
      semanticDescription: 'A sequence of materialized capabilities that implements a user story',

      fields: [
        { name: 'name', label: 'Name', type: 'string', semanticDescription: 'Flow name', placeholder: 'e.g., Premium Subscription Flow', displayTier: 'pill', displayOrder: 0 },
        { name: 'trigger', label: 'Trigger', type: 'string', semanticDescription: 'What initiates this flow', placeholder: 'e.g., User clicks "Upgrade"', displayTier: 'summary', displayOrder: 1 },
        { name: 'outcome', label: 'Outcome', type: 'string', semanticDescription: 'End state after flow completes', placeholder: 'e.g., User has active premium subscription', displayTier: 'summary', displayOrder: 2 },
        { name: 'description', label: 'Description', type: 'string', displayHint: 'multiline', semanticDescription: 'Flow details and notes', placeholder: 'Describe the flow', displayTier: 'summary', displayOrder: 3 },
      ],
      ports: [
        { id: 'flow-in', portType: 'flow-in', label: 'Story', semanticDescription: 'User story this flow implements' },
        { id: 'parent', portType: 'parent', label: 'Steps', semanticDescription: 'Capabilities materialized in this flow' },
        { id: 'flow-out', portType: 'flow-out', label: 'Next', semanticDescription: 'Follow-on flow or outcome' },
      ],
      compilation: { format: 'json', sectionHeader: '# User Flows' },
    },
  ],
  portSchemas: [],
  schemaGroups: [],
  schemaRelationships: [
    // Domain-Feature relationships
    { id: 'rel-cm-domain-to-feature', sourceSchemaType: 'cm-domain', sourcePortId: 'parent', targetSchemaType: 'cm-feature', targetPortId: 'child', label: 'Add Feature' },
    // Feature-Capability relationships
    { id: 'rel-cm-feature-to-capability', sourceSchemaType: 'cm-feature', sourcePortId: 'parent', targetSchemaType: 'cm-capability', targetPortId: 'child', label: 'Add Capability' },
    // Capability chaining
    { id: 'rel-cm-capability-chain', sourceSchemaType: 'cm-capability', sourcePortId: 'flow-out', targetSchemaType: 'cm-capability', targetPortId: 'flow-in', label: 'Chain Capability' },
    // User Story-Flow relationships
    { id: 'rel-cm-user-story-to-flow', sourceSchemaType: 'cm-user-story', sourcePortId: 'flow-out', targetSchemaType: 'cm-user-flow', targetPortId: 'flow-in', label: 'Add User Flow' },
    // User Flow-Capability relationships
    { id: 'rel-cm-user-flow-to-capability', sourceSchemaType: 'cm-user-flow', sourcePortId: 'parent', targetSchemaType: 'cm-capability', targetPortId: 'child', label: 'Add Step' },
  ],
};
