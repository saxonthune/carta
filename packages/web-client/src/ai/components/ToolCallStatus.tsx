import { Check, X } from '@phosphor-icons/react';
import type { ToolCallStatus as ToolCallStatusType } from '../hooks/useAIChat';

// Human-readable tool names
const TOOL_LABELS: Record<string, string> = {
  getDocument: 'Reading document',
  getNode: 'Getting node',
  addConstruct: 'Creating construct',
  updateNode: 'Updating node',
  connectNodes: 'Creating connection',
  deleteNode: 'Deleting node',
  queryNodes: 'Searching nodes',
};

interface ToolCallStatusProps {
  toolCall: ToolCallStatusType;
}

export function ToolCallStatus({ toolCall }: ToolCallStatusProps) {
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-surface-depth-2 rounded text-xs">
      {/* Status icon */}
      {toolCall.status === 'pending' && (
        <span className="w-3 h-3 border-2 border-content-subtle border-t-transparent rounded-full animate-spin" />
      )}
      {toolCall.status === 'executing' && (
        <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      )}
      {toolCall.status === 'success' && (
        <Check weight="bold" size={14} className="text-green-500" />
      )}
      {toolCall.status === 'error' && (
        <X weight="bold" size={14} className="text-danger" />
      )}

      {/* Label */}
      <span className="text-content-muted">{label}</span>

      {/* Error message */}
      {toolCall.status === 'error' && toolCall.error && (
        <span className="text-danger truncate max-w-[150px]" title={toolCall.error}>
          - {toolCall.error}
        </span>
      )}
    </div>
  );
}
