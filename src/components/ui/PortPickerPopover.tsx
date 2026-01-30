import type { PortConfig } from '../../constructs/types';
import { getPortColor } from '../../constructs/ports';

interface PortPickerPopoverProps {
  ports: PortConfig[];
  onSelect: (portId: string) => void;
  onClose: () => void;
}

export default function PortPickerPopover({ ports, onSelect, onClose }: PortPickerPopoverProps) {
  return (
    <div
      className="absolute top-full right-0 mt-1 bg-surface rounded-lg shadow-lg border min-w-[140px] z-50 py-1"
      onMouseLeave={onClose}
    >
      {ports.map((port) => (
        <button
          key={port.id}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-content hover:bg-surface-depth-1 transition-colors border-none bg-transparent cursor-pointer text-left"
          onClick={() => onSelect(port.id)}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: getPortColor(port.portType) }}
          />
          <span>{port.label}</span>
        </button>
      ))}
    </div>
  );
}
