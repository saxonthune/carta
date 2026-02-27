import type { VaultAdapter, DocumentSummary } from '@carta/schema';

/**
 * Vault adapter for the Electron desktop app.
 * Uses the embedded document server for CRUD and Electron IPC for vault management.
 */
export class DesktopVaultAdapter implements VaultAdapter {
  readonly canChangeVault = true;
  displayAddress: string;
  needsVaultSetup: boolean;
  private syncUrl: string;
  private electronAPI: NonNullable<typeof window.electronAPI>;

  constructor(
    syncUrl: string,
    electronAPI: NonNullable<typeof window.electronAPI>,
  ) {
    this.syncUrl = syncUrl;
    this.electronAPI = electronAPI;
    this.displayAddress = '';
    this.needsVaultSetup = false;
  }

  async init(): Promise<void> {
    const firstRun = await this.electronAPI.isFirstRun();
    if (firstRun) {
      this.needsVaultSetup = true;
      this.displayAddress = '';
      return;
    }
    const vaultPath = await this.electronAPI.getVaultPath();
    this.displayAddress = vaultPath ?? 'Local Vault';
  }

  async listDocuments(): Promise<DocumentSummary[]> {
    if (this.needsVaultSetup) return [];

    const response = await fetch(`${this.syncUrl}/api/documents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch documents: ${response.statusText}`);
    }
    const data = await response.json();
    return (data.documents || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      folder: doc.folder || '/',
      updatedAt: doc.updatedAt,
      nodeCount: doc.nodeCount,
      filename: doc.filename,
    }));
  }

  async createDocument(title: string, folder?: string, filename?: string): Promise<string> {
    if (this.needsVaultSetup) {
      throw new Error('Vault not initialized');
    }

    const response = await fetch(`${this.syncUrl}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, folder: folder || '/', ...(filename ? { filename } : {}) }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create document: ${response.statusText}`);
    }
    const data = await response.json();
    return data.document.id;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const response = await fetch(`${this.syncUrl}/api/documents/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.deleted;
  }

  async initializeVault(vaultPath: string): Promise<{ documentId: string; syncUrl: string; wsUrl: string }> {
    const result = await this.electronAPI.initializeVault(vaultPath);
    this.syncUrl = result.url;
    this.displayAddress = vaultPath;
    this.needsVaultSetup = false;
    return { documentId: result.documentId, syncUrl: result.url, wsUrl: result.wsUrl };
  }

  async changeVault(): Promise<void> {
    const newPath = await this.electronAPI.chooseVaultFolder();
    if (newPath) {
      await this.electronAPI.initializeVault(newPath);
      window.location.reload();
    }
  }
}
