import { useState } from 'react';
import { CaretDown, File, FileCode } from '@phosphor-icons/react';
import type { WorkspaceTree } from '../hooks/useWorkspaceMode';

interface WorkspaceNavigatorProps {
  isOpen: boolean;
  tree: WorkspaceTree;
  /** Currently selected canvas path (room name), or null */
  selectedCanvas: string | null;
  /** Called when user clicks a canvas — no-op until workspace-09 wires DocumentAdapter per-canvas */
  onSelectCanvas: (canvasPath: string) => void;
}

interface GroupSectionProps {
  title: string;
  children: React.ReactNode;
}

function GroupSection({ title, children }: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-surface-depth-2 rounded-xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-1.5">
        <button
          className="flex items-center gap-1 flex-1 text-left text-sm font-medium text-content-muted hover:text-content transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          <CaretDown
            weight="bold"
            size={10}
            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
          {title}
        </button>
      </div>
      {!collapsed && children}
    </div>
  );
}

/** Strip .canvas.json or .canvas suffix from display name */
function displayName(name: string): string {
  return name.replace(/\.canvas\.json$/, '').replace(/\.canvas$/, '');
}

/** Derive a short format badge from file extension */
function formatBadge(name: string): string {
  const match = name.match(/\.([^.]+)$/);
  return match ? match[1] : 'file';
}

interface CanvasRowProps {
  name: string;
  path: string;
  isSelected: boolean;
  onClick: () => void;
}

function CanvasRow({ name, path: _path, isSelected, onClick }: CanvasRowProps) {
  return (
    <div
      className={`flex items-center min-h-[36px] cursor-pointer group transition-colors ${
        isSelected ? 'bg-[var(--color-surface-selected)]' : 'hover:bg-surface-alt'
      }`}
      onClick={onClick}
    >
      <div className={`w-[3px] self-stretch rounded-r flex-shrink-0 ${isSelected ? 'bg-accent' : ''}`} />
      <div className="flex-1 flex items-center gap-2 px-2 min-w-0">
        <FileCode weight="regular" size={14} className="flex-shrink-0 text-content-muted" />
        <span className="text-sm truncate text-content flex-1">{displayName(name)}</span>
      </div>
    </div>
  );
}

interface ResourceRowProps {
  name: string;
}

function ResourceRow({ name }: ResourceRowProps) {
  return (
    <div className="flex items-center min-h-[36px] transition-colors">
      <div className="w-[3px] self-stretch rounded-r flex-shrink-0" />
      <div className="flex-1 flex items-center gap-2 px-2 min-w-0">
        <File weight="regular" size={14} className="flex-shrink-0 text-content-muted" />
        <span className="text-sm font-medium text-content truncate flex-1">{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted flex-shrink-0">
          {formatBadge(name)}
        </span>
      </div>
    </div>
  );
}

export default function WorkspaceNavigator({
  isOpen,
  tree,
  selectedCanvas,
  onSelectCanvas,
}: WorkspaceNavigatorProps) {
  if (!isOpen) return null;

  const { groups, ungroupedFiles } = tree;

  return (
    <div
      data-testid="workspace-navigator-panel"
      className="h-full bg-surface-depth-1 border-r border-border flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ width: 256 }}
    >
      <div className="flex flex-col gap-2 p-2 pt-3">
        {groups.map((group) => (
          <GroupSection key={group.path} title={group.name}>
            {group.files.length === 0 ? (
              <div className="px-3 py-2 text-xs text-content-muted italic">Empty group.</div>
            ) : (
              group.files.map((file) => (
                file.type === 'canvas' ? (
                  <CanvasRow
                    key={file.path}
                    name={file.name}
                    path={file.path}
                    isSelected={selectedCanvas === file.path}
                    onClick={() => onSelectCanvas(file.path)}
                  />
                ) : (
                  <ResourceRow key={file.path} name={file.name} />
                )
              ))
            )}
          </GroupSection>
        ))}

        {ungroupedFiles.length > 0 && (
          <GroupSection title="Ungrouped">
            {ungroupedFiles.map((file) => (
              file.type === 'canvas' ? (
                <CanvasRow
                  key={file.path}
                  name={file.name}
                  path={file.path}
                  isSelected={selectedCanvas === file.path}
                  onClick={() => onSelectCanvas(file.path)}
                />
              ) : (
                <ResourceRow key={file.path} name={file.name} />
              )
            ))}
          </GroupSection>
        )}
      </div>
    </div>
  );
}
