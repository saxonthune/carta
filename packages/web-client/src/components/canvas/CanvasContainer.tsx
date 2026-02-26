import { useState, useEffect, lazy, Suspense } from 'react';
import MapV2 from './MapV2';
import LayoutMap from './LayoutMap';
import MetamapV2 from '../metamap-v2/MetamapV2';
import Footer from '../Footer';
import SearchBar from '../ui/SearchBar';
import { Tooltip } from '../ui';
import { MapPin } from '@phosphor-icons/react';

const ResourceView = lazy(() => import('../ResourceView'));

type ActiveView =
  | { type: 'page'; pageId: string }
  | { type: 'metamap' }
  | { type: 'resource'; resourceId: string };

interface CanvasContainerProps {
  onSelectionChange: (nodes: any[]) => void;
  activeView: ActiveView;
}

export default function CanvasContainer({
  onSelectionChange,
  activeView,
}: CanvasContainerProps) {
  const [filterText, setFilterText] = useState('');
  const [instanceSearchText, setInstanceSearchText] = useState('');
  const [showLayoutMap, setShowLayoutMap] = useState(false);

  useEffect(() => {
    performance.mark('carta:canvas-mounted')
    performance.measure('carta:render-to-canvas', 'carta:render-start', 'carta:canvas-mounted')
  }, [])

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
      {/* Canvas toolbar overlay */}
      {!showLayoutMap && activeView.type !== 'resource' && (
        <div className="absolute top-3 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3">
            {activeView.type === 'page' ? (
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
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {activeView.type === 'page' ? (
          showLayoutMap ? (
            <LayoutMap onClose={() => setShowLayoutMap(false)} />
          ) : (
            <MapV2 searchText={instanceSearchText} onSelectionChange={onSelectionChange} />
          )
        ) : activeView.type === 'metamap' ? (
          <MetamapV2 />
        ) : (
          <Suspense fallback={null}>
            <ResourceView resourceId={activeView.resourceId} />
          </Suspense>
        )}
      </div>

      {activeView.type === 'page' && !showLayoutMap && (
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
