import type { ConstructNodeData, ConstructSchema, PortConfig } from '@carta/domain';

export interface ConstructNodeVariantProps {
  id: string;
  data: ConstructNodeData;
  selected: boolean;
  // Dependency-injected (no hook calls in variants for these)
  schema: ConstructSchema;
  ports: PortConfig[];
  // Connection state
  isConnectionTarget: boolean;
  isDragActive: boolean;
  sourcePortType: string | undefined;
  // LOD transition
  lodTransitionStyle: React.CSSProperties;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `${value.length} items`;
    return 'object';
  }
  return String(value);
}

// Special value for "Add new..." deployable option
export const ADD_NEW_DEPLOYABLE = '__ADD_NEW__';
