import { describe, it, expect } from 'vitest';

interface DocumentSummary {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
  nodeCount: number;
}

interface FolderView {
  currentPath: string;
  breadcrumbs: string[];
  childFolders: string[];
  documents: DocumentSummary[];
}

/**
 * Derive visible folders and documents at a given path.
 * Folders are virtual - derived from document folder paths.
 */
function deriveFolderView(docs: DocumentSummary[], currentPath: string): FolderView {
  const normalizedPath = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
  const pathPrefix = normalizedPath === '/' ? '/' : normalizedPath + '/';

  const childFolders = new Set<string>();
  const docsAtLevel: DocumentSummary[] = [];

  for (const doc of docs) {
    const docFolder = doc.folder || '/';

    // Document is exactly at this level
    if (docFolder === normalizedPath) {
      docsAtLevel.push(doc);
      continue;
    }

    // Document is under this path - extract immediate child folder
    if (docFolder.startsWith(pathPrefix)) {
      const remainder = docFolder.slice(pathPrefix.length);
      const nextSlash = remainder.indexOf('/');
      const childFolder = nextSlash === -1 ? remainder : remainder.slice(0, nextSlash);
      if (childFolder) {
        childFolders.add(childFolder);
      }
    }
  }

  // Build breadcrumbs from path
  const breadcrumbs = normalizedPath === '/'
    ? []
    : normalizedPath.slice(1).split('/');

  return {
    currentPath: normalizedPath,
    breadcrumbs,
    childFolders: Array.from(childFolders).sort(),
    documents: docsAtLevel.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
  };
}

// Helper to create test documents
function doc(id: string, folder: string, title = `Doc ${id}`): DocumentSummary {
  return {
    id,
    title,
    folder,
    updatedAt: new Date().toISOString(),
    nodeCount: 1,
  };
}

describe('Folder Navigation', () => {
  describe('deriveFolderView', () => {
    it('should show documents at root level', () => {
      const docs = [
        doc('1', '/'),
        doc('2', '/'),
        doc('3', '/projects'),
      ];

      const view = deriveFolderView(docs, '/');

      expect(view.currentPath).toBe('/');
      expect(view.breadcrumbs).toEqual([]);
      expect(view.documents).toHaveLength(2);
      expect(view.documents.map(d => d.id)).toContain('1');
      expect(view.documents.map(d => d.id)).toContain('2');
    });

    it('should show child folders at root', () => {
      const docs = [
        doc('1', '/projects'),
        doc('2', '/projects/webapp'),
        doc('3', '/personal'),
      ];

      const view = deriveFolderView(docs, '/');

      expect(view.childFolders).toEqual(['personal', 'projects']);
      expect(view.documents).toHaveLength(0);
    });

    it('should navigate into a folder and show its contents', () => {
      const docs = [
        doc('1', '/projects'),
        doc('2', '/projects'),
        doc('3', '/projects/webapp'),
      ];

      const view = deriveFolderView(docs, '/projects');

      expect(view.currentPath).toBe('/projects');
      expect(view.breadcrumbs).toEqual(['projects']);
      expect(view.documents).toHaveLength(2);
      expect(view.childFolders).toEqual(['webapp']);
    });

    it('should show nested folders correctly', () => {
      const docs = [
        doc('1', '/projects/webapp/frontend'),
        doc('2', '/projects/webapp/backend'),
        doc('3', '/projects/webapp'),
      ];

      const view = deriveFolderView(docs, '/projects/webapp');

      expect(view.currentPath).toBe('/projects/webapp');
      expect(view.breadcrumbs).toEqual(['projects', 'webapp']);
      expect(view.documents).toHaveLength(1);
      expect(view.documents[0].id).toBe('3');
      expect(view.childFolders).toEqual(['backend', 'frontend']);
    });

    it('should handle deeply nested paths', () => {
      const docs = [
        doc('1', '/a/b/c/d'),
        doc('2', '/a/b/c/e'),
      ];

      const view = deriveFolderView(docs, '/a/b/c');

      expect(view.breadcrumbs).toEqual(['a', 'b', 'c']);
      expect(view.childFolders).toEqual(['d', 'e']);
      expect(view.documents).toHaveLength(0);
    });

    it('should handle path with trailing slash', () => {
      const docs = [
        doc('1', '/projects'),
      ];

      const view = deriveFolderView(docs, '/projects/');

      expect(view.currentPath).toBe('/projects');
      expect(view.documents).toHaveLength(1);
    });

    it('should handle empty documents array', () => {
      const view = deriveFolderView([], '/');

      expect(view.childFolders).toEqual([]);
      expect(view.documents).toEqual([]);
    });

    it('should handle documents with missing folder (defaults to root)', () => {
      const docs = [
        { id: '1', title: 'Test', folder: '', updatedAt: new Date().toISOString(), nodeCount: 1 },
      ];

      const view = deriveFolderView(docs, '/');

      // Empty folder defaults to '/' in deriveFolderView logic
      expect(view.documents).toHaveLength(1);
      expect(view.documents[0].id).toBe('1');
    });

    it('should not show sibling folders', () => {
      const docs = [
        doc('1', '/projects'),
        doc('2', '/personal'),
        doc('3', '/work'),
      ];

      const view = deriveFolderView(docs, '/projects');

      expect(view.childFolders).toEqual([]);
      expect(view.documents).toHaveLength(1);
    });

    it('should sort folders alphabetically', () => {
      const docs = [
        doc('1', '/zebra'),
        doc('2', '/alpha'),
        doc('3', '/middle'),
      ];

      const view = deriveFolderView(docs, '/');

      expect(view.childFolders).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should sort documents by updatedAt descending', () => {
      const docs = [
        { id: '1', title: 'Old', folder: '/', updatedAt: '2024-01-01T00:00:00Z', nodeCount: 1 },
        { id: '2', title: 'New', folder: '/', updatedAt: '2024-12-01T00:00:00Z', nodeCount: 1 },
        { id: '3', title: 'Middle', folder: '/', updatedAt: '2024-06-01T00:00:00Z', nodeCount: 1 },
      ];

      const view = deriveFolderView(docs, '/');

      expect(view.documents.map(d => d.id)).toEqual(['2', '3', '1']);
    });

    it('should deduplicate folders from multiple documents', () => {
      const docs = [
        doc('1', '/projects/webapp'),
        doc('2', '/projects/webapp'),
        doc('3', '/projects/webapp/feature'),
      ];

      const view = deriveFolderView(docs, '/projects');

      expect(view.childFolders).toEqual(['webapp']);
    });

    it('should handle folder that exists only as prefix (no docs directly in it)', () => {
      const docs = [
        doc('1', '/projects/webapp/frontend'),
        doc('2', '/projects/webapp/backend'),
      ];

      // Navigate to /projects - should show webapp folder
      const projectsView = deriveFolderView(docs, '/projects');
      expect(projectsView.childFolders).toEqual(['webapp']);
      expect(projectsView.documents).toHaveLength(0);

      // Navigate to /projects/webapp - should show frontend and backend folders
      const webappView = deriveFolderView(docs, '/projects/webapp');
      expect(webappView.childFolders).toEqual(['backend', 'frontend']);
      expect(webappView.documents).toHaveLength(0);

      // Navigate to /projects/webapp/frontend - should show the document
      const frontendView = deriveFolderView(docs, '/projects/webapp/frontend');
      expect(frontendView.childFolders).toEqual([]);
      expect(frontendView.documents).toHaveLength(1);
      expect(frontendView.documents[0].id).toBe('1');
    });
  });
});
