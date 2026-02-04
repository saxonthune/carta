import { useState } from 'react';
import Modal from '../ui/Modal';
import pkg from '../../../package.json';
import { config } from '../../config/featureFlags';
import { useDocumentContext } from '../../contexts/DocumentContext';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = ['About'] as const;
type Tab = (typeof tabs)[number];

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('About');
  const docCtx = useDocumentContext();

  const nodeCount = docCtx.adapter.getNodes().length;
  const edgeCount = docCtx.adapter.getEdges().length;
  const schemaCount = docCtx.adapter.getSchemas().length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help" maxWidth="480px" blurBackdrop>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 -mt-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-sm border-none cursor-pointer transition-colors rounded-t ${
              activeTab === tab
                ? 'bg-transparent text-content font-medium border-b-2 border-b-accent'
                : 'bg-transparent text-content-muted hover:text-content'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'About' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-sm text-content">&copy; {new Date().getFullYear()} Saxon Thune</div>
            <div className="text-sm text-content-muted">Version {pkg.version}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-content-muted uppercase tracking-wide mb-2">Configuration</div>
            <div className="bg-surface-alt rounded-lg p-3 space-y-1.5 text-xs font-mono">
              <Row label="Server" value={config.serverUrl || 'none (single-document mode)'} />
              <Row label="AI mode" value={config.aiMode} />
              <Row label="Desktop" value={config.isDesktop ? 'yes' : 'no'} />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-content-muted uppercase tracking-wide mb-2">Document</div>
            <div className="bg-surface-alt rounded-lg p-3 space-y-1.5 text-xs font-mono">
              <Row label="Document ID" value={docCtx.documentId} />
              <Row label="Mode" value={docCtx.mode} />
              <Row label="Nodes" value={String(nodeCount)} />
              <Row label="Edges" value={String(edgeCount)} />
              <Row label="Schemas" value={String(schemaCount)} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-content-muted">{label}</span>
      <span className="text-content">{value}</span>
    </div>
  );
}
