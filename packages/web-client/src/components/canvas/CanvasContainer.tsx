import { useState } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import Map from './Map';
import Metamap from '../metamap/Metamap';
import ViewToggle from '../ViewToggle';
import LevelSwitcher from '../LevelSwitcher';
import Footer from '../Footer';
import SearchBar from '../ui/SearchBar';
import type { Level } from '@carta/domain';

interface CanvasContainerProps {
  title: string;
  onNodesEdgesChange: (nodes: Node[], edges: Edge[]) => void;
  onSelectionChange: (nodes: Node[]) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  levels: Level[];
  activeLevel: string | undefined;
  onSetActiveLevel: (levelId: string) => void;
  onCreateLevel: (name: string) => void;
  onDeleteLevel: (levelId: string) => boolean;
  onUpdateLevel: (levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges'>>) => void;
  onDuplicateLevel: (levelId: string, newName: string) => Level;
}

export default function CanvasContainer({
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
  const [instanceSearchText, setInstanceSearchText] = useState('');

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Canvas toolbar overlay */}
      <div className="absolute top-3 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3">
          {/* Search - visible in both modes */}
          {viewMode === 'instances' ? (
            <SearchBar
              value={instanceSearchText}
              onChange={setInstanceSearchText}
              placeholder="Search instances..."
            />
          ) : (
            <SearchBar
              value={filterText}
              onChange={setFilterText}
              placeholder="Filter schemas..."
            />
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
              title={title}
              onNodesEdgesChange={onNodesEdgesChange}
              onSelectionChange={onSelectionChange}
              onNodeDoubleClick={onNodeDoubleClick}
              searchText={instanceSearchText}
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
