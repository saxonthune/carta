/**
 * IndexedDB registry that tracks multiple local Carta documents.
 *
 * Each document's Yjs data lives in its own IndexedDB database (`carta-doc-{id}`).
 * This registry stores lightweight metadata so the document browser can list
 * them without opening every Yjs database.
 */

import type { DocumentSummary } from '@carta/domain';

const DB_NAME = 'carta-registry';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

function openRegistry(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listLocalDocuments(): Promise<DocumentSummary[]> {
  const db = await openRegistry();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const docs = (request.result as DocumentSummary[])
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(docs);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getDocumentMetadata(id: string): Promise<DocumentSummary | null> {
  const db = await openRegistry();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function createDocument(title?: string, filename?: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const metadata: DocumentSummary = {
    id,
    title: title || 'Untitled Project',
    folder: '/',
    createdAt: now,
    updatedAt: now,
    nodeCount: 0,
    ...(filename ? { filename } : {}),
  };

  const db = await openRegistry();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(metadata);
    tx.oncomplete = () => {
      db.close();
      resolve(id);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function updateDocumentMetadata(
  id: string,
  partial: Partial<Pick<DocumentSummary, 'title' | 'nodeCount' | 'updatedAt'>>,
): Promise<void> {
  const db = await openRegistry();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as DocumentSummary | undefined;
      if (!existing) {
        // Auto-create entry if it doesn't exist (e.g. first open of a document)
        const now = new Date().toISOString();
        store.put({
          id,
          title: partial.title || 'Untitled Project',
          folder: '/',
          createdAt: now,
          updatedAt: partial.updatedAt || now,
          nodeCount: partial.nodeCount ?? 0,
        } satisfies DocumentSummary);
      } else {
        store.put({ ...existing, ...partial, updatedAt: partial.updatedAt || new Date().toISOString() });
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteDocument(id: string): Promise<void> {
  // Remove from registry
  const db = await openRegistry();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });

  // Delete the per-document Yjs IndexedDB database
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(`carta-doc-${id}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all local Carta data for a fresh new-user experience.
 * Clears all document databases, the registry, and localStorage.
 */
export async function cleanAllLocalData(): Promise<void> {
  // Get all document IDs from registry first
  const docs = await listLocalDocuments().catch(() => []);

  // Delete each document's IndexedDB database
  for (const doc of docs) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(`carta-doc-${doc.id}`);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Continue even on error
    });
  }

  // Delete the registry database
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });

  // Delete legacy database if it exists
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('carta-local');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });

  // Clear Carta-related localStorage items
  localStorage.removeItem('lastOpenedDocId');
  localStorage.removeItem('theme');
}
