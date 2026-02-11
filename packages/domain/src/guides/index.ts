/**
 * Carta Guides - Static resources for AI agents
 */

export { METAMODEL_GUIDE } from './metamodel.js';
export { ANALYSIS_GUIDE } from './analysis.js';

/**
 * All available guides with their metadata
 */
export const GUIDES = {
  metamodel: {
    uri: 'carta://guide/metamodel',
    name: 'Carta Metamodel Guide',
    description: "Carta's metamodel (schemas, constructs, ports, organizers, pages) and key MCP tool workflows",
    mimeType: 'text/markdown',
  },
  analysis: {
    uri: 'carta://guide/analysis',
    name: 'Carta Analysis Guide',
    description: 'How to analyze a Carta document: structural health checks, completeness gaps, and code generation readiness',
    mimeType: 'text/markdown',
  },
} as const;

export type GuideId = keyof typeof GUIDES;
