export { softwareArchitecturePackage } from './software-architecture.js';
export { sketchingPackage } from './sketching.js';
export { bpmnPackage } from './bpmn.js';
export { awsPackage } from './aws.js';
export { capabilityModelPackage } from './capability-model.js';

import type { SchemaPackageDefinition } from '../../types/index.js';
import { softwareArchitecturePackage } from './software-architecture.js';
import { sketchingPackage } from './sketching.js';
import { bpmnPackage } from './bpmn.js';
import { awsPackage } from './aws.js';
import { capabilityModelPackage } from './capability-model.js';

/**
 * All standard library packages shipped with Carta.
 * Pass individual definitions to applyPackage() to load them into a document.
 */
export const standardLibrary: SchemaPackageDefinition[] = [
  softwareArchitecturePackage,
  sketchingPackage,
  bpmnPackage,
  awsPackage,
  capabilityModelPackage,
];
