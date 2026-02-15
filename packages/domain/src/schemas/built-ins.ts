import type { ConstructSchema, PortSchema, SchemaGroup, SchemaPackage, SchemaRelationship } from '../types/index.js';
import { loadSeeds, hydrateSeeds, type SchemaSeed } from './seed-loader.js';
import { softwareArchitectureSeed } from './seeds/software-architecture.js';
import { sketchingSeed } from './seeds/sketching.js';
import { bpmnSeed } from './seeds/bpmn.js';
import { awsSeed } from './seeds/aws.js';
import { capabilityModelSeed } from './seeds/capability-model.js';
import {
  flowInPort,
  flowOutPort,
  parentPort,
  childPort,
  symmetricPort,
  interceptPort,
  relayPort,
} from './port-schemas.js';

// Export individual seeds for selective schema addition
export { softwareArchitectureSeed } from './seeds/software-architecture.js';
export { sketchingSeed } from './seeds/sketching.js';
export { bpmnSeed } from './seeds/bpmn.js';
export { awsSeed } from './seeds/aws.js';
export { capabilityModelSeed } from './seeds/capability-model.js';
export type { SchemaSeed } from './seed-loader.js';

/**
 * Built-in Port Schemas
 *
 * Default port type definitions with polarity-based connection semantics.
 * These define the reusable port types and their connection rules.
 *
 * Re-exported from port-schemas.ts to avoid circular dependency with seeds.
 */
export {
  flowInPort,
  flowOutPort,
  parentPort,
  childPort,
  symmetricPort,
  interceptPort,
  relayPort,
} from './port-schemas.js';

export const builtInPortSchemas: PortSchema[] = [
  flowInPort,
  flowOutPort,
  parentPort,
  childPort,
  symmetricPort,
  interceptPort,
  relayPort,
];

/**
 * Load all seed files into groups and construct schemas.
 */
const { packages, groups, schemas, portSchemas: seedPortSchemas, relationships } = loadSeeds([
  softwareArchitectureSeed,
  sketchingSeed,
  bpmnSeed,
  awsSeed,
  capabilityModelSeed,
]);

/**
 * Built-in Schema Packages (template form — seed-local ref IDs).
 * Use hydrateBuiltIns() to get document-ready data with real UUIDs.
 */
export const builtInSchemaPackages: SchemaPackage[] = packages;

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
 * Materialize built-in seeds into document-ready packages, groups, and schemas.
 *
 * When `existingPackages` and `existingGroups` are provided, entities matching by name reuse
 * existing IDs — making "restore defaults" idempotent instead of
 * creating orphan entries.
 */
export function hydrateBuiltIns(existingPackages?: SchemaPackage[], existingGroups?: SchemaGroup[]): { packages: SchemaPackage[]; groups: SchemaGroup[]; schemas: ConstructSchema[]; portSchemas: PortSchema[]; relationships: SchemaRelationship[] } {
  return hydrateSeeds(packages, groups, schemas, seedPortSchemas, relationships, existingPackages, existingGroups);
}

/**
 * Catalog of individual built-in seeds with display metadata.
 */
export const builtInSeedCatalog: Array<{ name: string; seed: SchemaSeed; description: string }> = [
  { name: 'Software Design', seed: softwareArchitectureSeed, description: 'REST APIs, databases, UI screens, user stories' },
  { name: 'Sketching', seed: sketchingSeed, description: 'Freeform notes and boxes' },
  { name: 'BPMN', seed: bpmnSeed, description: 'Business process modeling' },
  { name: 'AWS', seed: awsSeed, description: 'AWS cloud services' },
  { name: 'Capability Model', seed: capabilityModelSeed, description: 'Domain capabilities and features' },
];

/**
 * Hydrate a single seed into document-ready data.
 *
 * When `existingPackages` and `existingGroups` are provided, entities matching by name reuse
 * existing IDs — making re-adding seeds idempotent instead of creating duplicates.
 */
export function hydrateSeed(seed: SchemaSeed, existingPackages?: SchemaPackage[], existingGroups?: SchemaGroup[]): { packages: SchemaPackage[]; groups: SchemaGroup[]; schemas: ConstructSchema[]; portSchemas: PortSchema[]; relationships: SchemaRelationship[] } {
  const { packages: seedPkgs, groups: seedGrps, schemas: seedSchemas, portSchemas, relationships: seedRelationships } = loadSeeds([seed]);
  return hydrateSeeds(seedPkgs, seedGrps, seedSchemas, portSchemas, seedRelationships, existingPackages, existingGroups);
}
