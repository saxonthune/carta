import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { listStandardPackages, applyStandardPackage, checkPackageDrift } from '../src/doc-operations.js';

describe('standard package operations', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  it('should list all standard packages as available for empty doc', () => {
    const packages = listStandardPackages(doc);

    // Verify we have the expected standard library packages
    expect(packages.length).toBeGreaterThan(0);

    // All packages should be available
    packages.forEach((pkg) => {
      expect(pkg.status).toBe('available');
      expect(pkg.id).toBeTruthy();
      expect(pkg.name).toBeTruthy();
      expect(pkg.color).toBeTruthy();
      expect(pkg.schemaCount).toBeGreaterThan(0);
    });
  });

  it('should apply standard package and add schemas', () => {
    // Apply std-pkg-software-architecture package
    const result = applyStandardPackage(doc, 'std-pkg-software-architecture');

    expect(result.status).toBe('applied');
    expect(result.packageId).toBe('std-pkg-software-architecture');
    expect(result.schemasLoaded).toBeGreaterThan(0);

    // Verify schemas were added to the document
    const yschemas = doc.getMap('schemas');
    let foundSchemas = 0;

    yschemas.forEach((yschema) => {
      const schema = yschema.toJSON() as { packageId?: string };
      if (schema.packageId === 'std-pkg-software-architecture') {
        foundSchemas++;
      }
    });

    expect(foundSchemas).toBe(result.schemasLoaded);
  });

  it('should be idempotent when applying same package twice', () => {
    // Apply package first time
    const firstResult = applyStandardPackage(doc, 'std-pkg-software-architecture');
    expect(firstResult.status).toBe('applied');
    const firstCount = firstResult.schemasLoaded;

    // Apply same package second time
    const secondResult = applyStandardPackage(doc, 'std-pkg-software-architecture');
    expect(secondResult.status).toBe('skipped');
    expect(secondResult.packageId).toBe('std-pkg-software-architecture');

    // Schema count should remain the same
    const yschemas = doc.getMap('schemas');
    let schemaCount = 0;

    yschemas.forEach((yschema) => {
      const schema = yschema.toJSON() as { packageId?: string };
      if (schema.packageId === 'std-pkg-software-architecture') {
        schemaCount++;
      }
    });

    expect(schemaCount).toBe(firstCount);
  });

  it('should show loaded status after applying package', () => {
    // Before applying
    const packagesBefore = listStandardPackages(doc);
    const softwareArchBefore = packagesBefore.find((p) => p.id === 'std-pkg-software-architecture');
    expect(softwareArchBefore?.status).toBe('available');

    // Apply package
    applyStandardPackage(doc, 'std-pkg-software-architecture');

    // After applying
    const packagesAfter = listStandardPackages(doc);
    const softwareArchAfter = packagesAfter.find((p) => p.id === 'std-pkg-software-architecture');
    expect(softwareArchAfter?.status).toBe('loaded');

    // Other packages should still be available
    const otherPackages = packagesAfter.filter((p) => p.id !== 'std-pkg-software-architecture');
    otherPackages.forEach((pkg) => {
      expect(pkg.status).toBe('available');
    });
  });

  it('should return false for unmodified package drift check', () => {
    // Apply package
    applyStandardPackage(doc, 'std-pkg-software-architecture');

    // Check for drift
    const driftResult = checkPackageDrift(doc, 'std-pkg-software-architecture');

    expect(driftResult.packageId).toBe('std-pkg-software-architecture');
    expect(driftResult.modified).toBe(false);
    expect(driftResult.loadedAt).toBeTruthy();
  });

  it('should throw for unknown package ID', () => {
    expect(() => {
      applyStandardPackage(doc, 'nonexistent-package');
    }).toThrow('Unknown standard library package: nonexistent-package');
  });
});
