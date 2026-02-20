import type { PortSchema } from '../types/index.js';

/**
 * Built-in Port Schema Constants
 *
 * Individual port schema definitions that can be imported by seeds.
 */

export const flowInPort: PortSchema = {
  id: 'flow-in',
  displayName: 'Flow In',
  semanticDescription: 'Receives data or control flow',
  polarity: 'sink',
  compatibleWith: ['flow-out'],
  expectedComplement: 'flow-out',
  color: '#3b82f6',
};

export const flowOutPort: PortSchema = {
  id: 'flow-out',
  displayName: 'Flow Out',
  semanticDescription: 'Sends data or control flow',
  polarity: 'source',
  compatibleWith: ['flow-in'],
  expectedComplement: 'flow-in',
  color: '#22c55e',
};

export const parentPort: PortSchema = {
  id: 'parent',
  displayName: 'Parent',
  semanticDescription: 'Contains or owns the connected construct',
  polarity: 'source',
  compatibleWith: ['child'],
  expectedComplement: 'child',
  color: '#8b5cf6',
};

export const childPort: PortSchema = {
  id: 'child',
  displayName: 'Child',
  semanticDescription: 'Is contained by or owned by the connected construct',
  polarity: 'sink',
  compatibleWith: ['parent'],
  expectedComplement: 'parent',
  color: '#8b5cf6',
};

export const symmetricPort: PortSchema = {
  id: 'symmetric',
  displayName: 'Link',
  semanticDescription: 'Bidirectional peer connection',
  polarity: 'bidirectional',
  compatibleWith: [],
  color: '#64748b',
};

export const interceptPort: PortSchema = {
  id: 'intercept',
  displayName: 'Intercept',
  semanticDescription: 'Pass-through input accepting any source connection (bypasses type checking)',
  polarity: 'intercept',
  compatibleWith: [],
  color: '#f59e0b',
};

export const relayPort: PortSchema = {
  id: 'relay',
  displayName: 'Relay',
  semanticDescription: 'Pass-through output connecting to any sink port (bypasses type checking)',
  polarity: 'relay',
  compatibleWith: [],
  color: '#f59e0b',
};
