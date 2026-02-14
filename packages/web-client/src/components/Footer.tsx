import { useState } from 'react';
import pkg from '../../package.json';
import HelpModal from './modals/HelpModal';
import { useGuideTooltips } from '../contexts/GuideTooltipContext';
import { Tooltip } from './ui';
import { guideContent } from '../data/guideContent';

export default function Footer() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { enabled: guideEnabled, toggle: toggleGuide } = useGuideTooltips();

  return (
    <div className="h-6 bg-surface-alt border-t border-border flex items-center justify-between px-2 shrink-0">
      <span className="text-[11px] text-content-muted">Carta {pkg.version}</span>
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/saxonthune/carta"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-content-muted hover:text-content transition-colors no-underline"
        >
          GitHub
        </a>
        <Tooltip content="Toggle guide tooltips" guideContent={guideContent['footer.guides']}>
          <button
            className={
              guideEnabled
                ? "text-[11px] text-guide font-medium transition-colors cursor-pointer border-none bg-transparent p-0"
                : "text-[11px] text-content-muted hover:text-content transition-colors cursor-pointer border-none bg-transparent p-0"
            }
            onClick={toggleGuide}
          >
            Guides
          </button>
        </Tooltip>
        <Tooltip content="Open help modal" guideContent={guideContent['footer.help']}>
          <button
            className="text-[11px] text-content-muted hover:text-content transition-colors cursor-pointer border-none bg-transparent p-0"
            onClick={() => setIsHelpOpen(true)}
          >
            Help
          </button>
        </Tooltip>
      </div>
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
