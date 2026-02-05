import type { VaultAdapter, DocumentSummary } from '@carta/domain';
import { listLocalDocuments, createDocument, deleteDocument } from '../documentRegistry';

/**
 * Vault adapter for local browser storage (IndexedDB).
 * Wraps the existing documentRegistry functions.
 */
export class LocalVaultAdapter implements VaultAdapter {
  readonly displayAddress = 'Browser Storage';
  readonly canChangeVault = false;

  async listDocuments(): Promise<DocumentSummary[]> {
    return listLocalDocuments();
  }

  async createDocument(title: string): Promise<string> {
    return createDocument(title);
  }

  async deleteDocument(id: string): Promise<boolean> {
    await deleteDocument(id);
    return true;
  }
}
