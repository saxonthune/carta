/**
 * Guide re-exports from @carta/schema
 */

export {
  GUIDES, METAMODEL_GUIDE, ANALYSIS_GUIDE,
  DOMAIN_DIRECTORY_GUIDE, SOFTWARE_ARCHITECTURE_GUIDE, AWS_GUIDE, BPMN_GUIDE,
  REVERSE_ENGINEERING_GUIDE,
} from '@carta/schema';
export type { GuideId } from '@carta/schema';

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
