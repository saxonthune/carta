/**
 * File operations for extracting CartaFile from Y.Doc and hydrating Y.Doc from CartaFile.
 *
 * Used by desktop persistence to save/load human-readable JSON files.
 */

import * as Y from 'yjs';
import type { ConstructSchema, PortSchema, SchemaGroup, SchemaPackage, PackageManifestEntry, Resource } from '@carta/schema';
import { yToPlain, deepPlainToY } from './yjs-helpers.js';
import { CARTA_FILE_VERSION } from './constants.js';
import type { CartaFile, CartaFilePage } from './file-format.js';

/**
 * Extract a CartaFile from a Y.Doc for saving.
 */
export function extractCartaFile(doc: Y.Doc): CartaFile {
  const ymeta = doc.getMap('meta');
  const ypages = doc.getMap<Y.Map<unknown>>('pages');
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes');
  const yedges = doc.getMap<Y.Map<unknown>>('edges');
  const yschemas = doc.getMap<Y.Map<unknown>>('schemas');
  const yportSchemas = doc.getMap<Y.Map<unknown>>('portSchemas');
  const yschemaGroups = doc.getMap<Y.Map<unknown>>('schemaGroups');
  const yschemaPackages = doc.getMap<Y.Map<unknown>>('schemaPackages');
  const ypackageManifest = doc.getMap<Y.Map<unknown>>('packageManifest');

  const title = (ymeta.get('title') as string) || 'Untitled Project';
  const description = ymeta.get('description') as string | undefined;

  // Extract levels with their data
  const pages: CartaFilePage[] = [];
  ypages.forEach((ypage, pageId) => {
    const pageData = yToPlain(ypage) as { id: string; name: string; description?: string; order: number };

    // Get nodes for this page
    const pageNodes = ynodes.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
    const nodes: unknown[] = [];
    if (pageNodes) {
      pageNodes.forEach((ynode, nodeId) => {
        const nodeData = yToPlain(ynode) as Record<string, unknown>;
        nodes.push({ id: nodeId, ...nodeData });
      });
    }

    // Get edges for this page
    const pageEdges = yedges.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
    const edges: unknown[] = [];
    if (pageEdges) {
      pageEdges.forEach((yedge, edgeId) => {
        const edgeData = yToPlain(yedge) as Record<string, unknown>;
        edges.push({ id: edgeId, ...edgeData });
      });
    }

    pages.push({
      id: pageData.id,
      name: pageData.name,
      description: pageData.description,
      order: pageData.order,
      nodes,
      edges,
    });
  });

  // Sort levels by order
  pages.sort((a, b) => a.order - b.order);

  // Extract all schemas (including package schemas — file must be self-contained)
  const customSchemas: ConstructSchema[] = [];
  yschemas.forEach((yschema) => {
    customSchemas.push(yToPlain(yschema) as ConstructSchema);
  });

  // Extract all port schemas
  const portSchemas: PortSchema[] = [];
  yportSchemas.forEach((yps) => {
    portSchemas.push(yToPlain(yps) as PortSchema);
  });

  // Extract schema groups
  const schemaGroups: SchemaGroup[] = [];
  yschemaGroups.forEach((ysg) => {
    schemaGroups.push(yToPlain(ysg) as SchemaGroup);
  });

  // Extract schema packages
  const schemaPackages: SchemaPackage[] = [];
  yschemaPackages.forEach((ysp) => {
    schemaPackages.push(yToPlain(ysp) as SchemaPackage);
  });

  // Extract package manifest
  const packageManifest: PackageManifestEntry[] = [];
  ypackageManifest.forEach((ypm) => {
    packageManifest.push(yToPlain(ypm) as PackageManifestEntry);
  });

  // Extract resources
  const yresources = doc.getMap<Y.Map<unknown>>('resources');
  const resources: Resource[] = [];
  yresources.forEach((yresource) => {
    resources.push(yToPlain(yresource) as Resource);
  });

  return {
    version: CARTA_FILE_VERSION,
    title,
    description,
    pages,
    customSchemas,
    portSchemas,
    schemaGroups,
    schemaPackages,
    packageManifest: packageManifest.length > 0 ? packageManifest : undefined,
    resources: resources.length > 0 ? resources : undefined,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Hydrate a Y.Doc from a CartaFile.
 *
 * Clears existing data and populates from the CartaFile.
 */
export function hydrateYDocFromCartaFile(doc: Y.Doc, data: CartaFile): void {
  const ymeta = doc.getMap('meta');
  const ypages = doc.getMap<Y.Map<unknown>>('pages');
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes');
  const yedges = doc.getMap<Y.Map<unknown>>('edges');
  const yschemas = doc.getMap<Y.Map<unknown>>('schemas');
  const yportSchemas = doc.getMap<Y.Map<unknown>>('portSchemas');
  const yschemaGroups = doc.getMap<Y.Map<unknown>>('schemaGroups');
  const yschemaPackages = doc.getMap<Y.Map<unknown>>('schemaPackages');
  const ypackageManifest = doc.getMap<Y.Map<unknown>>('packageManifest');
  const yresources = doc.getMap<Y.Map<unknown>>('resources');

  doc.transact(() => {
    // Clear existing data
    ymeta.clear();
    ypages.clear();
    ynodes.clear();
    yedges.clear();
    yschemas.clear();
    yportSchemas.clear();
    yschemaGroups.clear();
    yschemaPackages.clear();
    ypackageManifest.clear();
    yresources.clear();

    // Set metadata
    ymeta.set('title', data.title);
    if (data.description) {
      ymeta.set('description', data.description);
    }
    ymeta.set('version', data.version);

    // Hydrate levels
    let firstPageId: string | null = null;

    for (const page of data.pages) {
      if (!firstPageId) firstPageId = page.id;

      // Create page metadata
      const pageMap = new Y.Map<unknown>();
      pageMap.set('id', page.id);
      pageMap.set('name', page.name);
      if (page.description) pageMap.set('description', page.description);
      pageMap.set('order', page.order);
      ypages.set(page.id, pageMap);

      // Create nodes map for this page
      const pageNodesMap = new Y.Map<Y.Map<unknown>>();
      for (const node of page.nodes) {
        const nodeObj = node as Record<string, unknown>;
        const nodeId = nodeObj.id as string;
        const ynode = deepPlainToY({
          type: nodeObj.type,
          position: nodeObj.position,
          data: nodeObj.data,
          ...(nodeObj.width ? { width: nodeObj.width } : {}),
          ...(nodeObj.height ? { height: nodeObj.height } : {}),
          ...(nodeObj.style ? { style: nodeObj.style } : {}),
          ...(nodeObj.parentId ? { parentId: nodeObj.parentId } : {}),
        }) as Y.Map<unknown>;
        pageNodesMap.set(nodeId, ynode);
      }
      ynodes.set(page.id, pageNodesMap as unknown as Y.Map<unknown>);

      // Create edges map for this page
      const pageEdgesMap = new Y.Map<Y.Map<unknown>>();
      for (const edge of page.edges) {
        const edgeObj = edge as Record<string, unknown>;
        const edgeId = edgeObj.id as string;
        const yedge = deepPlainToY({
          source: edgeObj.source,
          target: edgeObj.target,
          sourceHandle: edgeObj.sourceHandle,
          targetHandle: edgeObj.targetHandle,
        }) as Y.Map<unknown>;
        pageEdgesMap.set(edgeId, yedge);
      }
      yedges.set(page.id, pageEdgesMap as unknown as Y.Map<unknown>);
    }

    // Set active page to first page
    if (firstPageId) {
      ymeta.set('activePage', firstPageId);
    }

    // Set custom schemas
    for (const schema of data.customSchemas) {
      const ys = deepPlainToY(schema) as Y.Map<unknown>;
      yschemas.set(schema.type, ys);
    }

    // Set port schemas
    for (const ps of data.portSchemas) {
      const yps = deepPlainToY(ps) as Y.Map<unknown>;
      yportSchemas.set(ps.id, yps);
    }

    // Set schema groups
    for (const sg of data.schemaGroups) {
      const ysg = deepPlainToY(sg) as Y.Map<unknown>;
      yschemaGroups.set(sg.id, ysg);
    }

    // Set schema packages
    for (const sp of data.schemaPackages) {
      const ysp = deepPlainToY(sp) as Y.Map<unknown>;
      yschemaPackages.set(sp.id, ysp);
    }

    // Set package manifest
    if (data.packageManifest) {
      for (const pm of data.packageManifest) {
        const ypm = deepPlainToY(pm) as Y.Map<unknown>;
        ypackageManifest.set(pm.packageId, ypm);
      }
    }

    // Set resources — build Y.Maps manually so versions is a Y.Array of Y.Maps
    if (data.resources) {
      for (const resource of data.resources) {
        const yresource = new Y.Map<unknown>();
        yresource.set('id', resource.id);
        yresource.set('name', resource.name);
        yresource.set('format', resource.format);
        yresource.set('body', resource.body);
        yresource.set('currentHash', resource.currentHash);

        const yversions = new Y.Array<Y.Map<unknown>>();
        for (const version of resource.versions) {
          const yversion = new Y.Map<unknown>();
          yversion.set('versionId', version.versionId);
          yversion.set('contentHash', version.contentHash);
          yversion.set('publishedAt', version.publishedAt);
          if (version.label) yversion.set('label', version.label);
          yversion.set('body', version.body);
          yversions.push([yversion]);
        }
        yresource.set('versions', yversions);

        yresources.set(resource.id, yresource);
      }
    }
  });
}
