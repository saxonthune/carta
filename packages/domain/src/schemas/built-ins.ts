import type { PortSchema } from '../types/index.js';
import {
  flowInPort,
  flowOutPort,
  parentPort,
  childPort,
  symmetricPort,
  interceptPort,
  relayPort,
} from './port-schemas.js';

/**
 * Built-in Port Schemas
 *
 * Default port type definitions with polarity-based connection semantics.
 * These define the reusable port types and their connection rules.
 *
 * These are document template infrastructure — every new document gets
 * these port schemas written at creation time.
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
