/**
 * Guide re-exports from @carta/domain
 */

export { GUIDES, METAMODEL_GUIDE, ANALYSIS_GUIDE } from '@carta/domain';
export type { GuideId } from '@carta/domain';

// Type definitions for the guides
export interface GuideDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface GuidesMap {
  metamodel: GuideDefinition;
  analysis: GuideDefinition;
}
