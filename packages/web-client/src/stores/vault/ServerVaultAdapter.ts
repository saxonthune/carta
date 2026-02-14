import type { VaultAdapter, DocumentSummary } from '@carta/domain';

/**
 * Vault adapter for server-hosted documents.
 * Delegates to the Carta document server REST API.
 */
export class ServerVaultAdapter implements VaultAdapter {
  readonly displayAddress: string;
  readonly canChangeVault = false;
  private syncUrl: string;

  constructor(syncUrl: string) {
    this.syncUrl = syncUrl;
    this.displayAddress = syncUrl;
  }

  async listDocuments(): Promise<DocumentSummary[]> {
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
    }));
  }

  async createDocument(title: string, folder?: string): Promise<string> {
    const response = await fetch(`${this.syncUrl}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, folder: folder || '/' }),
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
}
