/**
 * Carta Guides - Static resources for AI agents
 */

export { METAMODEL_GUIDE } from './metamodel.js';
export { ANALYSIS_GUIDE } from './analysis.js';
export { DOMAIN_DIRECTORY_GUIDE, SOFTWARE_ARCHITECTURE_GUIDE, AWS_GUIDE, BPMN_GUIDE } from './domains/index.js';
export { REVERSE_ENGINEERING_GUIDE } from './reverse-engineering.js';

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
  'domains': {
    uri: 'carta://guide/domains',
    name: 'Domain Guide Directory',
    description: 'Index of domain-specific modeling guides with schema recommendations',
    mimeType: 'text/markdown',
  },
  'domains/software-architecture': {
    uri: 'carta://guide/domains/software-architecture',
    name: 'Software Architecture Guide',
    description: 'Schema recommendations for REST APIs, services, databases, and UI components',
    mimeType: 'text/markdown',
  },
  'domains/aws': {
    uri: 'carta://guide/domains/aws',
    name: 'AWS Cloud Guide',
    description: 'Schema recommendations for Lambda, API Gateway, DynamoDB, S3, and serverless patterns',
    mimeType: 'text/markdown',
  },
  'domains/bpmn': {
    uri: 'carta://guide/domains/bpmn',
    name: 'BPMN Process Guide',
    description: 'Schema recommendations for business processes, workflows, events, and gateways',
    mimeType: 'text/markdown',
  },
  'reverse-engineering': {
    uri: 'carta://guide/reverse-engineering',
    name: 'Reverse Engineering Guide',
    description: 'How to go from an existing codebase to a Carta canvas: identify components, create schemas, populate constructs, and connect',
    mimeType: 'text/markdown',
  },
} as const;

export type GuideId = keyof typeof GUIDES;
