import { useState } from 'react';
import MapV2 from './MapV2';
import LayoutMap from './LayoutMap';
import MetamapV2 from '../metamap-v2/MetamapV2';
import ViewToggle from '../ViewToggle';
import PageSwitcher from '../PageSwitcher';
import Footer from '../Footer';
import SearchBar from '../ui/SearchBar';
import { Tooltip } from '../ui';
import { MapPin } from '@phosphor-icons/react';
import type { Page } from '@carta/domain';

interface CanvasContainerProps {
  onSelectionChange: (nodes: any[]) => void;
  pages: Page[];
  activePage: string | undefined;
  onSetActivePage: (pageId: string) => void;
  onCreatePage: (name: string) => void;
  onDeletePage: (pageId: string) => boolean;
  onUpdatePage: (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges'>>) => void;
  onDuplicatePage: (pageId: string, newName: string) => Page;
}

export default function CanvasContainer({
  onSelectionChange,
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
  const [showLayoutMap, setShowLayoutMap] = useState(false);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Canvas toolbar overlay */}
      {!showLayoutMap && (
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
            <ViewToggle
              mode={viewMode}
              onChange={setViewMode}
            />
          </div>
        </div>
      )}
      {!showLayoutMap && viewMode === 'instances' && (
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
      )}

      <div className="flex-1 min-h-0">
        {viewMode === 'instances' ? (
          showLayoutMap ? (
            <LayoutMap onClose={() => setShowLayoutMap(false)} />
          ) : (
            <MapV2 searchText={instanceSearchText} onSelectionChange={onSelectionChange} />
          )
        ) : (
          <MetamapV2 />
        )}
      </div>
      {viewMode === 'instances' && !showLayoutMap && (
        <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
          <Tooltip content="Layout Map" placement="right">
            <button
              onClick={() => setShowLayoutMap(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-border shadow-sm text-content-muted hover:bg-accent hover:border-accent hover:text-white transition-colors"
            >
              <MapPin weight="bold" size={18} />
            </button>
          </Tooltip>
        </div>
      )}
      <Footer />
    </div>
  );
}
