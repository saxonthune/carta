import { useState, useCallback } from 'react';
import { useResources } from '../hooks/useResources';
import { useDocumentContext } from '../contexts/DocumentContext';

export default function ResourceView() {
  const { adapter } = useDocumentContext();
  const { resources, getFullResource } = useResources();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [editingFormat, setEditingFormat] = useState<string>('');

  const selectResource = useCallback((id: string) => {
    const full = getFullResource(id);
    if (full) {
      setSelectedId(id);
      setEditingBody(full.body);
      setEditingName(full.name);
      setEditingFormat(full.format);
    }
  }, [getFullResource]);

  const handleCreate = useCallback(() => {
    const created = adapter.createResource('New Resource', 'freeform', '');
    selectResource(created.id);
  }, [adapter, selectResource]);

  const handleDelete = useCallback((id: string) => {
    adapter.deleteResource(id);
    if (selectedId === id) {
      setSelectedId(null);
    }
  }, [adapter, selectedId]);

  const handleBodyChange = useCallback((body: string) => {
    setEditingBody(body);
    if (selectedId) {
      adapter.updateResource(selectedId, { body });
    }
  }, [adapter, selectedId]);

  const handleNameChange = useCallback((name: string) => {
    setEditingName(name);
    if (selectedId) {
      adapter.updateResource(selectedId, { name });
    }
  }, [adapter, selectedId]);

  const handleFormatChange = useCallback((format: string) => {
    setEditingFormat(format);
    if (selectedId) {
      adapter.updateResource(selectedId, { format });
    }
  }, [adapter, selectedId]);

  const selectedResource = selectedId ? resources.find(r => r.id === selectedId) : null;

  return (
    <div className="flex h-full">
      {/* Resource list panel */}
      <div className="w-64 border-r border-border bg-surface flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-content">Resources</span>
          <button
            onClick={handleCreate}
            className="px-2 py-1 text-xs rounded bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {resources.length === 0 ? (
            <div className="px-3 py-4 text-sm text-content-muted text-center">
              No resources yet. Create one to get started.
            </div>
          ) : (
            resources.map((r) => (
              <div
                key={r.id}
                onClick={() => selectResource(r.id)}
                className={`px-3 py-2 cursor-pointer border-b border-border/50 transition-colors ${
                  selectedId === r.id ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-surface-elevated'
                }`}
              >
                <div className="text-sm font-medium text-content truncate">{r.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted">{r.format}</span>
                  {r.versionCount > 0 && (
                    <span className="text-[10px] text-content-muted">{r.versionCount} ver.</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedResource ? (
          <>
            {/* Editor header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <input
                type="text"
                value={editingName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="text-lg font-semibold text-content bg-transparent border-none outline-none flex-1"
                placeholder="Resource name"
              />
              <select
                value={editingFormat}
                onChange={(e) => handleFormatChange(e.target.value)}
                className="px-2 py-1 text-xs rounded bg-surface-alt text-content border border-border"
              >
                <option value="freeform">Freeform</option>
                <option value="typescript">TypeScript</option>
                <option value="json-schema">JSON Schema</option>
                <option value="openapi">OpenAPI</option>
                <option value="dbml">DBML</option>
                <option value="graphql">GraphQL</option>
              </select>
              <button
                onClick={() => handleDelete(selectedResource.id)}
                className="px-2 py-1 text-xs rounded text-danger hover:bg-danger/10 transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Body editor */}
            <div className="flex-1 p-4 min-h-0">
              <textarea
                value={editingBody}
                onChange={(e) => handleBodyChange(e.target.value)}
                className="w-full h-full p-3 font-mono text-sm text-content bg-surface-depth-2 rounded-lg border border-border resize-none outline-none focus:ring-2 focus:ring-accent/60 transition-all"
                placeholder="Enter resource body..."
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-content-muted">
            <div className="text-center">
              <div className="text-lg mb-2">No resource selected</div>
              <div className="text-sm">Select a resource from the list or create a new one.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
