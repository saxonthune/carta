import { useState, useEffect } from 'react';
import { config } from '../config/featureFlags';
import type { WorkspaceCanvasSchemas } from '../stores/adapters/yjsAdapter';

/** Matches WorkspaceTree from @carta/server workspace-scanner */
interface WorkspaceFileEntry {
  name: string;
  path: string;
  type: 'canvas' | 'file';
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

export type { WorkspaceCanvasSchemas };

export interface WorkspaceMode {
  isWorkspace: boolean;
  loading: boolean;
  workspaceTree: WorkspaceTree | null;
  /** Workspace title from workspace.json manifest */
  title: string | null;
  /** Schemas fetched from /api/workspace/schemas, available for workspace canvas adapters */
  schemas: WorkspaceCanvasSchemas | null;
}

export function useWorkspaceMode(): WorkspaceMode {
  const [isWorkspace, setIsWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceTree | null>(null);
  const [schemas, setSchemas] = useState<WorkspaceCanvasSchemas | null>(null);

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

        // Step 2: Fetch workspace tree and schemas in parallel
        const [treeRes, schemasRes] = await Promise.all([
          fetch(`${config.syncUrl}/api/workspace`),
          fetch(`${config.syncUrl}/api/workspace/schemas`),
        ]);

        if (cancelled) { setLoading(false); return; }

        if (treeRes.ok) {
          const tree = await treeRes.json();
          if (!cancelled) setWorkspaceTree(tree);
        }

        if (schemasRes.ok) {
          const schemasData = await schemasRes.json();
          if (!cancelled) setSchemas(schemasData);
        }
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
    schemas,
  };
}
