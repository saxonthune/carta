import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getGuideTooltips, setGuideTooltips } from '../utils/preferences';

interface GuideTooltipContextValue {
  enabled: boolean;
  toggle: () => void;
}

const GuideTooltipContext = createContext<GuideTooltipContextValue | null>(null);

export function useGuideTooltips(): GuideTooltipContextValue {
  const ctx = useContext(GuideTooltipContext);
  if (!ctx) throw new Error('useGuideTooltips must be used within GuideTooltipProvider');
  return ctx;
}

export function GuideTooltipProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => getGuideTooltips() === 'on');

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      setGuideTooltips(next ? 'on' : 'off');
      return next;
    });
  }, []);

  return (
    <GuideTooltipContext.Provider value={{ enabled, toggle }}>
      {children}
    </GuideTooltipContext.Provider>
  );
}
