import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { executeTool } from '../src/tools/index.js';
import { createPage } from '../src/doc-operations.js';

describe('standard library tools', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('list_standard_packages returns a non-empty array', () => {
    const result = executeTool('list_standard_packages', {}, doc, pageId);
    expect(result.success).toBe(true);
    const packages = (result.data as any).packages;
    expect(Array.isArray(packages)).toBe(true);
    expect(packages.length).toBeGreaterThan(0);
  });

  it('list_standard_packages includes software-architecture package', () => {
    const result = executeTool('list_standard_packages', {}, doc, pageId);
    const packages = (result.data as any).packages;
    const pkg = packages.find((p: any) => p.id === 'std-pkg-software-architecture');
    expect(pkg).toBeDefined();
    expect(pkg.status).toBe('available');
  });

  it('apply_standard_package adds schemas to document', () => {
    const applyResult = executeTool(
      'apply_standard_package',
      { packageId: 'std-pkg-software-architecture' },
      doc,
      pageId
    );
    expect(applyResult.success).toBe(true);
    expect((applyResult.data as any).status).toBe('applied');

    const listResult = executeTool('list_schemas', {}, doc, pageId);
    const schemas = (listResult.data as any).schemas;
    const pkgSchemas = schemas.filter((s: any) => s.packageId === 'std-pkg-software-architecture');
    expect(pkgSchemas.length).toBeGreaterThan(0);
  });

  it('apply_standard_package then list_standard_packages shows loaded status', () => {
    executeTool(
      'apply_standard_package',
      { packageId: 'std-pkg-software-architecture' },
      doc,
      pageId
    );

    const listResult = executeTool('list_standard_packages', {}, doc, pageId);
    const packages = (listResult.data as any).packages;
    const pkg = packages.find((p: any) => p.id === 'std-pkg-software-architecture');
    expect(pkg.status).toBe('loaded');
  });

  it('check_package_drift returns no drift after fresh apply', () => {
    executeTool(
      'apply_standard_package',
      { packageId: 'std-pkg-software-architecture' },
      doc,
      pageId
    );

    const driftResult = executeTool(
      'check_package_drift',
      { packageId: 'std-pkg-software-architecture' },
      doc,
      pageId
    );
    expect(driftResult.success).toBe(true);
    expect((driftResult.data as any).modified).toBe(false);
  });

  it('check_package_drift fails for non-loaded package', () => {
    const result = executeTool(
      'check_package_drift',
      { packageId: 'std-pkg-software-architecture' },
      doc,
      pageId
    );
    expect(result.success).toBe(false);
  });

  it('apply_standard_package fails for unknown packageId', () => {
    const result = executeTool(
      'apply_standard_package',
      { packageId: 'std-pkg-unknown-xyz' },
      doc,
      pageId
    );
    expect(result.success).toBe(false);
  });
});
