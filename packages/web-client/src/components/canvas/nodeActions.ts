import type { ConstructValues } from '@carta/domain';

/**
 * Stable dispatch object shared across all nodes.
 * Each method takes nodeId as the first argument.
 * Created once in Map.tsx with empty deps — never changes identity.
 */
export interface NodeActions {
  onRename: (nodeId: string, newName: string) => void;
  onValuesChange: (nodeId: string, values: ConstructValues) => void;
  onInstanceColorChange: (nodeId: string, color: string | null) => void;
  onToggleCollapse: (nodeId: string) => void;
  onSpreadChildren: (nodeId: string) => void;
  onFlowLayoutChildren: (nodeId: string) => void;
  onGridLayoutChildren: (nodeId: string) => void;
  onFitToChildren: (nodeId: string) => void;
  onUpdateOrganizerColor: (nodeId: string, color: string) => void;
  onRenameOrganizer: (nodeId: string, newName: string) => void;
}
