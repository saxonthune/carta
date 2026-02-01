import type { ReactNode } from 'react';

export interface Tab<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  variant?: 'icon-only' | 'icon-label';
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function TabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  variant = 'icon-label',
  className = '',
  collapsed = false,
  onToggleCollapse,
}: TabBarProps<T>) {
  // Collapse button with bidirectional arrows (expand out or in)
  const collapseButton = onToggleCollapse && (
    <button
      onClick={onToggleCollapse}
      className="w-full flex items-center justify-center py-1.5 rounded-md text-content-muted hover:bg-surface-depth-3/50 hover:text-content transition-colors cursor-pointer"
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        {collapsed ? (
          // Expand arrow (pointing right/out)
          <path d="M9 18l6-6-6-6" />
        ) : (
          // Collapse arrow (pointing left/in)
          <path d="M15 18l-6-6 6-6" />
        )}
      </svg>
    </button>
  );

  // Icon-only (collapsed) variant - uses same small icon size as expanded
  if (variant === 'icon-only') {
    return (
      <div className={`w-10 bg-surface-depth-1 flex flex-col py-2 px-1 overflow-hidden ${className}`}>
        <div className="bg-surface-depth-2 rounded-xl p-1 flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                  : 'text-content-muted hover:bg-surface-depth-3/50 hover:text-content'
              }`}
            >
              <div className="w-3.5 h-3.5">{tab.icon}</div>
            </button>
          ))}
        </div>
        {collapseButton && (
          <div className="pt-1 border-t border-surface-depth-3 shrink-0">
            {collapseButton}
          </div>
        )}
      </div>
    );
  }

  // Expanded variant with labels - scrollable when viewport is small
  return (
    <div className={`bg-surface-depth-1 flex flex-col w-[120px] shrink-0 p-2 overflow-hidden ${className}`}>
      <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex flex-row items-center justify-start gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all shrink-0 ${
              activeTab === tab.id
                ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                : 'text-content bg-transparent hover:bg-surface-depth-3/50'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="w-3.5 h-3.5 shrink-0">{tab.icon}</div>
            <span className="text-[11px] font-medium leading-tight truncate">{tab.label}</span>
          </button>
        ))}
      </div>
      {collapseButton && (
        <div className="pt-1.5 border-t border-surface-depth-3 shrink-0">
          {collapseButton}
        </div>
      )}
    </div>
  );
}
