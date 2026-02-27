import { useState, useEffect } from 'react';
import { config } from '../config/featureFlags';

/** Matches WorkspaceTree from @carta/server workspace-scanner */
interface WorkspaceFileEntry {
  name: string;
  path: string;
  type: 'canvas' | 'resource';
  size: number;
}

interface WorkspaceGroup {
  name: string;
  description?: string;
  dirName: string;
  path: string;
  files: WorkspaceFileEntry[];
}

interface WorkspaceManifest {
  formatVersion: number;
  title: string;
  description?: string;
}

export interface WorkspaceTree {
  manifest: WorkspaceManifest;
  groups: WorkspaceGroup[];
  ungroupedFiles: WorkspaceFileEntry[];
  schemasPath: string | null;
}

export interface WorkspaceMode {
  isWorkspace: boolean;
  loading: boolean;
  workspaceTree: WorkspaceTree | null;
  /** Workspace title from workspace.json manifest */
  title: string | null;
}

export function useWorkspaceMode(): WorkspaceMode {
  const [isWorkspace, setIsWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceTree | null>(null);

  useEffect(() => {
    if (!config.syncUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function detect() {
      try {
        // Step 1: Check health endpoint
        const healthRes = await fetch(`${config.syncUrl}/health`);
        if (!healthRes.ok || cancelled) { setLoading(false); return; }
        const health = await healthRes.json();

        if (!health.workspace) {
          setLoading(false);
          return;
        }

        setIsWorkspace(true);

        // Step 2: Fetch workspace tree
        const treeRes = await fetch(`${config.syncUrl}/api/workspace`);
        if (!treeRes.ok || cancelled) { setLoading(false); return; }
        const tree = await treeRes.json();
        if (!cancelled) setWorkspaceTree(tree);
      } catch {
        // Not a workspace server or network error — fall back to document mode
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    detect();
    return () => { cancelled = true; };
  }, []);

  return {
    isWorkspace,
    loading,
    workspaceTree,
    title: workspaceTree?.manifest.title ?? null,
  };
}
