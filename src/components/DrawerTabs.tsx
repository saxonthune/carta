export type DrawerTab = 'constructs' | 'ports' | 'groups' | 'deployables';

interface DrawerTabsProps {
  activeTab: DrawerTab;
  onTabClick: (tab: DrawerTab) => void;
}

const TABS = [
  {
    id: 'constructs' as const,
    label: 'Constructs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'ports' as const,
    label: 'Ports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
        <circle cx="12" cy="12" r="1"/>
        <path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>
        <circle cx="5" cy="5" r="1"/>
        <circle cx="19" cy="5" r="1"/>
        <circle cx="5" cy="19" r="1"/>
        <circle cx="19" cy="19" r="1"/>
      </svg>
    ),
  },
  {
    id: 'groups' as const,
    label: 'Groups',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    id: 'deployables' as const,
    label: 'Deployables',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
        <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
];

export default function DrawerTabs({ activeTab, onTabClick }: DrawerTabsProps) {
  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          title={tab.label}
          className={`
            w-12 h-12 flex items-center justify-center rounded-lg transition-all cursor-pointer shrink-0
            ${
              activeTab === tab.id
                ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-md shadow-accent/20'
                : 'bg-surface-depth-2 text-content-muted hover:bg-surface-depth-1 hover:text-content'
            }
            translate-x-0
          `}
        >
          <div className="w-5 h-5">{tab.icon}</div>
        </button>
      ))}
    </div>
  );
}
