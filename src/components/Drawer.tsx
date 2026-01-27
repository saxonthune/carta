import { useState, useRef } from 'react';
import ConstructEditor from './ConstructEditor';
import DeployablesEditor from './DeployablesEditor';
import PortSchemaEditor from './PortSchemaEditor';
import SchemaGroupEditor from './SchemaGroupEditor';
import ConfirmationModal from './ui/ConfirmationModal';
import type { DrawerTab } from './DrawerTabs';

interface DrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  activeTab: DrawerTab;
  onActiveTabChange: (tab: DrawerTab) => void;
  onDeployablesChange?: () => void;
}

export default function Drawer({
  isOpen,
  onOpen,
  onClose,
  activeTab,
  onActiveTabChange,
  onDeployablesChange = () => {},
}: DrawerProps) {
  const [constructsDirty, setConstructsDirty] = useState(false);
  const [deployablesDirty, setDeployablesDirty] = useState(false);
  const [portsDirty, setPortsDirty] = useState(false);
  const [groupsDirty, setGroupsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<DrawerTab | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const constructsEditorRef = useRef<{ save: () => void } | null>(null);
  const deployablesEditorRef = useRef<{ save: () => void } | null>(null);
  const portsEditorRef = useRef<{ save: () => void } | null>(null);
  const groupsEditorRef = useRef<{ save: () => void } | null>(null);

  // Suppress unused variable warnings for dirty states used in confirmation modal
  void constructsDirty;
  void deployablesDirty;
  void portsDirty;
  void groupsDirty;

  const handleConfirmSave = () => {
    // Trigger save in the current editor
    if (activeTab === 'constructs') {
      constructsEditorRef.current?.save();
    } else if (activeTab === 'deployables') {
      deployablesEditorRef.current?.save();
    } else if (activeTab === 'ports') {
      portsEditorRef.current?.save();
    } else if (activeTab === 'groups') {
      groupsEditorRef.current?.save();
    }
    setShowConfirmModal(false);
    // After save, proceed to pending tab
    setTimeout(() => {
      if (pendingTab) {
        onActiveTabChange(pendingTab);
      }
      setPendingTab(null);
    }, 0);
  };

  const handleConfirmDiscard = () => {
    if (pendingTab) {
      onActiveTabChange(pendingTab);
    }
    setShowConfirmModal(false);
    setPendingTab(null);
    // Reset dirty states
    if (activeTab === 'constructs') setConstructsDirty(false);
    if (activeTab === 'deployables') setDeployablesDirty(false);
    if (activeTab === 'ports') setPortsDirty(false);
    if (activeTab === 'groups') setGroupsDirty(false);
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingTab(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'constructs':
        return <ConstructEditor ref={constructsEditorRef} onDirtyChange={setConstructsDirty} />;
      case 'groups':
        return <SchemaGroupEditor ref={groupsEditorRef} onDirtyChange={setGroupsDirty} />;
      case 'deployables':
        return <DeployablesEditor ref={deployablesEditorRef} onDeployablesChange={onDeployablesChange} onDirtyChange={setDeployablesDirty} />;
      case 'ports':
        return <PortSchemaEditor ref={portsEditorRef} onDirtyChange={setPortsDirty} />;
      default:
        return null;
    }
  };

  const handleTabClick = (tab: DrawerTab) => {
    if (isOpen && activeTab === tab) {
      // Clicking active tab closes drawer
      onClose();
    } else if (isOpen) {
      // Switch to different tab
      onActiveTabChange(tab);
    } else {
      // Open drawer to this tab
      onActiveTabChange(tab);
      onOpen();
    }
  };

  // Calculate tab position - float to left of drawer when open
  const drawerWidth = 'min(85vw, 500px)';

  return (
    <>
      {/* Floating tab strip - always visible, moves with drawer */}
      <div
        className="fixed top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 transition-all duration-300 ease-in-out"
        style={{ right: isOpen ? `calc(${drawerWidth} + 8px)` : '8px' }}
      >
        {(['constructs', 'ports', 'groups', 'deployables'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            title={tab.charAt(0).toUpperCase() + tab.slice(1)}
            className={`
              w-12 h-12 flex items-center justify-center rounded-lg transition-all cursor-pointer shrink-0
              ${activeTab === tab && isOpen
                ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-md shadow-accent/20'
                : 'bg-surface-depth-2 text-content-muted hover:bg-surface-depth-1 hover:text-content'
              }
            `}
          >
            <div className="w-5 h-5">
              {tab === 'constructs' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              )}
              {tab === 'ports' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                  <circle cx="12" cy="12" r="1"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>
                  <circle cx="5" cy="5" r="1"/><circle cx="19" cy="5" r="1"/>
                  <circle cx="5" cy="19" r="1"/><circle cx="19" cy="19" r="1"/>
                </svg>
              )}
              {tab === 'groups' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              )}
              {tab === 'deployables' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                  <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Main drawer panel - slides in from right */}
      <div
        className={`
          fixed right-0 top-[48px] bottom-[24px] z-50
          bg-surface-depth-1 border-l border-border flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ width: drawerWidth }}
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-depth-2 transition-colors"
            title="Close drawer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content area */}
        <div className="h-full pt-12 pb-4 px-4 overflow-auto">
          {renderContent()}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}

      <ConfirmationModal
        isOpen={showConfirmModal}
        message="You have unsaved changes. Do you want to discard them and switch to a different tab?"
        onCancel={handleConfirmCancel}
        onDiscard={handleConfirmDiscard}
        onSave={handleConfirmSave}
      />
    </>
  );
}
