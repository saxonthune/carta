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

  describe('Created Folders Persistence', () => {
    /**
     * Merge manually created folders with derived folders.
     * Created folders are stored as full paths (e.g., '/projects/new-folder').
     * This function extracts the immediate child folder name for any created
     * folder path that is at or below the current path.
     */
    function mergeCreatedFolders(
      derivedFolders: string[],
      createdFolders: string[],
      currentPath: string
    ): string[] {
      const normalizedPath = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
      const pathPrefix = normalizedPath === '/' ? '/' : normalizedPath + '/';

      const createdChildren = new Set<string>();

      for (const folderPath of createdFolders) {
        // Check if this created folder is at or below current path
        if (!folderPath.startsWith(pathPrefix)) continue;

        const remainder = folderPath.slice(pathPrefix.length);
        if (remainder.length === 0) continue;

        // Extract the immediate child folder name
        const slashIndex = remainder.indexOf('/');
        const childName = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
        if (childName) {
          createdChildren.add(childName);
        }
      }

      // Merge and deduplicate
      const merged = new Set([...derivedFolders, ...createdChildren]);
      return Array.from(merged).sort();
    }

    it('should show created folder after navigating back up', () => {
      const docs: DocumentSummary[] = [];
      const createdFolders = ['/new-folder'];

      const view = deriveFolderView(docs, '/');
      const mergedFolders = mergeCreatedFolders(view.childFolders, createdFolders, '/');

      expect(mergedFolders).toContain('new-folder');
    });

    it('should show created folder at nested level', () => {
      const docs = [doc('1', '/projects')];
      const createdFolders = ['/projects/new-subfolder'];

      const view = deriveFolderView(docs, '/projects');
      const mergedFolders = mergeCreatedFolders(view.childFolders, createdFolders, '/projects');

      expect(mergedFolders).toContain('new-subfolder');
    });

    it('should not show created folder at wrong level', () => {
      const docs: DocumentSummary[] = [];
      const createdFolders = ['/projects/deep/folder'];

      // At root, should not show 'deep' or 'folder'
      const rootView = deriveFolderView(docs, '/');
      const rootMerged = mergeCreatedFolders(rootView.childFolders, createdFolders, '/');
      expect(rootMerged).not.toContain('deep');
      expect(rootMerged).not.toContain('folder');
      // Should show 'projects' as the direct child
      expect(rootMerged).toContain('projects');
    });

    it('should deduplicate created folders with derived folders', () => {
      const docs = [doc('1', '/existing-folder')];
      const createdFolders = ['/existing-folder', '/new-folder'];

      const view = deriveFolderView(docs, '/');
      const mergedFolders = mergeCreatedFolders(view.childFolders, createdFolders, '/');

      // Should have both but no duplicates
      expect(mergedFolders).toEqual(['existing-folder', 'new-folder']);
    });

    it('should maintain alphabetical sort after merge', () => {
      const docs = [doc('1', '/middle')];
      const createdFolders = ['/alpha', '/zebra'];

      const view = deriveFolderView(docs, '/');
      const mergedFolders = mergeCreatedFolders(view.childFolders, createdFolders, '/');

      expect(mergedFolders).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should show multiple created folders at same level', () => {
      const docs: DocumentSummary[] = [];
      const createdFolders = ['/folder-a', '/folder-b', '/folder-c'];

      const view = deriveFolderView(docs, '/');
      const mergedFolders = mergeCreatedFolders(view.childFolders, createdFolders, '/');

      expect(mergedFolders).toEqual(['folder-a', 'folder-b', 'folder-c']);
    });

    it('should handle created folders with empty docs array', () => {
      const docs: DocumentSummary[] = [];
      const createdFolders = ['/new-folder'];

      const view = deriveFolderView(docs, '/');
      const mergedFolders = mergeCreatedFolders(view.childFolders, createdFolders, '/');

      expect(mergedFolders).toEqual(['new-folder']);
    });

    it('should show ancestor folders of deeply nested created folder', () => {
      const docs: DocumentSummary[] = [];
      const createdFolders = ['/a/b/c/d'];

      // At root, should show 'a'
      const rootView = deriveFolderView(docs, '/');
      const rootMerged = mergeCreatedFolders(rootView.childFolders, createdFolders, '/');
      expect(rootMerged).toEqual(['a']);

      // At /a, should show 'b'
      const aView = deriveFolderView(docs, '/a');
      const aMerged = mergeCreatedFolders(aView.childFolders, createdFolders, '/a');
      expect(aMerged).toEqual(['b']);

      // At /a/b, should show 'c'
      const bView = deriveFolderView(docs, '/a/b');
      const bMerged = mergeCreatedFolders(bView.childFolders, createdFolders, '/a/b');
      expect(bMerged).toEqual(['c']);

      // At /a/b/c, should show 'd'
      const cView = deriveFolderView(docs, '/a/b/c');
      const cMerged = mergeCreatedFolders(cView.childFolders, createdFolders, '/a/b/c');
      expect(cMerged).toEqual(['d']);
    });
  });
});
