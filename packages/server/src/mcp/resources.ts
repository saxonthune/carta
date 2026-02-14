/**
 * MCP Resource definitions and handlers for Carta guides
 */

import {
  GUIDES, METAMODEL_GUIDE, ANALYSIS_GUIDE,
  DOMAIN_DIRECTORY_GUIDE, SOFTWARE_ARCHITECTURE_GUIDE, AWS_GUIDE, BPMN_GUIDE,
} from './guides.js';

/**
 * Resource definition for MCP
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Get all resource definitions for MCP ListResources
 */
export function getResourceDefinitions(): ResourceDefinition[] {
  return Object.values(GUIDES);
}

/**
 * Map of URIs to guide content
 */
const GUIDE_CONTENT: Record<string, string> = {
  [GUIDES.metamodel.uri]: METAMODEL_GUIDE,
  [GUIDES.analysis.uri]: ANALYSIS_GUIDE,
  [GUIDES['domains'].uri]: DOMAIN_DIRECTORY_GUIDE,
  [GUIDES['domains/software-architecture'].uri]: SOFTWARE_ARCHITECTURE_GUIDE,
  [GUIDES['domains/aws'].uri]: AWS_GUIDE,
  [GUIDES['domains/bpmn'].uri]: BPMN_GUIDE,
};

/**
 * Get resource content by URI
 */
export function getResourceContent(uri: string): { content: string; mimeType: string } | null {
  const content = GUIDE_CONTENT[uri];
  if (!content) return null;
  const guide = Object.values(GUIDES).find(g => g.uri === uri);
  return guide ? { content, mimeType: guide.mimeType } : null;
}
