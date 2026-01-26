/**
 * Guide re-exports from @carta/core
 *
 * Note: This file exists because @carta/core/guides doesn't have proper
 * TypeScript declarations. The guides are exported from the main @carta/core
 * module in the JS bundle but not in the .d.ts file.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - guides are exported from JS but not .d.ts
export { GUIDES, METAMODEL_GUIDE, ANALYSIS_GUIDE } from '@carta/core';

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
