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
}

export default function TabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  variant = 'icon-label',
  className = '',
}: TabBarProps<T>) {
  if (variant === 'icon-only') {
    return (
      <div className={`w-14 bg-surface-depth-1 flex flex-col items-center py-2 px-1.5 ${className}`}>
        <div className="bg-surface-depth-2 rounded-xl p-1.5 flex flex-col gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                  : 'text-content-muted hover:bg-surface-depth-3/50 hover:text-content'
              }`}
            >
              <div className="w-5 h-5">{tab.icon}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface-depth-1 flex flex-col w-[110px] shrink-0 p-2 gap-1 rounded-xl ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flex flex-row items-center justify-start gap-2 p-1 rounded-lg cursor-pointer transition-all ${
            activeTab === tab.id
              ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
              : 'text-content bg-transparent hover:bg-surface-depth-3/50'
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          <div className="w-4 h-4 shrink-0">{tab.icon}</div>
          <span className="text-[12px] font-medium leading-tight">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
