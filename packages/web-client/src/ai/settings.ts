/**
 * AI settings storage utilities
 */

export interface AISettingsData {
  apiKey: string;
  model: string;
  customModels: string[];
}

const STORAGE_KEY = 'carta-ai-settings';

export const BUILT_IN_MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
];

export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

export function loadAISettings(): AISettingsData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        apiKey: parsed.apiKey || '',
        model: parsed.model || DEFAULT_MODEL,
        customModels: Array.isArray(parsed.customModels) ? parsed.customModels : [],
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { apiKey: '', model: DEFAULT_MODEL, customModels: [] };
}

export function saveAISettings(settings: AISettingsData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
