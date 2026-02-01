import { useState, useRef, useEffect, useCallback } from 'react';
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
      className="fixed top-0 right-0 h-full bg-surface border-l border-border flex flex-col z-40"
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
            <svg className="w-4 h-4 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={clearMessages}
            className="p-1.5 rounded hover:bg-surface-alt"
            title="Clear chat"
          >
            <svg className="w-4 h-4 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded hover:bg-surface-alt"
            title="Close"
          >
            <svg className="w-4 h-4 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <rect x="4" y="4" width="12" height="12" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim() || !settings.apiKey}
                  className="px-3 py-2 bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
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
