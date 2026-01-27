import { useState, useCallback, useRef } from 'react';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { streamChat } from '../openrouter/client';
import { toOpenRouterTools } from '../openrouter/adapter';
import { getAllToolSchemas, executeTool } from '../tools/registry';
import type { ChatMessage, ToolCall } from '../openrouter/types';
import type { ToolContext } from '../tools/types';

/**
 * Status of a tool call
 */
export interface ToolCallStatus {
  id: string;
  name: string;
  arguments: string;
  status: 'pending' | 'executing' | 'success' | 'error';
  result?: unknown;
  error?: string;
}

/**
 * UI-friendly message representation
 */
export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallStatus[];
  timestamp: Date;
}

export interface UseAIChatOptions {
  apiKey: string;
  model: string;
}

const SYSTEM_PROMPT = `You are an AI assistant helping users design software architectures in Carta.

Carta is a visual editor where users create typed "constructs" (nodes) and connect them with edges to define relationships. Each construct has a type (like "controller", "service", "db_table") and fields specific to that type.

You have access to tools to:
- View the current document (getDocument) - returns all constructs, connections, schemas
- Query specific nodes (getNode, queryNodes) - find nodes by ID, type, or field values
- Add new constructs (addConstruct) - create new nodes on the canvas
- Update node values (updateNode) - modify existing construct fields
- Create connections (connectNodes) - link constructs via their ports
- Delete nodes (deleteNode) - remove constructs and their connections

When users ask you to make changes, use the appropriate tools. Always confirm what you've done after making changes.

Keep responses concise and focused on the task at hand.`;

export function useAIChat(options: UseAIChatOptions) {
  const { apiKey, model } = options;
  const { adapter } = useDocumentContext();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!apiKey || !text.trim()) return;

    setError(null);

    // Add user message
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Build conversation history for API
    const apiMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => {
        if (m.role === 'user') {
          return { role: 'user' as const, content: m.content };
        }
        // For assistant messages with tool calls, we need to include tool calls and results
        const msg: ChatMessage = { role: 'assistant' as const, content: m.content || null };
        if (m.toolCalls?.length) {
          msg.tool_calls = m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));
        }
        return msg;
      }),
      { role: 'user', content: text.trim() },
    ];

    // Add tool result messages for previous assistant messages
    for (const m of messages) {
      if (m.role === 'assistant' && m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          if (tc.status === 'success' || tc.status === 'error') {
            apiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: tc.error || JSON.stringify(tc.result),
            });
          }
        }
      }
    }

    const tools = toOpenRouterTools(getAllToolSchemas());
    const toolContext: ToolContext = { adapter, origin: 'ai-sidebar' };

    // Start streaming
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID();
    const assistantMessage: UIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Track tool calls being accumulated
    const pendingToolCalls = new Map<number, ToolCallStatus>();

    try {
      let needsToolExecution = false;
      const accumulatedToolCalls: ToolCall[] = [];

      for await (const chunk of streamChat(
        { apiKey, model },
        apiMessages,
        tools,
        abortControllerRef.current.signal
      )) {
        if (chunk.type === 'content' && chunk.content) {
          // Append content to assistant message
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk.content }
              : m
          ));
        } else if (chunk.type === 'tool_call_start' && chunk.toolCall) {
          // New tool call starting
          const tc: ToolCallStatus = {
            id: chunk.toolCall.id || crypto.randomUUID(),
            name: chunk.toolCall.name || '',
            arguments: '',
            status: 'pending',
          };
          pendingToolCalls.set(chunk.toolCall.index, tc);

          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, toolCalls: [...(m.toolCalls || []), tc] }
              : m
          ));
        } else if (chunk.type === 'tool_call_delta' && chunk.toolCall) {
          // Accumulate arguments
          const tc = pendingToolCalls.get(chunk.toolCall.index);
          if (tc && chunk.toolCall.arguments) {
            tc.arguments += chunk.toolCall.arguments;
          }
        } else if (chunk.type === 'tool_call_end' && chunk.toolCall) {
          // Tool call complete, ready for execution
          const tc = pendingToolCalls.get(chunk.toolCall.index);
          if (tc) {
            tc.id = chunk.toolCall.id || tc.id;
            tc.name = chunk.toolCall.name || tc.name;
            tc.arguments = chunk.toolCall.arguments || tc.arguments;
            accumulatedToolCalls.push({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            });
            needsToolExecution = true;
          }
        } else if (chunk.type === 'error') {
          setError(chunk.error || 'Unknown error');
          break;
        } else if (chunk.type === 'done') {
          // Streaming complete
          break;
        }
      }

      // Execute tool calls if any
      if (needsToolExecution && accumulatedToolCalls.length > 0) {
        // Update tool call statuses to executing
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m;
          return {
            ...m,
            toolCalls: m.toolCalls?.map(tc => {
              const matched = accumulatedToolCalls.find(atc => atc.id === tc.id);
              if (matched) {
                return { ...tc, status: 'executing' as const };
              }
              return tc;
            }),
          };
        }));

        // Execute each tool
        const toolResults: ChatMessage[] = [];
        for (const tc of accumulatedToolCalls) {
          let parsedArgs: unknown = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            // Invalid JSON, use empty object
          }

          const result = executeTool(tc.function.name, parsedArgs, toolContext);

          // Update the specific tool call status
          setMessages(prev => prev.map(m => {
            if (m.id !== assistantId) return m;
            return {
              ...m,
              toolCalls: m.toolCalls?.map(existingTc => {
                if (existingTc.id !== tc.id) return existingTc;
                return {
                  ...existingTc,
                  status: result.success ? 'success' : 'error',
                  result: result.data,
                  error: result.error,
                } as ToolCallStatus;
              }),
            };
          }));

          toolResults.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result.success ? JSON.stringify(result.data) : (result.error || 'Unknown error'),
          });
        }

        // Continue conversation with tool results
        const continueMessages: ChatMessage[] = [
          ...apiMessages,
          {
            role: 'assistant',
            content: null,
            tool_calls: accumulatedToolCalls,
          },
          ...toolResults,
        ];

        // Get follow-up response
        const followUpId = crypto.randomUUID();
        const followUpMessage: UIMessage = {
          id: followUpId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, followUpMessage]);

        for await (const chunk of streamChat(
          { apiKey, model },
          continueMessages,
          tools,
          abortControllerRef.current?.signal
        )) {
          if (chunk.type === 'content' && chunk.content) {
            setMessages(prev => prev.map(m =>
              m.id === followUpId
                ? { ...m, content: m.content + chunk.content }
                : m
            ));
          } else if (chunk.type === 'error') {
            setError(chunk.error || 'Unknown error');
            break;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled, not an error
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [apiKey, model, adapter, messages]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    stopStreaming,
  };
}
