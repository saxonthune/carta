import type {
  OpenRouterConfig,
  ChatMessage,
  OpenRouterTool,
  StreamChunk,
  StreamChunkData,
} from './types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Stream chat completion from OpenRouter with function calling support
 */
export async function* streamChat(
  config: OpenRouterConfig,
  messages: ChatMessage[],
  tools?: OpenRouterTool[],
  abortSignal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Carta',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: tools?.length ? tools : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
      stream: true,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API request failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use status code message
    }
    yield { type: 'error', error: errorMessage };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  // Track accumulated tool calls by index
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') {
          if (trimmed === 'data: [DONE]') {
            // Emit any completed tool calls
            for (const [index, tc] of toolCalls) {
              yield {
                type: 'tool_call_end',
                toolCall: { index, id: tc.id, name: tc.name, arguments: tc.arguments },
              };
            }
            yield { type: 'done' };
          }
          continue;
        }

        if (!trimmed.startsWith('data: ')) continue;

        try {
          const data: StreamChunkData = JSON.parse(trimmed.slice(6));
          const choice = data.choices[0];
          if (!choice) continue;

          const delta = choice.delta;

          // Handle content
          if (delta.content) {
            yield { type: 'content', content: delta.content };
          }

          // Handle tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCalls.get(tc.index);

              if (tc.id) {
                // New tool call starting
                toolCalls.set(tc.index, {
                  id: tc.id,
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                });
                yield {
                  type: 'tool_call_start',
                  toolCall: {
                    index: tc.index,
                    id: tc.id,
                    name: tc.function?.name,
                  },
                };
              } else if (existing) {
                // Accumulating arguments
                if (tc.function?.name) {
                  existing.name += tc.function.name;
                }
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments;
                  yield {
                    type: 'tool_call_delta',
                    toolCall: {
                      index: tc.index,
                      arguments: tc.function.arguments,
                    },
                  };
                }
              }
            }
          }

          // Handle finish reason
          if (choice.finish_reason) {
            // Emit any completed tool calls before done
            if (choice.finish_reason === 'tool_calls') {
              for (const [index, tc] of toolCalls) {
                yield {
                  type: 'tool_call_end',
                  toolCall: { index, id: tc.id, name: tc.name, arguments: tc.arguments },
                };
              }
            }
            yield { type: 'done', finishReason: choice.finish_reason };
          }
        } catch (parseError) {
          // Skip malformed chunks
          console.warn('Failed to parse SSE chunk:', trimmed, parseError);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Non-streaming chat completion (for simpler use cases)
 */
export async function chat(
  config: OpenRouterConfig,
  messages: ChatMessage[],
  tools?: OpenRouterTool[]
): Promise<ChatMessage> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Carta',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: tools?.length ? tools : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message;
}
