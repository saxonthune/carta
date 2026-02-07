import { useEffect } from 'react';
import type { NarrativeState } from '../../hooks/useNarrative';

interface NarrativeProps {
  narrative: NarrativeState | null;
  onDismiss: () => void;
}

export default function Narrative({ narrative, onDismiss }: NarrativeProps) {
  // Escape key dismissal
  useEffect(() => {
    if (!narrative) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [narrative, onDismiss]);

  if (!narrative) return null;

  if (narrative.kind === 'hint') {
    return <HintNarrative text={narrative.text} variant={narrative.variant} position={narrative.position} />;
  }

  // Edge narrative (existing)
  const yOffset = narrative.anchor === 'above' ? -64 : 16;

  return (
    <div
      className="fixed inset-0 z-[40] pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <div
        className="absolute pointer-events-auto bg-surface-elevated rounded-lg shadow-md px-3 py-2 transition-opacity duration-150"
        style={{
          left: narrative.position.x,
          top: narrative.position.y + yOffset,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="flex items-center gap-2 whitespace-nowrap">
          {/* From endpoint */}
          <div className="text-right">
            <div className="text-xs font-medium text-content leading-tight">{narrative.from.name}</div>
            <div className="text-[10px] text-content-muted leading-tight">{narrative.from.schemaType}</div>
          </div>

          {/* From port */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-content-muted font-mono">{narrative.from.portLabel}</span>
            <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: narrative.from.portColor }} />
          </div>

          {/* Arrow */}
          <span className="text-content-muted text-xs">&rarr;</span>

          {/* To port */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-content-muted font-mono">{narrative.to.portLabel}</span>
            <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: narrative.to.portColor }} />
          </div>

          {/* To endpoint */}
          <div>
            <div className="text-xs font-medium text-content leading-tight">{narrative.to.name}</div>
            <div className="text-[10px] text-content-muted leading-tight">{narrative.to.schemaType}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HintNarrative({ text, variant, position }: { text: string; variant: string; position: { x: number; y: number } }) {
  const colorClass = variant === 'attach'
    ? 'bg-emerald-600/90 text-white'
    : variant === 'detach'
      ? 'bg-red-600/90 text-white'
      : 'bg-surface-elevated text-content';

  return (
    <div
      className="fixed inset-0 z-[40] pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <div
        className={`absolute rounded-md shadow-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${colorClass}`}
        style={{
          left: position.x,
          top: position.y - 40,
          transform: 'translateX(-50%)',
        }}
      >
        {text}
      </div>
    </div>
  );
}
