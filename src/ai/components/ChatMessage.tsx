import type { UIMessage } from '../hooks/useAIChat';
import { ToolCallStatus } from './ToolCallStatus';

interface ChatMessageProps {
  message: UIMessage;
  onClick?: () => void;
}

export function ChatMessage({ message, onClick }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isClickable = !isUser && onClick;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-alt text-content'
        } ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-accent transition-all' : ''}`}
        onClick={isClickable ? onClick : undefined}
        title={isClickable ? 'Click to view details' : undefined}
      >
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
