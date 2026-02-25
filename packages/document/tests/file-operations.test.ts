import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createResource, publishResourceVersion } from '../src/doc-operations';
import { extractCartaFile, hydrateYDocFromCartaFile } from '../src/file-operations';
import { validateCartaFile } from '../src/file-format';
import { CARTA_FILE_VERSION } from '../src/constants';
import type { CartaFile } from '../src/file-format';
import type { Resource } from '@carta/domain';

describe('resource file format', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  it('extractCartaFile includes resources from Y.Doc', () => {
    createResource(doc, 'My API', 'openapi', 'openapi: 3.0.0');

    const file = extractCartaFile(doc);
    expect(file.resources).toBeDefined();
    expect(file.resources!.length).toBe(1);
    expect(file.resources![0]!.name).toBe('My API');
    expect(file.resources![0]!.format).toBe('openapi');
    expect(file.resources![0]!.body).toBe('openapi: 3.0.0');
  });

  it('extractCartaFile returns undefined resources when none exist', () => {
    const file = extractCartaFile(doc);
    expect(file.resources).toBeUndefined();
  });

  it('hydrateYDocFromCartaFile writes resources into Y.Doc', () => {
    const resource: Resource = {
      id: 'test-id-1',
      name: 'Schema Resource',
      format: 'json-schema',
      body: '{"type":"object"}',
      currentHash: 'abc123',
      versions: [],
    };

    const cartaFile: CartaFile = {
      version: CARTA_FILE_VERSION,
      title: 'Test Project',
      pages: [{
        id: 'page-1',
        name: 'Main',
        order: 0,
        nodes: [],
        edges: [],
      }],
      customSchemas: [],
      portSchemas: [],
      schemaGroups: [],
      schemaPackages: [],
      resources: [resource],
      exportedAt: new Date().toISOString(),
    };

    const freshDoc = new Y.Doc();
    hydrateYDocFromCartaFile(freshDoc, cartaFile);

    const yresources = freshDoc.getMap('resources');
    expect(yresources.size).toBe(1);
    const yresource = yresources.get('test-id-1') as Y.Map<unknown>;
    expect(yresource).toBeDefined();
    expect(yresource.get('name')).toBe('Schema Resource');
    expect(yresource.get('format')).toBe('json-schema');
    expect(yresource.get('body')).toBe('{"type":"object"}');
  });

  it('round-trip preserves resources', () => {
    createResource(doc, 'Round-trip', 'yaml', 'key: value');

    const file = extractCartaFile(doc);
    expect(file.resources!.length).toBe(1);

    const freshDoc = new Y.Doc();
    hydrateYDocFromCartaFile(freshDoc, file);

    const extracted = extractCartaFile(freshDoc);
    expect(extracted.resources!.length).toBe(1);
    expect(extracted.resources![0]!.name).toBe('Round-trip');
    expect(extracted.resources![0]!.format).toBe('yaml');
    expect(extracted.resources![0]!.body).toBe('key: value');
  });

  it('importing file without resources key works (backward compatibility)', () => {
    const fileWithoutResources = {
      version: CARTA_FILE_VERSION,
      title: 'Old File',
      pages: [{
        id: 'page-1',
        name: 'Main',
        order: 0,
        nodes: [],
        edges: [],
      }],
      customSchemas: [],
      portSchemas: [],
      schemaGroups: [],
      schemaPackages: [],
      exportedAt: new Date().toISOString(),
    };

    // Should not throw
    const validated = validateCartaFile(fileWithoutResources);
    expect(validated.resources).toEqual([]);

    // Should hydrate cleanly
    const freshDoc = new Y.Doc();
    hydrateYDocFromCartaFile(freshDoc, validated);
    const yresources = freshDoc.getMap('resources');
    expect(yresources.size).toBe(0);
  });

  it('version history survives round-trip', () => {
    const resource = createResource(doc, 'Versioned', 'openapi', 'v1 content');
    publishResourceVersion(doc, resource.id, 'v1.0');

    const file = extractCartaFile(doc);
    expect(file.resources!.length).toBe(1);
    expect(file.resources![0]!.versions.length).toBe(1);
    expect(file.resources![0]!.versions[0]!.label).toBe('v1.0');

    const freshDoc = new Y.Doc();
    hydrateYDocFromCartaFile(freshDoc, file);

    const extracted = extractCartaFile(freshDoc);
    expect(extracted.resources![0]!.versions.length).toBe(1);
    expect(extracted.resources![0]!.versions[0]!.label).toBe('v1.0');
    expect(extracted.resources![0]!.versions[0]!.body).toBe('v1 content');
  });
});
