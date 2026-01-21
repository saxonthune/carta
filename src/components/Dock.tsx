import { useState, type ReactNode } from 'react';
import ConstructEditor from './ConstructEditor';
import DeployablesEditor from './DeployablesEditor';
import InstanceViewer from './InstanceViewer';
import type { Deployable, ConstructNodeData } from '../constructs/types';
import type { Node } from '@xyflow/react';

export type DockView = 'viewer' | 'constructs' | 'deployables';

interface DockProps {
  selectedNodes: Node[];
  deployables: Deployable[];
  onDeployablesChange: () => void;
  onNodeUpdate: (nodeId: string, updates: Partial<ConstructNodeData>) => void;
  height?: number;
}

export default function Dock({ selectedNodes, deployables, onDeployablesChange, onNodeUpdate, height = 256 }: DockProps) {
  const [activeView, setActiveView] = useState<DockView>('viewer');

  const tabs: { id: DockView; label: string; icon: ReactNode }[] = [
    {
      id: 'viewer',
      label: 'Viewer',
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
            <InstanceViewer
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
        return <ConstructEditor />;
      case 'deployables':
        return <DeployablesEditor onDeployablesChange={onDeployablesChange} />;
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
              onClick={() => setActiveView(tab.id)}
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
    </div>
  );
}
