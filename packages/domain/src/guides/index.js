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
        description: 'Learn how to read and understand Carta documents - the three-level metamodel, connections, traversal patterns, and data structures.',
        mimeType: 'text/markdown',
    },
    analysis: {
        uri: 'carta://guide/analysis',
        name: 'Carta Analysis Guide',
        description: 'Learn how to analyze Carta documents for structural issues, completeness gaps, and code generation readiness.',
        mimeType: 'text/markdown',
    },
};
