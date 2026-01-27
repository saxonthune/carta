// Components
export { AISidebar } from './components/AISidebar';
export { AISettings } from './components/AISettings';
export { ChatMessage } from './components/ChatMessage';
export { ToolCallStatus } from './components/ToolCallStatus';
export { MessageDetailModal } from './components/MessageDetailModal';

// Settings utilities
export {
  loadAISettings,
  saveAISettings,
  BUILT_IN_MODELS,
  DEFAULT_MODEL,
  type AISettingsData,
} from './settings';

// Hooks
export { useAIChat, type UIMessage, type ToolCallStatus as ToolCallStatusType } from './hooks/useAIChat';

// Tools
export {
  cartaTools,
  getAllToolSchemas,
  executeTool,
  type ToolSchema,
  type ToolResult,
  type ToolContext,
  type CartaTool,
} from './tools';

// OpenRouter
export { streamChat, chat } from './openrouter/client';
export { toOpenRouterTools } from './openrouter/adapter';
export type { ChatMessage as APIChatMessage, OpenRouterConfig, StreamChunk } from './openrouter/types';
