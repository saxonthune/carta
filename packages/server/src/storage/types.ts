/**
 * Storage adapter types
 */

import type { CartaDocument, DocumentMetadata } from '@carta/core';

/**
 * Storage adapter interface
 * Implementations can be file-based, S3, or database
 */
export interface StorageAdapter {
  /**
   * Load a document by ID
   */
  loadDocument(id: string): Promise<CartaDocument | null>;

  /**
   * Save a document (creates or updates)
   */
  saveDocument(doc: CartaDocument): Promise<void>;

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
  subscribe?(docId: string, callback: (doc: CartaDocument) => void): () => void;
}

/**
 * Document change event
 */
export interface DocumentChangeEvent {
  type: 'created' | 'updated' | 'deleted';
  documentId: string;
  document?: CartaDocument;
}
