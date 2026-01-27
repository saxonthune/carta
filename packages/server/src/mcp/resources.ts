/**
 * MCP Resource definitions and handlers for Carta guides
 */

import { GUIDES, METAMODEL_GUIDE, ANALYSIS_GUIDE } from './guides.js';

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
 * Get resource content by URI
 */
export function getResourceContent(uri: string): { content: string; mimeType: string } | null {
  switch (uri) {
    case GUIDES.metamodel.uri:
      return {
        content: METAMODEL_GUIDE,
        mimeType: GUIDES.metamodel.mimeType,
      };
    case GUIDES.analysis.uri:
      return {
        content: ANALYSIS_GUIDE,
        mimeType: GUIDES.analysis.mimeType,
      };
    default:
      return null;
  }
}
