/**
 * File system storage adapter
 * Stores documents as JSON files in a directory
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { validateDocument, CURRENT_FORMAT_VERSION } from '@carta/core';
import type { CartaDocument, DocumentMetadata } from '@carta/core';
import type { StorageAdapter } from './types.js';

export class FileSystemAdapter implements StorageAdapter {
  private dataDir: string;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
  }

  /**
   * Ensure the data directory exists
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  /**
   * Get the file path for a document
   */
  private getFilePath(id: string): string {
    // Sanitize ID to prevent path traversal
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `${safeId}.carta`);
  }

  async loadDocument(id: string): Promise<CartaDocument | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate the document
      const result = validateDocument(data);
      if (!result.valid) {
        console.error(`Invalid document ${id}:`, result.errors);
        return null;
      }

      return data as CartaDocument;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  async saveDocument(doc: CartaDocument): Promise<void> {
    await this.ensureDataDir();

    // Update timestamps
    const now = new Date().toISOString();
    const updatedDoc = {
      ...doc,
      formatVersion: CURRENT_FORMAT_VERSION,
      updatedAt: now,
      createdAt: doc.createdAt || now,
      version: (doc.version || 0) + 1,
    };

    const filePath = this.getFilePath(doc.id);
    const content = JSON.stringify(updatedDoc, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    await this.ensureDataDir();

    try {
      const files = await fs.readdir(this.dataDir);
      const cartaFiles = files.filter((f) => f.endsWith('.carta'));

      const metadata: DocumentMetadata[] = [];

      for (const file of cartaFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const doc = JSON.parse(content);

          metadata.push({
            id: doc.id,
            title: doc.title,
            version: doc.version,
            updatedAt: doc.updatedAt,
            nodeCount: doc.nodes?.length || 0,
          });
        } catch {
          // Skip invalid files
          console.warn(`Skipping invalid document: ${file}`);
        }
      }

      // Sort by updated date, newest first
      metadata.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return metadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false; // File didn't exist
      }
      throw error;
    }
  }
}
