import { createDocument, getDocumentMetadata } from '../stores/documentRegistry';

/**
 * Migrate the legacy `carta-local` IndexedDB database to the new `carta-doc-{uuid}` format.
 *
 * Returns the new document ID if migration occurred, or null if there was nothing to migrate.
 * Idempotent — checks for the legacy database before acting.
 */
export async function migrateCartaLocal(): Promise<string | null> {
  // Check if `carta-local` database exists
  if (!indexedDB.databases) {
    // Firefox <126 doesn't support indexedDB.databases()
    // Fall back to trying to open it
    return tryMigrate();
  }

  const databases = await indexedDB.databases();
  const legacyDb = databases.find(db => db.name === 'carta-local');
  if (!legacyDb) return null;

  return tryMigrate();
}

async function tryMigrate(): Promise<string | null> {
  return new Promise((resolve) => {
    const openReq = indexedDB.open('carta-local');

    openReq.onsuccess = async () => {
      const sourceDb = openReq.result;
      const storeNames = Array.from(sourceDb.objectStoreNames);

      if (storeNames.length === 0) {
        sourceDb.close();
        resolve(null);
        return;
      }

      try {
        // Create new document entry in registry
        const newId = await createDocument('Migrated Project');

        // Copy all object stores from carta-local to carta-doc-{newId}
        const targetDbName = `carta-doc-${newId}`;

        // Read all data from source
        const allData: Record<string, Array<{ key: IDBValidKey; value: unknown }>> = {};
        for (const storeName of storeNames) {
          allData[storeName] = await readAllFromStore(sourceDb, storeName);
        }
        sourceDb.close();

        // Write to target database (same structure)
        await writeToNewDb(targetDbName, allData);

        // Try to extract title from Yjs meta to update registry
        // (Best-effort — the title will sync on first open anyway)
        const metadata = await getDocumentMetadata(newId);
        if (metadata) {
          // Title will be updated when the document first opens via auto-save
        }

        // Delete old database
        await new Promise<void>((res, rej) => {
          const delReq = indexedDB.deleteDatabase('carta-local');
          delReq.onsuccess = () => res();
          delReq.onerror = () => rej(delReq.error);
        });

        resolve(newId);
      } catch (err) {
        console.error('Migration failed:', err);
        sourceDb.close();
        resolve(null);
      }
    };

    openReq.onerror = () => {
      resolve(null);
    };
  });
}

function readAllFromStore(
  db: IDBDatabase,
  storeName: string,
): Promise<Array<{ key: IDBValidKey; value: unknown }>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const items: Array<{ key: IDBValidKey; value: unknown }> = [];

    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        items.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(items);
    tx.onerror = () => reject(tx.error);
  });
}

function writeToNewDb(
  dbName: string,
  allData: Record<string, Array<{ key: IDBValidKey; value: unknown }>>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const storeNames = Object.keys(allData);
    const openReq = indexedDB.open(dbName, 1);

    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      }
    };

    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction(storeNames, 'readwrite');

      for (const storeName of storeNames) {
        const store = tx.objectStore(storeName);
        for (const { key, value } of allData[storeName]) {
          store.put(value, key);
        }
      }

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };

    openReq.onerror = () => reject(openReq.error);
  });
}
