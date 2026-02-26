import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { DocumentTestProvider } from '../setup/testProviders';
import type { ConstructSchema, PortSchema, SchemaGroup, SchemaPackage } from '@carta/schema';

// Get a ready adapter via the DocumentContext hook
async function getAdapter() {
  const { result } = renderHook(() => useDocumentContext(), { wrapper: DocumentTestProvider });
  await waitFor(() => {
    expect(result.current.isReady).toBe(true);
  });
  return result.current.adapter;
}

describe('Schema CRUD', () => {
  it('addSchema → getSchema returns equivalent schema', async () => {
    const adapter = await getAdapter();
    const schema: ConstructSchema = {
      type: 'TestService',
      displayName: 'Test Service',
      color: '#ff0000',
      semanticDescription: 'A test service',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    };
    adapter.addSchema(schema);
    const retrieved = adapter.getSchema('TestService');
    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe('TestService');
    expect(retrieved!.displayName).toBe('Test Service');
    expect(retrieved!.semanticDescription).toBe('A test service');
  });

  it('addSchema → getSchemas includes it', async () => {
    const adapter = await getAdapter();
    const schema: ConstructSchema = {
      type: 'AnotherService',
      displayName: 'Another Service',
      color: '#00ff00',
      semanticDescription: 'Another test service',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    };
    adapter.addSchema(schema);
    const all = adapter.getSchemas();
    expect(all.some(s => s.type === schema.type)).toBe(true);
  });

  it('removeSchema → getSchema returns undefined', async () => {
    const adapter = await getAdapter();
    const schema: ConstructSchema = {
      type: 'ToRemoveService',
      displayName: 'To Remove Service',
      color: '#0000ff',
      semanticDescription: 'Service to be removed',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    };
    adapter.addSchema(schema);
    adapter.removeSchema('ToRemoveService');
    expect(adapter.getSchema('ToRemoveService')).toBeUndefined();
  });
});

describe('PortSchema CRUD', () => {
  it('addPortSchema → getPortSchema returns equivalent', async () => {
    const adapter = await getAdapter();
    const ps: PortSchema = {
      id: 'test-port',
      displayName: 'Test Port',
      semanticDescription: 'A test port',
      polarity: 'source',
      compatibleWith: ['test-sink'],
      color: '#ff0000',
    };
    adapter.addPortSchema(ps);
    const retrieved = adapter.getPortSchema('test-port');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('test-port');
    expect(retrieved!.polarity).toBe('source');
  });

  it('addPortSchema → getPortSchemas includes it', async () => {
    const adapter = await getAdapter();
    const ps: PortSchema = {
      id: 'another-test-port',
      displayName: 'Another Test Port',
      semanticDescription: 'Another test port',
      polarity: 'sink',
      compatibleWith: ['test-source'],
      color: '#00ff00',
    };
    adapter.addPortSchema(ps);
    const all = adapter.getPortSchemas();
    expect(all.some(p => p.id === ps.id)).toBe(true);
  });
});

describe('SchemaGroup CRUD', () => {
  it('addSchemaGroup → getSchemaGroup returns equivalent', async () => {
    const adapter = await getAdapter();
    const group = adapter.addSchemaGroup({ name: 'Test Group', color: '#ff0000' });
    const retrieved = adapter.getSchemaGroup(group.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Test Group');
    expect(retrieved!.color).toBe('#ff0000');
  });

  it('removeSchemaGroup → getSchemaGroup returns undefined', async () => {
    const adapter = await getAdapter();
    const group = adapter.addSchemaGroup({ name: 'To Delete', color: '#00ff00' });
    adapter.removeSchemaGroup(group.id);
    expect(adapter.getSchemaGroup(group.id)).toBeUndefined();
  });
});

describe('SchemaPackage CRUD', () => {
  it('addSchemaPackage → getSchemaPackage returns equivalent', async () => {
    const adapter = await getAdapter();
    const pkg = adapter.addSchemaPackage({
      name: 'Test Package',
      color: '#ff0000',
    });
    const retrieved = adapter.getSchemaPackage(pkg.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Test Package');
  });

  it('removeSchemaPackage → getSchemaPackage returns undefined', async () => {
    const adapter = await getAdapter();
    const pkg = adapter.addSchemaPackage({
      name: 'To Delete Package',
      color: '#00ff00',
    });
    adapter.removeSchemaPackage(pkg.id);
    expect(adapter.getSchemaPackage(pkg.id)).toBeUndefined();
  });
});

describe('Page CRUD', () => {
  it('createPage → getPages includes the new page', async () => {
    const adapter = await getAdapter();
    const page = adapter.createPage('Test Page');
    const pages = adapter.getPages();
    expect(pages.some(p => p.id === page.id)).toBe(true);
    expect(pages.find(p => p.id === page.id)!.name).toBe('Test Page');
  });

  it('deletePage → getPages does not include it', async () => {
    const adapter = await getAdapter();
    const page = adapter.createPage('To Delete');
    adapter.deletePage(page.id);
    const pages = adapter.getPages();
    expect(pages.some(p => p.id === page.id)).toBe(false);
  });
});

describe('Document Metadata', () => {
  it('setTitle → getTitle returns same value', async () => {
    const adapter = await getAdapter();
    adapter.setTitle('My Architecture');
    expect(adapter.getTitle()).toBe('My Architecture');
  });

  it('setDescription → getDescription returns same value', async () => {
    const adapter = await getAdapter();
    adapter.setDescription('A system design');
    expect(adapter.getDescription()).toBe('A system design');
  });
});

describe('toJSON', () => {
  it('toJSON includes all added schemas, pages, and metadata', async () => {
    const adapter = await getAdapter();
    adapter.setTitle('Export Test');
    adapter.addSchema({
      type: 'ExportService',
      displayName: 'Export Service',
      color: '#ff0000',
      semanticDescription: '',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    });
    adapter.createPage('Export Page');

    const json = adapter.toJSON();
    expect(json.title).toBe('Export Test');
    expect(json.schemas.some(s => s.type === 'ExportService')).toBe(true);
    // Pages are in the pages array
    expect(json.pages.some((p: any) => p.name === 'Export Page')).toBe(true);
  });
});
