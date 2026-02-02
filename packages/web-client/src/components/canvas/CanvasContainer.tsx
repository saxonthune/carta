import { useState } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import Map from './Map';
import Metamap from '../metamap/Metamap';
import ViewToggle from '../ViewToggle';
import LevelSwitcher from '../LevelSwitcher';
import Footer from '../Footer';
import type { Deployable, Level } from '@carta/domain';

interface CanvasContainerProps {
  deployables: Deployable[];
  onDeployablesChange: () => void;
  title: string;
  onNodesEdgesChange: (nodes: Node[], edges: Edge[]) => void;
  onSelectionChange: (nodes: Node[]) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  levels: Level[];
  activeLevel: string | undefined;
  onSetActiveLevel: (levelId: string) => void;
  onCreateLevel: (name: string) => void;
  onDeleteLevel: (levelId: string) => boolean;
  onUpdateLevel: (levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges' | 'deployables'>>) => void;
  onDuplicateLevel: (levelId: string, newName: string) => Level;
}

export default function CanvasContainer({
  deployables,
  onDeployablesChange,
  title,
  onNodesEdgesChange,
  onSelectionChange,
  onNodeDoubleClick,
  levels,
  activeLevel,
  onSetActiveLevel,
  onCreateLevel,
  onDeleteLevel,
  onUpdateLevel,
  onDuplicateLevel,
}: CanvasContainerProps) {
  const [viewMode, setViewMode] = useState<'instances' | 'metamap'>('instances');
  const [filterText, setFilterText] = useState('');

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Canvas toolbar overlay */}
      <div className="absolute top-3 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3">
          {/* Filter - only visible in metamap mode */}
          {viewMode === 'metamap' && (
            <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-1.5 border border-border-subtle"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-content-subtle shrink-0">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && filterText) {
                    setFilterText('');
                  }
                }}
                placeholder="Filter schemas..."
                className="bg-transparent border-none outline-none text-content text-sm w-40 placeholder:text-content-subtle"
              />
              {filterText.trim() && (
                <button
                  onClick={() => setFilterText('')}
                  className="text-content-subtle hover:text-content p-0.5 shrink-0 -mr-1"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>
      <div className="absolute top-3 right-3 z-10 pointer-events-auto">
        <LevelSwitcher
          levels={levels}
          activeLevel={activeLevel}
          onSetActiveLevel={onSetActiveLevel}
          onCreateLevel={onCreateLevel}
          onDeleteLevel={onDeleteLevel}
          onUpdateLevel={onUpdateLevel}
          onDuplicateLevel={onDuplicateLevel}
        />
      </div>

      <div className="flex-1 min-h-0">
        {viewMode === 'instances' ? (
          <ReactFlowProvider>
            <Map
              deployables={deployables}
              onDeployablesChange={onDeployablesChange}
              title={title}
              onNodesEdgesChange={onNodesEdgesChange}
              onSelectionChange={onSelectionChange}
              onNodeDoubleClick={onNodeDoubleClick}
            />
          </ReactFlowProvider>
        ) : (
          <Metamap filterText={filterText} onFilterTextChange={setFilterText} />
        )}
      </div>
      <Footer />
    </div>
  );
}
