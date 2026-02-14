import { useState, useRef, useEffect, useCallback } from 'react';
import { Gear, Trash, X, Stop, PaperPlaneTilt } from '@phosphor-icons/react';
import { useAIChat } from '../hooks/useAIChat';
import { ChatMessage } from './ChatMessage';
import { AISettings } from './AISettings';
import { MessageDetailModal } from './MessageDetailModal';
import { loadAISettings, type AISettingsData } from '../settings';
import type { UIMessage } from '../hooks/useAIChat';

interface AISidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  width: number;
}

export function AISidebar({ isOpen, onToggle, width }: AISidebarProps) {
  const [settings, setSettings] = useState<AISettingsData>(loadAISettings);
  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<UIMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isStreaming, error, sendMessage, clearMessages, stopStreaming } = useAIChat({
    apiKey: settings.apiKey,
    model: settings.model,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && !showSettings) {
      inputRef.current?.focus();
    }
  }, [isOpen, showSettings]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    sendMessage(inputValue);
    setInputValue('');
  }, [inputValue, isStreaming, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleSettingsSave = useCallback((newSettings: AISettingsData) => {
    setSettings(newSettings);
  }, []);

  // Don't render anything when closed (header button handles opening)
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="h-full bg-surface border-l border-border flex flex-col flex-shrink-0"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-content">AI Assistant</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded hover:bg-surface-alt ${showSettings ? 'bg-surface-alt' : ''}`}
            title="Settings"
          >
            <Gear weight="regular" size={16} className="text-content-muted" />
          </button>
          <button
            onClick={clearMessages}
            className="p-1.5 rounded hover:bg-surface-alt"
            title="Clear chat"
          >
            <Trash weight="regular" size={16} className="text-content-muted" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded hover:bg-surface-alt"
            title="Close"
          >
            <X weight="regular" size={16} className="text-content-muted" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings ? (
        <AISettings
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
          initialSettings={settings}
        />
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-content-subtle text-sm py-8">
                {settings.apiKey ? (
                  <>
                    <p>Ask me to help with your architecture.</p>
                    <p className="mt-2 text-xs">
                      Try: "Add a UserService controller" or "What constructs do I have?"
                    </p>
                  </>
                ) : (
                  <>
                    <p>Configure your API key to get started.</p>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="mt-2 text-accent hover:underline"
                    >
                      Open Settings
                    </button>
                  </>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onClick={message.role === 'assistant' ? () => setSelectedMessage(message) : undefined}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error display */}
          {error && (
            <div className="px-4 py-2 bg-danger-muted text-danger text-sm">
              {error}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-border">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={settings.apiKey ? "Ask about your architecture..." : "Configure API key first"}
                disabled={!settings.apiKey}
                rows={1}
                className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="px-3 py-2 bg-danger text-white rounded hover:bg-danger-hover"
                  title="Stop"
                >
                  <Stop weight="fill" size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim() || !settings.apiKey}
                  className="px-3 py-2 bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send"
                >
                  <PaperPlaneTilt weight="fill" size={16} />
                </button>
              )}
            </div>
          </form>
        </>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <MessageDetailModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
}
