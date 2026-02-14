import Tooltip from '../ui/Tooltip';

interface CanvasToolbarProps {
  children: React.ReactNode;
}

export default function CanvasToolbar({ children }: CanvasToolbarProps) {
  return (
    <div
      data-no-pan="true"
      className="absolute top-3 left-3 z-10 pointer-events-auto"
    >
      <div className="flex flex-col gap-1 p-1 rounded-lg bg-surface border border-border shadow-sm">
        {children}
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
}

export function ToolbarButton({ onClick, tooltip, children }: ToolbarButtonProps) {
  return (
    <Tooltip content={tooltip} placement="right">
      <button
        onClick={onClick}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-depth-1 text-content-muted hover:text-content transition-colors"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function ToolbarDivider() {
  return <div className="h-px mx-1 bg-border" />;
}
