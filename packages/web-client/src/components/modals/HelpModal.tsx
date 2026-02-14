import { useState } from 'react';
import Modal from '../ui/Modal';
import pkg from '../../../package.json';
import { config } from '../../config/featureFlags';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { readFirstSections, conceptSections, shortcutGroups } from './guides-content';
import { getLastHelpTab, setLastHelpTab } from '../../utils/preferences';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = ['Read First', 'Concepts', 'Shortcuts', 'About'] as const;
type Tab = (typeof tabs)[number];

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(() => (getLastHelpTab() as Tab) || 'Read First');
  const docCtx = useDocumentContext();

  const nodeCount = docCtx.adapter.getNodes().length;
  const edgeCount = docCtx.adapter.getEdges().length;
  const schemaCount = docCtx.adapter.getSchemas().length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help" maxWidth="640px" blurBackdrop>
      <p className="text-xs text-accent italic m-0 -mt-2 mb-3">
        Note: guides are currently AI-generated from internal documentation. Real guides are on the way. Humans deserve to read human-crafted writing.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-sm border-none cursor-pointer transition-colors rounded-t ${
              activeTab === tab
                ? 'bg-transparent text-content font-medium border-b-2 border-b-accent'
                : 'bg-transparent text-content-muted hover:text-content'
            }`}
            onClick={() => {
              setActiveTab(tab);
              setLastHelpTab(tab);
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Read First' && (
        <div className="space-y-4">
          {readFirstSections.map((section, i) => (
            <div key={i}>
              <h4 className="text-sm font-medium text-content m-0 mb-1">
                {i + 1}. {section.title}
              </h4>
              <p className="text-sm text-content-muted m-0 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Concepts' && (
        <div className="space-y-4">
          {conceptSections.map((section, i) => (
            <div key={i}>
              <h4 className="text-sm font-medium text-content m-0 mb-1">{section.title}</h4>
              <p className="text-sm text-content-muted m-0 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Shortcuts' && (
        <div className="space-y-5">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-medium text-content-muted uppercase tracking-wide m-0 mb-2">
                {group.title}
              </h4>
              <div className="space-y-1">
                {group.entries.map((entry, i) => (
                  <div key={i} className="flex justify-between gap-4 text-sm">
                    <span className="text-content-muted font-mono text-xs">{entry.keys}</span>
                    <span className="text-content">{entry.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'About' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-sm text-content">&copy; {new Date().getFullYear()} Saxon Thune</div>
            <div className="text-sm text-content-muted">Version {pkg.version}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-content-muted uppercase tracking-wide mb-2">Configuration</div>
            <div className="bg-surface-alt rounded-lg p-3 space-y-1.5 text-xs font-mono">
              <Row label="Sync server" value={config.syncUrl || 'none (single-document mode)'} />
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
