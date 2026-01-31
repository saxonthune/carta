/**
 * Storage types for @carta/storage
 */

import type { ServerDocument, DocumentMetadata } from '@carta/domain';

/**
 * Portfolio provider interface for document persistence.
 * Implementations can be file-based, S3, database, or Yjs-backed.
 */
export interface PortfolioProvider {
  /**
   * Load a document by ID
   */
  loadDocument(id: string): Promise<ServerDocument | null>;

  /**
   * Save a document (creates or updates)
   */
  saveDocument(doc: ServerDocument): Promise<void>;

  /**
   * List all documents with metadata
   */
  listDocuments(): Promise<DocumentMetadata[]>;

  /**
   * Delete a document
   */
  deleteDocument(id: string): Promise<boolean>;

  /**
   * Subscribe to document changes (for real-time sync)
   * Returns unsubscribe function
   */
  subscribe?(docId: string, callback: (doc: ServerDocument) => void): () => void;
}

/**
 * Document change event
 */
export interface DocumentChangeEvent {
  type: 'created' | 'updated' | 'deleted';
  documentId: string;
  document?: ServerDocument;
}
