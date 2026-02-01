import { useState, useEffect, useMemo } from 'react';
import {
  saveAISettings,
  BUILT_IN_MODELS,
  type AISettingsData,
} from '../settings';

interface AISettingsProps {
  onClose: () => void;
  onSave: (settings: AISettingsData) => void;
  initialSettings: AISettingsData;
}

export function AISettings({ onClose, onSave, initialSettings }: AISettingsProps) {
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [model, setModel] = useState(initialSettings.model);
  const [customModels, setCustomModels] = useState<string[]>(initialSettings.customModels);
  const [newModelInput, setNewModelInput] = useState('');

  useEffect(() => {
    setApiKey(initialSettings.apiKey);
    setModel(initialSettings.model);
    setCustomModels(initialSettings.customModels);
  }, [initialSettings]);

  const handleSave = () => {
    const settings = { apiKey, model, customModels };
    saveAISettings(settings);
    onSave(settings);
    onClose();
  };

  const handleAddModel = () => {
    const trimmed = newModelInput.trim();
    console.log('Adding model:', trimmed);
    if (!trimmed) {
      console.log('Model input is empty');
      return;
    }

    // Check if already exists in built-in or custom models
    const existsInBuiltIn = BUILT_IN_MODELS.some(m => m.id === trimmed);
    const existsInCustom = customModels.includes(trimmed);

    if (existsInBuiltIn || existsInCustom) {
      console.log('Model already exists');
      return; // Already exists
    }

    console.log('Adding model to customModels:', [...customModels, trimmed]);
    setCustomModels(prev => [...prev, trimmed]);
    setNewModelInput('');
  };

  const handleDeleteModel = (modelToDelete: string) => {
    setCustomModels(prev => prev.filter(m => m !== modelToDelete));
    // If the deleted model was selected, switch to default
    if (model === modelToDelete) {
      setModel(BUILT_IN_MODELS[0].id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddModel();
    }
  };

  // Combined list of all available models for the dropdown
  const allModels = useMemo(() => {
    const models = [...BUILT_IN_MODELS];
    for (const customId of customModels) {
      models.push({ id: customId, name: customId });
    }
    return models;
  }, [customModels]);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium text-content">AI Settings</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-content-muted mb-1">
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-content-subtle">
            Get your key at{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              openrouter.ai/keys
            </a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-content-muted mb-1">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {allModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-content-muted mb-1">
            Custom Models
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newModelInput}
              onChange={(e) => setNewModelInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., mistralai/mixtral-8x7b"
              className="flex-1 px-3 py-2 text-sm text-content bg-surface border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              onClick={handleAddModel}
              disabled={!newModelInput.trim()}
              className="px-3 py-2 text-sm bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          <p className="mt-1 text-xs text-content-subtle">
            Find model IDs at{' '}
            <a
              href="https://openrouter.ai/models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              openrouter.ai/models
            </a>
          </p>

          {/* Custom models list */}
          {customModels.length > 0 ? (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {customModels.map((customModel) => (
                <div
                  key={customModel}
                  className="flex items-center justify-between px-2 py-1.5 bg-surface-alt rounded text-sm"
                >
                  <span className="text-content truncate flex-1">{customModel}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteModel(customModel)}
                    className="ml-2 p-1 text-content-subtle hover:text-danger rounded flex-shrink-0"
                    title="Remove model"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-content-subtle italic">
              No custom models added yet
            </div>
          )}
        </div>

        <div className="p-3 bg-accent-muted rounded text-xs text-content-muted">
          <strong>Note:</strong> Your API key is stored in localStorage. It never leaves your browser except to call OpenRouter.
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-content-muted hover:text-content rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent-hover"
        >
          Save
        </button>
      </div>
    </div>
  );
}
