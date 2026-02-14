import SegmentedControl from './ui/SegmentedControl';

const VIEW_OPTIONS = [
  { id: 'instances' as const, label: 'Map' },
  { id: 'metamap' as const, label: 'Metamap' },
];

interface ViewToggleProps {
  mode: 'instances' | 'metamap';
  onChange: (mode: 'instances' | 'metamap') => void;
}

export default function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return <SegmentedControl options={VIEW_OPTIONS} value={mode} onChange={onChange} />;
}
