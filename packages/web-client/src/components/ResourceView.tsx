import { useState, useCallback, useEffect } from 'react';
import { useResources } from '../hooks/useResources';
import { useDocumentContext } from '../contexts/DocumentContext';

interface ResourceViewProps {
  resourceId: string;
}

export default function ResourceView({ resourceId }: ResourceViewProps) {
  const { adapter } = useDocumentContext();
  const { resources, getFullResource } = useResources();
  const [editingBody, setEditingBody] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [editingFormat, setEditingFormat] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<Array<{ versionId: string; contentHash: string; publishedAt: string; label?: string }>>([]);
  const [viewingVersion, setViewingVersion] = useState<{ versionId: string; body: string; label?: string; publishedAt: string } | null>(null);
  const [publishLabel, setPublishLabel] = useState('');

  // Load resource data when resourceId changes
  useEffect(() => {
    const full = getFullResource(resourceId);
    if (full) {
      setEditingBody(full.body);
      setEditingName(full.name);
      setEditingFormat(full.format);
      setHistoryVersions(adapter.getResourceHistory(resourceId));
      setShowHistory(false);
      setViewingVersion(null);
      setPublishLabel('');
    }
  }, [resourceId, adapter, getFullResource]);

  const handleDelete = useCallback((id: string) => {
    adapter.deleteResource(id);
  }, [adapter]);

  const handleBodyChange = useCallback((body: string) => {
    setEditingBody(body);
    adapter.updateResource(resourceId, { body });
  }, [adapter, resourceId]);

  const handleNameChange = useCallback((name: string) => {
    setEditingName(name);
    adapter.updateResource(resourceId, { name });
  }, [adapter, resourceId]);

  const handleFormatChange = useCallback((format: string) => {
    setEditingFormat(format);
    adapter.updateResource(resourceId, { format });
  }, [adapter, resourceId]);

  const handlePublish = useCallback(() => {
    const version = adapter.publishResourceVersion(resourceId, publishLabel || undefined);
    if (version) {
      setPublishLabel('');
      setHistoryVersions(adapter.getResourceHistory(resourceId));
    }
  }, [adapter, resourceId, publishLabel]);

  const handleViewVersion = useCallback((versionId: string) => {
    const version = adapter.getResourceVersion(resourceId, versionId);
    if (version) {
      setViewingVersion({
        versionId: version.versionId,
        body: version.body,
        label: version.label,
        publishedAt: version.publishedAt,
      });
    }
  }, [adapter, resourceId]);

  const handleCloseVersion = useCallback(() => {
    setViewingVersion(null);
  }, []);

  const selectedResource = resources.find(r => r.id === resourceId);

  return (
    <div className="flex h-full">
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

            {/* Publish bar */}
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <input
                type="text"
                value={publishLabel}
                onChange={(e) => setPublishLabel(e.target.value)}
                className="flex-1 px-2 py-1 text-sm rounded bg-surface border border-border text-content outline-none"
                placeholder="Version label (optional, e.g., 'Added billing address')"
                onKeyDown={(e) => e.key === 'Enter' && handlePublish()}
              />
              <button
                onClick={handlePublish}
                className="px-3 py-1 text-sm rounded bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Publish
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`px-2 py-1 text-sm rounded transition-colors ${showHistory ? 'bg-surface-alt text-content' : 'text-content-muted hover:text-content'}`}
              >
                History ({historyVersions.length})
              </button>
            </div>

            {/* Version history panel */}
            {showHistory && historyVersions.length > 0 && (
              <div className="px-4 py-2 border-b border-border max-h-48 overflow-y-auto bg-surface-depth-2">
                <div className="text-[11px] font-semibold text-content-muted uppercase mb-2">Published Versions</div>
                <div className="flex flex-col gap-1">
                  {[...historyVersions].reverse().map((v) => (
                    <div
                      key={v.versionId}
                      onClick={() => handleViewVersion(v.versionId)}
                      className={`px-2 py-1.5 rounded cursor-pointer transition-colors text-sm ${
                        viewingVersion?.versionId === v.versionId
                          ? 'bg-accent/10 border border-accent/30'
                          : 'hover:bg-surface-elevated'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-content font-medium">
                          {v.label || new Date(v.publishedAt).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-content-muted font-mono">{v.contentHash.slice(0, 8)}</span>
                      </div>
                      {v.label && (
                        <div className="text-[10px] text-content-muted">{new Date(v.publishedAt).toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body area */}
            <div className="flex-1 p-4 min-h-0">
              {viewingVersion ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-content-muted">
                      Viewing: {viewingVersion.label || new Date(viewingVersion.publishedAt).toLocaleString()} (read-only)
                    </span>
                    <button
                      onClick={handleCloseVersion}
                      className="px-2 py-1 text-xs rounded text-content-muted hover:text-content transition-colors"
                    >
                      Back to editor
                    </button>
                  </div>
                  <textarea
                    value={viewingVersion.body}
                    readOnly
                    className="w-full flex-1 p-3 font-mono text-sm text-content bg-surface-depth-3 rounded-lg border border-border resize-none outline-none opacity-80"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <textarea
                  value={editingBody}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  className="w-full h-full p-3 font-mono text-sm text-content bg-surface-depth-2 rounded-lg border border-border resize-none outline-none focus:ring-2 focus:ring-accent/60 transition-all"
                  placeholder="Enter resource body..."
                  spellCheck={false}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-content-muted">
            <div className="text-center">
              <div className="text-lg mb-2">Resource not found</div>
              <div className="text-sm">This resource may have been deleted.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
