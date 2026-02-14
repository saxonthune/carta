/**
 * Built-in schemas - default construct types, port types, and schema groups
 */

export {
  builtInConstructSchemas,
  builtInPortSchemas,
  builtInSchemaGroups,
  hydrateBuiltIns,
  builtInSeedCatalog,
  hydrateSeed,
  softwareArchitectureSeed,
  sketchingSeed,
  bpmnSeed,
  awsSeed,
  capabilityModelSeed,
  flowInPort,
  flowOutPort,
  parentPort,
  childPort,
  symmetricPort,
  interceptPort,
  relayPort,
} from './built-ins.js';

export type { SchemaSeed } from './seed-loader.js';
