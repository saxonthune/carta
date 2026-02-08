import type { ConstructValues } from '@carta/domain';

/**
 * Stable dispatch object shared across all nodes.
 * Each method takes nodeId as the first argument.
 * Created once in Map.tsx with empty deps — never changes identity.
 */
export interface NodeActions {
  onRename: (nodeId: string, newName: string) => void;
  onValuesChange: (nodeId: string, values: ConstructValues) => void;
  onSetViewLevel: (nodeId: string, level: 'summary' | 'details') => void;
  onToggleDetailsPin: (nodeId: string) => void;
  onOpenFullView: (nodeId: string) => void;
  onInstanceColorChange: (nodeId: string, color: string | null) => void;
  onToggleCollapse: (nodeId: string) => void;
  onSpreadChildren: (nodeId: string) => void;
}
