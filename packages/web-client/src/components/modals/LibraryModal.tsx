import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useLibrary } from '../../hooks/useLibrary';
import type { SchemaPackage } from '@carta/domain';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

interface LibraryModalProps {
  onClose: () => void;
}

export default function LibraryModal({ onClose }: LibraryModalProps) {
  const { libraryEntries, schemaPackages, schemas, publishPackage, applyLibraryEntry } = useLibrary();

  const [publishingPackageId, setPublishingPackageId] = useState<string | null>(null);
  const [publishChangelog, setPublishChangelog] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePublish = async (packageId: string) => {
    setLoadingAction(`publish-${packageId}`);
    setError(null);
    setSuccess(null);
    try {
      await publishPackage(packageId, publishChangelog || undefined);
      setSuccess(`Package published successfully`);
      setPublishingPackageId(null);
      setPublishChangelog('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish package');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApply = async (entryId: string, version?: number) => {
    setLoadingAction(`apply-${entryId}`);
    setError(null);
    setSuccess(null);
    try {
      await applyLibraryEntry(entryId, version);
      setSuccess(`Library entry applied successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply library entry');
    } finally {
      setLoadingAction(null);
    }
  };

  const getSchemaCount = (packageId: string): number => {
    return schemas.filter((s) => s.packageId === packageId).length;
  };

  const getActivePackageForEntry = (entryId: string): SchemaPackage | undefined => {
    return schemaPackages.find((pkg) => pkg.libraryEntryId === entryId);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Schema Library" maxWidth="800px">
      <div className="flex flex-col gap-4">
        {/* Feedback messages */}
        {error && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
            {success}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-4 min-h-[400px]">
          {/* Left panel - Active Packages */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-content-muted uppercase tracking-wide">
              Active Packages
            </h3>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {schemaPackages.length === 0 && (
                <div className="text-sm text-content-muted italic">No active packages</div>
              )}
              {schemaPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="p-3 bg-surface border border-border rounded-lg flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: pkg.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-content">{pkg.name}</div>
                      <div className="text-xs text-content-muted">
                        {getSchemaCount(pkg.id)} schema{getSchemaCount(pkg.id) !== 1 ? 's' : ''}
                      </div>
                      {pkg.libraryEntryId && (
                        <div className="text-xs text-blue-400 mt-1">
                          Applied from library v{pkg.appliedVersion ?? '?'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Publish section */}
                  {publishingPackageId === pkg.id ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Changelog (optional)"
                        value={publishChangelog}
                        onChange={(e) => setPublishChangelog(e.target.value)}
                        className="px-2 py-1 text-sm bg-surface-alt border border-border rounded text-content"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handlePublish(pkg.id)}
                          disabled={loadingAction === `publish-${pkg.id}`}
                        >
                          {loadingAction === `publish-${pkg.id}` ? 'Publishing...' : 'Confirm'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setPublishingPackageId(null);
                            setPublishChangelog('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setPublishingPackageId(pkg.id)}
                      disabled={loadingAction !== null}
                    >
                      Publish
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right panel - Library Entries */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-content-muted uppercase tracking-wide">
              Library Entries
            </h3>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {libraryEntries.length === 0 && (
                <div className="text-sm text-content-muted italic">No library entries</div>
              )}
              {libraryEntries.map((entry) => {
                const latestVersion = entry.versions[entry.versions.length - 1];
                const activePackage = getActivePackageForEntry(entry.id);
                const isExpanded = expandedEntryId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="p-3 bg-surface border border-border rounded-lg flex flex-col gap-2"
                  >
                    <div
                      className="flex items-start gap-2 cursor-pointer"
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: entry.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-content">{entry.name}</div>
                        {latestVersion && (
                          <>
                            <div className="text-xs text-content-muted">
                              v{latestVersion.version} • {formatTimeAgo(new Date(latestVersion.publishedAt))}
                            </div>
                            {latestVersion.changelog && (
                              <div className="text-xs text-content-muted italic mt-0.5">
                                "{latestVersion.changelog}"
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    {activePackage ? (
                      <div className="text-xs text-green-400 mt-1">
                        Active: v{activePackage.appliedVersion ?? '?'}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleApply(entry.id)}
                        disabled={loadingAction !== null}
                      >
                        {loadingAction === `apply-${entry.id}` ? 'Applying...' : 'Apply'}
                      </Button>
                    )}

                    {/* Expanded version history */}
                    {isExpanded && entry.versions.length > 1 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <div className="text-xs font-semibold text-content-muted mb-2">
                          Version History
                        </div>
                        <div className="flex flex-col gap-1">
                          {[...entry.versions].reverse().map((ver) => (
                            <div key={ver.version} className="text-xs text-content-muted">
                              <span className="font-medium">v{ver.version}</span>
                              {ver.changelog && <span className="italic"> - {ver.changelog}</span>}
                              <span className="ml-1">
                                ({formatTimeAgo(new Date(ver.publishedAt))})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
