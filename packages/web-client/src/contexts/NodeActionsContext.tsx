import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useGroupOperations, type UseGroupOperationsResult } from '../hooks/useGroupOperations';

/**
 * Context value providing node-related actions.
 * Currently wraps group operations; can be extended to include graph operations.
 */
export interface NodeActionsContextValue extends UseGroupOperationsResult {}

const NodeActionsContext = createContext<NodeActionsContextValue | null>(null);

/**
 * Hook to access node actions from context.
 * Must be used within a NodeActionsProvider.
 */
export function useNodeActions(): NodeActionsContextValue {
  const context = useContext(NodeActionsContext);
  if (!context) {
    throw new Error('useNodeActions must be used within a NodeActionsProvider');
  }
  return context;
}

export interface NodeActionsProviderProps {
  children: ReactNode;
}

/**
 * Provider that composes node-related action hooks and provides stable callbacks via context.
 * This enables components to access actions without prop drilling while maintaining
 * stable callback references.
 */
export function NodeActionsProvider({ children }: NodeActionsProviderProps) {
  // Get group operations from dedicated hook
  const groupOps = useGroupOperations();

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<NodeActionsContextValue>(() => ({
    ...groupOps,
  }), [groupOps]);

  return (
    <NodeActionsContext.Provider value={value}>
      {children}
    </NodeActionsContext.Provider>
  );
}
