import { useState } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import Map from './Map';
import Metamap from '../metamap/Metamap';
import ViewToggle from '../ViewToggle';
import PageSwitcher from '../PageSwitcher';
import Footer from '../Footer';
import SearchBar from '../ui/SearchBar';
import type { Page } from '@carta/domain';

interface CanvasContainerProps {
  title: string;
  onNodesEdgesChange: (nodes: Node[], edges: Edge[]) => void;
  onSelectionChange: (nodes: Node[]) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  pages: Page[];
  activePage: string | undefined;
  onSetActivePage: (pageId: string) => void;
  onCreatePage: (name: string) => void;
  onDeletePage: (pageId: string) => boolean;
  onUpdatePage: (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges'>>) => void;
  onDuplicatePage: (pageId: string, newName: string) => Page;
}

export default function CanvasContainer({
  title,
  onNodesEdgesChange,
  onSelectionChange,
  onNodeDoubleClick,
  pages,
  activePage,
  onSetActivePage,
  onCreatePage,
  onDeletePage,
  onUpdatePage,
  onDuplicatePage,
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
        <PageSwitcher
          pages={pages}
          activePage={activePage}
          onSetActivePage={onSetActivePage}
          onCreatePage={onCreatePage}
          onDeletePage={onDeletePage}
          onUpdatePage={onUpdatePage}
          onDuplicatePage={onDuplicatePage}
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
