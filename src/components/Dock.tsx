import { useState, useRef } from 'react';
import ConstructEditor from './ConstructEditor';
import DeployablesEditor from './DeployablesEditor';
import PortSchemaEditor from './PortSchemaEditor';
import SchemaGroupEditor from './SchemaGroupEditor';
import InstanceEditor from './InstanceEditor';
import ConfirmationModal from './ui/ConfirmationModal';
import TabBar, { type Tab } from './ui/TabBar';
import type { Deployable, ConstructNodeData } from '../constructs/types';
import type { Node } from '@xyflow/react';

export type DockView = 'viewer' | 'constructs' | 'groups' | 'deployables' | 'ports';

interface DockProps {
  selectedNodes: Node[];
  deployables: Deployable[];
  onDeployablesChange: () => void;
  onNodeUpdate: (nodeId: string, updates: Partial<ConstructNodeData>) => void;
  height?: number;
  activeView: DockView;
  onActiveViewChange: (view: DockView) => void;
}

export default function Dock({ selectedNodes, deployables, onDeployablesChange, onNodeUpdate, height = 256, activeView, onActiveViewChange }: DockProps) {
  const [constructsDirty, setConstructsDirty] = useState(false);
  const [deployablesDirty, setDeployablesDirty] = useState(false);
  const [portsDirty, setPortsDirty] = useState(false);
  const [groupsDirty, setGroupsDirty] = useState(false);
  const [pendingView, setPendingView] = useState<DockView | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const constructsEditorRef = useRef<{ save: () => void } | null>(null);
  const deployablesEditorRef = useRef<{ save: () => void } | null>(null);
  const portsEditorRef = useRef<{ save: () => void } | null>(null);
  const groupsEditorRef = useRef<{ save: () => void } | null>(null);

  const handleTabClick = (tabId: DockView) => {
    // Check if current tab has unsaved changes
    const currentTabDirty =
      activeView === 'constructs' ? constructsDirty :
      activeView === 'deployables' ? deployablesDirty :
      activeView === 'ports' ? portsDirty :
      activeView === 'groups' ? groupsDirty :
      false;

    if (currentTabDirty && tabId !== activeView) {
      setPendingView(tabId);
      setShowConfirmModal(true);
      return;
    }
    onActiveViewChange(tabId);
  };

  const handleConfirmSave = () => {
    // Trigger save in the current editor
    if (activeView === 'constructs') {
      constructsEditorRef.current?.save();
    } else if (activeView === 'deployables') {
      deployablesEditorRef.current?.save();
    } else if (activeView === 'ports') {
      portsEditorRef.current?.save();
    } else if (activeView === 'groups') {
      groupsEditorRef.current?.save();
    }
    setShowConfirmModal(false);
    // After save, proceed to pending view
    setTimeout(() => {
      if (pendingView) {
        onActiveViewChange(pendingView);
      }
      setPendingView(null);
    }, 0);
  };

  const handleConfirmDiscard = () => {
    if (pendingView) {
      onActiveViewChange(pendingView);
    }
    setShowConfirmModal(false);
    setPendingView(null);
    // Reset dirty states
    if (activeView === 'constructs') setConstructsDirty(false);
    if (activeView === 'deployables') setDeployablesDirty(false);
    if (activeView === 'ports') setPortsDirty(false);
    if (activeView === 'groups') setGroupsDirty(false);
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingView(null);
  };

  const tabs: Tab<DockView>[] = [
    {
      id: 'viewer',
      label: 'Editor',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      id: 'constructs',
      label: 'Constructs',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'groups',
      label: 'Groups',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
    {
      id: 'ports',
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
      id: 'deployables',
      label: 'Deployables',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
          <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'viewer':
        if (selectedNodes.length === 0) {
          return (
            <div className="p-4 text-content-muted">
              <p>Select a construct on the map to view its details.</p>
            </div>
          );
        }
        if (selectedNodes.length === 1) {
          return (
            <InstanceEditor
              node={selectedNodes[0]}
              deployables={deployables}
              onNodeUpdate={onNodeUpdate}
            />
          );
        }
        return (
          <div className="p-4 text-content-muted">
            <p>{selectedNodes.length} constructs selected</p>
          </div>
        );
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

  return (
    <div className="bg-surface-depth-3 flex" style={{ height }}>
      <TabBar
        tabs={tabs}
        activeTab={activeView}
        onTabChange={handleTabClick}
        variant={sidebarCollapsed ? 'icon-only' : 'icon-label'}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        message="You have unsaved changes. Do you want to discard them and switch to a different tab?"
        onCancel={handleConfirmCancel}
        onDiscard={handleConfirmDiscard}
        onSave={handleConfirmSave}
      />
    </div>
  );
}
