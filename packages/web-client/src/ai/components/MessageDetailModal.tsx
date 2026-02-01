import { useState } from 'react';
import type { UIMessage } from '../hooks/useAIChat';

interface MessageDetailModalProps {
  message: UIMessage;
  onClose: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  content: string;
  defaultExpanded?: boolean;
}

function CollapsibleSection({ title, content, defaultExpanded = false }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Show first 100 chars as preview
  const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;
  const displayContent = isExpanded ? content : preview;
  const showToggle = content.length > 100;

  return (
    <div className="border border-border rounded bg-surface-alt">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium text-content">{title}</span>
        {showToggle && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-accent hover:underline"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      <pre className="px-3 py-2 text-xs text-content-muted font-mono whitespace-pre-wrap break-words overflow-x-auto">
        {displayContent}
      </pre>
    </div>
  );
}

export function MessageDetailModal({ message, onClose }: MessageDetailModalProps) {
  // Format JSON with proper indentation
  const formatJSON = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop with blur and darken */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal content */}
      <div
        className="relative bg-surface border border-border rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-content">
              {message.role === 'user' ? 'User Message' : 'Assistant Message'}
            </h2>
            <p className="text-xs text-content-muted mt-1">
              {message.timestamp.toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-surface-alt transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Message Content */}
          {message.content && (
            <div>
              <h3 className="text-sm font-medium text-content mb-2">Content</h3>
              <div className="bg-surface-alt border border-border rounded px-4 py-3 text-sm text-content whitespace-pre-wrap">
                {message.content}
              </div>
            </div>
          )}

          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-content mb-2">
                Tool Calls ({message.toolCalls.length})
              </h3>
              <div className="space-y-3">
                {message.toolCalls.map((toolCall, index) => (
                  <div key={toolCall.id} className="border border-border rounded overflow-hidden">
                    {/* Tool header */}
                    <div className="bg-surface-alt px-4 py-2 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-content">
                            {index + 1}. {toolCall.name}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              toolCall.status === 'success'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                : toolCall.status === 'error'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                                : toolCall.status === 'executing'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            {toolCall.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tool details */}
                    <div className="p-4 space-y-3">
                      {/* Arguments */}
                      <CollapsibleSection
                        title="Parameters"
                        content={toolCall.arguments || '{}'}
                      />

                      {/* Result */}
                      {toolCall.status === 'success' && toolCall.result !== undefined && (
                        <CollapsibleSection
                          title="Result"
                          content={formatJSON(toolCall.result)}
                        />
                      )}

                      {/* Error */}
                      {toolCall.status === 'error' && toolCall.error && (
                        <div className="border border-danger rounded bg-danger-muted">
                          <div className="px-3 py-2 border-b border-danger">
                            <span className="text-sm font-medium text-danger">Error</span>
                          </div>
                          <div className="px-3 py-2 text-sm text-danger">
                            {toolCall.error}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show message if no content or tool calls */}
          {!message.content && (!message.toolCalls || message.toolCalls.length === 0) && (
            <div className="text-center text-content-subtle text-sm py-8">
              No diagnostic information available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
