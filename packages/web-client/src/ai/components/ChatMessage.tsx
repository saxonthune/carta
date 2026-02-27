import type { UIMessage } from '../hooks/useAIChat';
import { ToolCallStatus } from './ToolCallStatus';

interface ChatMessageProps {
  message: UIMessage;
  onClick?: () => void;
  isStreaming?: boolean;
}

export function ChatMessage({ message, onClick, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isClickable = !isUser && onClick;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-alt text-content'
        } ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-accent transition-all' : ''} ${
          isStreaming ? 'ring-1 ring-accent/30 animate-pulse' : ''
        }`}
        onClick={isClickable ? onClick : undefined}
        title={isClickable ? 'Click to view details' : undefined}
      >
        {/* Pulsing dots when streaming with no content yet */}
        {isStreaming && !message.content && (!message.toolCalls || message.toolCalls.length === 0) && (
          <div className="flex gap-1 py-1">
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className={`space-y-1 ${message.content ? 'mt-2' : ''}`}>
            {message.toolCalls.map((tc) => (
              <ToolCallStatus key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Inline failure summary */}
        {!isStreaming && message.role === 'assistant' && message.toolCalls?.some(tc => tc.status === 'error') && !message.content && (
          <div className="text-xs text-danger mt-1">
            Failed: {message.toolCalls.find(tc => tc.status === 'error')?.error?.substring(0, 80) || 'Unknown error'}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-white/60' : 'text-content-subtle'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
