import SegmentedControl from './ui/SegmentedControl';

const VIEW_OPTIONS = [
  { id: 'instances' as const, label: 'Map' },
  { id: 'metamap' as const, label: 'Metamap' },
  { id: 'resources' as const, label: 'Resources' },
];

export type ViewMode = 'instances' | 'metamap' | 'resources';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return <SegmentedControl options={VIEW_OPTIONS} value={mode} onChange={onChange} />;
}
