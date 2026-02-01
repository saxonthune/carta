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
        <svg className="w-3 h-3 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
      {toolCall.status === 'error' && (
        <svg className="w-3 h-3 text-danger" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
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
