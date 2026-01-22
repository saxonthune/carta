import { useState, useRef, type ReactNode } from 'react';
import ConstructEditor from './ConstructEditor';
import DeployablesEditor from './DeployablesEditor';
import InstanceEditor from './InstanceEditor';
import type { Deployable, ConstructNodeData } from '../constructs/types';
import type { Node } from '@xyflow/react';

export type DockView = 'viewer' | 'constructs' | 'deployables';

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
  const [pendingView, setPendingView] = useState<DockView | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const constructsEditorRef = useRef<{ save: () => void } | null>(null);
  const deployablesEditorRef = useRef<{ save: () => void } | null>(null);

  const handleTabClick = (tabId: DockView) => {
    // Check if current tab has unsaved changes
    const currentTabDirty = activeView === 'constructs' ? constructsDirty : activeView === 'deployables' ? deployablesDirty : false;

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
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingView(null);
  };

  const tabs: { id: DockView; label: string; icon: ReactNode }[] = [
    {
      id: 'viewer',
      label: 'Editor',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      id: 'constructs',
      label: 'Constructs',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'deployables',
      label: 'Deployables',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
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
      case 'deployables':
        return <DeployablesEditor ref={deployablesEditorRef} onDeployablesChange={onDeployablesChange} onDirtyChange={setDeployablesDirty} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-surface-depth-3 flex" style={{ height }}>
      {/* Left tabs */}
      <div className="w-14 bg-surface-depth-1 flex flex-col items-center py-2 px-1.5">
        <div className="bg-surface-depth-2 rounded-xl p-1.5 flex flex-col gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                activeView === tab.id
                  ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                  : 'text-content-muted hover:bg-surface-depth-3/50 hover:text-content'
              }`}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-elevated rounded-lg shadow-lg max-w-sm mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-content mb-2">Unsaved Changes</h3>
              <p className="text-content-muted text-sm mb-6">
                You have unsaved changes. Do you want to discard them and switch to a different tab?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 rounded-md text-content bg-surface-depth-3 hover:bg-surface-depth-2 transition-colors text-sm font-medium cursor-pointer"
                  onClick={handleConfirmCancel}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-md text-white bg-danger hover:bg-danger/80 transition-colors text-sm font-medium cursor-pointer"
                  onClick={handleConfirmDiscard}
                >
                  Discard
                </button>
                <button
                  className="px-4 py-2 rounded-md text-white bg-accent hover:bg-accent-hover transition-colors text-sm font-medium cursor-pointer"
                  onClick={handleConfirmSave}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
