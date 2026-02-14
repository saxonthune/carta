import { Star } from '@phosphor-icons/react';
import SegmentedControl from './ui/SegmentedControl';

const VIEW_OPTIONS = [
  { id: 'instances' as const, label: 'Map' },
  { id: 'metamap' as const, label: 'Metamap' },
];

interface ViewToggleProps {
  mode: 'instances' | 'metamap';
  onChange: (mode: 'instances' | 'metamap') => void;
  metamapV2?: boolean;
  onToggleMetamapV2?: () => void;
  mapV2?: boolean;
  onToggleMapV2?: () => void;
}

export default function ViewToggle({ mode, onChange, metamapV2, onToggleMetamapV2, mapV2, onToggleMapV2 }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1.5">
      <SegmentedControl options={VIEW_OPTIONS} value={mode} onChange={onChange} />
      {mode === 'metamap' && onToggleMetamapV2 && (
        <button
          onClick={onToggleMetamapV2}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
            metamapV2
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-surface-alt text-content-muted hover:bg-surface-alt/80'
          }`}
          title={metamapV2 ? 'Switch to classic metamap' : 'Try new metamap'}
        >
          <Star weight={metamapV2 ? 'fill' : 'regular'} size={14} />
        </button>
      )}
      {mode === 'instances' && onToggleMapV2 && (
        <button
          onClick={onToggleMapV2}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
            mapV2
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-surface-alt text-content-muted hover:bg-surface-alt/80'
          }`}
          title={mapV2 ? 'Switch to classic map' : 'Try new map'}
        >
          <Star weight={mapV2 ? 'fill' : 'regular'} size={14} />
        </button>
      )}
    </div>
  );
}
