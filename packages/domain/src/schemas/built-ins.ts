import type { ConstructSchema, PortSchema, SchemaGroup } from '../types/index.js';
import { loadSeeds, hydrateSeeds } from './seed-loader.js';
import { softwareArchitectureSeed } from './seeds/software-architecture.js';
import { sketchingSeed } from './seeds/sketching.js';
import { bpmnSeed } from './seeds/bpmn.js';
import { awsSeed } from './seeds/aws.js';
import { capabilityModelSeed } from './seeds/capability-model.js';

/**
 * Built-in Port Schemas
 *
 * Default port type definitions with polarity-based connection semantics.
 * These define the reusable port types and their connection rules.
 */
export const builtInPortSchemas: PortSchema[] = [
  {
    id: 'flow-in',
    displayName: 'Flow In',
    semanticDescription: 'Receives data or control flow',
    polarity: 'sink',
    compatibleWith: ['flow-out'],
    expectedComplement: 'flow-out',
    color: '#3b82f6',
  },
  {
    id: 'flow-out',
    displayName: 'Flow Out',
    semanticDescription: 'Sends data or control flow',
    polarity: 'source',
    compatibleWith: ['flow-in'],
    expectedComplement: 'flow-in',
    color: '#22c55e',
  },
  {
    id: 'parent',
    displayName: 'Parent',
    semanticDescription: 'Contains or owns the connected construct',
    polarity: 'source',
    compatibleWith: ['child'],
    expectedComplement: 'child',
    color: '#8b5cf6',
  },
  {
    id: 'child',
    displayName: 'Child',
    semanticDescription: 'Is contained by or owned by the connected construct',
    polarity: 'sink',
    compatibleWith: ['parent'],
    expectedComplement: 'parent',
    color: '#8b5cf6',
  },
  {
    id: 'symmetric',
    displayName: 'Link',
    semanticDescription: 'Bidirectional peer connection',
    polarity: 'bidirectional',
    compatibleWith: [],
    color: '#64748b',
  },
  {
    id: 'intercept',
    displayName: 'Intercept',
    semanticDescription: 'Pass-through input accepting any source connection (bypasses type checking)',
    polarity: 'intercept',
    compatibleWith: [],
    color: '#f59e0b',
  },
  {
    id: 'relay',
    displayName: 'Relay',
    semanticDescription: 'Pass-through output connecting to any sink port (bypasses type checking)',
    polarity: 'relay',
    compatibleWith: [],
    color: '#f59e0b',
  },
];

/**
 * Load all seed files into groups and construct schemas.
 */
const { groups, schemas } = loadSeeds([
  softwareArchitectureSeed,
  sketchingSeed,
  bpmnSeed,
  awsSeed,
  capabilityModelSeed,
]);

/**
 * Built-in Schema Groups (template form — seed-local ref IDs).
 * Use hydrateBuiltIns() to get document-ready data with real UUIDs.
 */
export const builtInSchemaGroups: SchemaGroup[] = groups;

/**
 * Built-in Construct Schemas (template form — groupId uses seed-local refs).
 * Use hydrateBuiltIns() to get document-ready data with real UUIDs.
 */
export const builtInConstructSchemas: ConstructSchema[] = schemas;

/**
 * Materialize built-in seeds into document-ready groups and schemas.
 *
 * Each call generates fresh UUIDs for all schema groups and resolves
 * all groupId/parentId references. Safe to call multiple times —
 * no ID collisions across hydrations.
 */
export function hydrateBuiltIns(): { groups: SchemaGroup[]; schemas: ConstructSchema[] } {
  return hydrateSeeds(groups, schemas);
}
