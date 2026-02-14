import { describe, it, expect } from 'vitest';
import { loadSeeds, hydrateSeeds } from '../../../domain/src/schemas/seed-loader';
import type { SchemaSeed } from '../../../domain/src/schemas/seed-loader';
import { hydrateSeed, flowInPort, flowOutPort } from '../../../domain/src/schemas/built-ins';
import { sketchingSeed } from '../../../domain/src/schemas/seeds/sketching';
import { softwareArchitectureSeed } from '../../../domain/src/schemas/seeds/software-architecture';

// --- synthetic test seeds ---

const seedA: SchemaSeed = {
  package: { id: 'pkgA', name: 'Package A', color: '#000' },
  portSchemas: [flowInPort],
  schemas: [
    {
      type: 'schema-a1',
      displayName: 'Schema A1',
      color: '#000',
      packageId: 'pkgA',
      fields: [],
      ports: [],
      compilation: { format: 'json' },
    },
  ],
};

const seedB: SchemaSeed = {
  package: { id: 'pkgB', name: 'Package B', color: '#111' },
  groups: [
    { id: 'grpB1', name: 'Group B1', packageId: 'pkgB' },
    { id: 'grpB2', name: 'Group B2', packageId: 'pkgB' },
  ],
  portSchemas: [flowOutPort],
  schemas: [
    {
      type: 'schema-b1',
      displayName: 'Schema B1',
      color: '#111',
      packageId: 'pkgB',
      groupId: 'grpB1',
      fields: [],
      ports: [],
      compilation: { format: 'json' },
    },
    {
      type: 'schema-b2',
      displayName: 'Schema B2',
      color: '#222',
      packageId: 'pkgB',
      groupId: 'grpB2',
      fields: [],
      ports: [],
      compilation: { format: 'json' },
    },
  ],
};

// --- loadSeeds ---

describe('loadSeeds', () => {
  it('flattens packages and groups from multiple seeds', () => {
    const { packages, groups, schemas, portSchemas } = loadSeeds([seedA, seedB]);
    // seedA: 1 package, seedB: 1 package = 2 total packages
    expect(packages).toHaveLength(2);
    // seedA: 0 groups, seedB: 2 groups = 2 total groups
    expect(groups).toHaveLength(2);
    expect(schemas).toHaveLength(3);
    expect(portSchemas).toBeDefined();
    expect(Array.isArray(portSchemas)).toBe(true);
  });

  it('aggregates port schemas from all seeds', () => {
    const { portSchemas } = loadSeeds([seedA, seedB]);
    // seedA has flowInPort, seedB has flowOutPort
    expect(portSchemas).toHaveLength(2);
    expect(portSchemas.find(ps => ps.id === 'flow-in')).toBeDefined();
    expect(portSchemas.find(ps => ps.id === 'flow-out')).toBeDefined();
  });

  it('deduplicates port schemas by id (first occurrence wins)', () => {
    const seedC: SchemaSeed = {
      group: { id: 'grpC', name: 'Group C' },
      portSchemas: [flowInPort], // duplicate of seedA
      schemas: [],
    };
    const { portSchemas } = loadSeeds([seedA, seedC]);
    // Both seeds have flowInPort, but only one should appear
    expect(portSchemas).toHaveLength(1);
    expect(portSchemas[0].id).toBe('flow-in');
  });

  it('groups have packageId assigned from seed', () => {
    const { groups } = loadSeeds([seedB]);
    const grp1 = groups.find(g => g.id === 'grpB1');
    const grp2 = groups.find(g => g.id === 'grpB2');
    expect(grp1?.packageId).toBe('pkgB');
    expect(grp2?.packageId).toBe('pkgB');
  });

  it('schema packageIds and groupIds point to seed-local refs', () => {
    const { schemas } = loadSeeds([seedA, seedB]);
    expect(schemas.find(s => s.type === 'schema-a1')?.packageId).toBe('pkgA');
    expect(schemas.find(s => s.type === 'schema-b1')?.packageId).toBe('pkgB');
    expect(schemas.find(s => s.type === 'schema-b1')?.groupId).toBe('grpB1');
  });

  it('works with real seed files', () => {
    const { packages, groups, schemas, portSchemas } = loadSeeds([sketchingSeed, softwareArchitectureSeed]);
    expect(packages.length).toBeGreaterThan(0);
    expect(groups.length).toBeGreaterThan(0);
    expect(schemas.length).toBeGreaterThan(0);
    expect(portSchemas.length).toBeGreaterThan(0);
    // Sketching has no groups, software-architecture has several
    const sketchPackage = packages.find(p => p.name === 'Sketching');
    expect(sketchPackage).toBeDefined();
  });

  it('real seeds have non-empty portSchemas arrays', () => {
    expect(sketchingSeed.portSchemas).toBeDefined();
    expect(sketchingSeed.portSchemas.length).toBeGreaterThan(0);
    expect(softwareArchitectureSeed.portSchemas).toBeDefined();
    expect(softwareArchitectureSeed.portSchemas.length).toBeGreaterThan(0);
  });
});

// --- hydrateSeeds (current behavior) ---

describe('hydrateSeeds', () => {
  it('all package IDs become UUIDs (pkg_xxx format) and group IDs (grp_xxx format)', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA, seedB]);
    const { packages, groups } = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    for (const p of packages) {
      expect(p.id).toMatch(/^pkg_/);
      expect(p.id).not.toBe('pkgA');
      expect(p.id).not.toBe('pkgB');
    }
    for (const g of groups) {
      expect(g.id).toMatch(/^grp_/);
      expect(g.id).not.toBe('grpB1');
      expect(g.id).not.toBe('grpB2');
    }
  });

  it('portSchemas are hydrated with packageId refs resolved', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA, seedB]);
    const result = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    expect(result.portSchemas).toHaveLength(2);
  });

  it('schema packageIds and groupIds resolve to generated UUIDs', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA]);
    const { packages, schemas } = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    const packageA = packages.find(p => p.name === 'Package A');
    const schemaA1 = schemas.find(s => s.type === 'schema-a1');
    expect(schemaA1?.packageId).toBe(packageA?.id);
  });

  it('group packageIds resolve correctly', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedB]);
    const { packages, groups } = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    const pkg = packages.find(p => p.name === 'Package B');
    const grp1 = groups.find(g => g.name === 'Group B1');
    const grp2 = groups.find(g => g.name === 'Group B2');
    expect(grp1?.packageId).toBe(pkg?.id);
    expect(grp2?.packageId).toBe(pkg?.id);
  });

  it('two hydrations produce different UUIDs (non-idempotent)', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA]);
    const first = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    const second = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    expect(first.packages[0].id).not.toBe(second.packages[0].id);
  });

  // --- idempotent behavior with existingPackages and existingGroups ---

  it('with existing matching by name: reuses existing IDs', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA, seedB]);
    // First hydration creates the "existing" state
    const first = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    // Second hydration passes first result as existing
    const second = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas, first.packages, first.groups);
    // All IDs should match
    for (const fp of first.packages) {
      const sp = second.packages.find(p => p.name === fp.name);
      expect(sp?.id).toBe(fp.id);
    }
    for (const fg of first.groups) {
      const sg = second.groups.find(g => g.name === fg.name);
      expect(sg?.id).toBe(fg.id);
    }
  });

  it('with existing partially matching: reuses matches, generates new for missing', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA, seedB]);
    // Only pass seedA's packages as existing
    const loadedA = loadSeeds([seedA]);
    const firstA = hydrateSeeds(loadedA.packages, loadedA.groups, loadedA.schemas, loadedA.portSchemas);
    const result = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas, firstA.packages);
    // Package A should match
    const resA = result.packages.find(p => p.name === 'Package A');
    expect(resA?.id).toBe(firstA.packages[0].id);
    // Package B should be new
    const resB = result.packages.find(p => p.name === 'Package B');
    expect(resB?.id).toMatch(/^pkg_/);
    expect(resB?.id).not.toBe(firstA.packages[0].id);
  });

  it('with empty existing: generates all new (same as before)', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA]);
    const withEmpty = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas, [], []);
    const without = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    // Both should have pkg_ format but different IDs
    expect(withEmpty.packages[0].id).toMatch(/^pkg_/);
    expect(without.packages[0].id).toMatch(/^pkg_/);
    // They won't match each other (random IDs)
    expect(withEmpty.packages[0].id).not.toBe(without.packages[0].id);
  });

  it('calling twice with same existing produces identical output', () => {
    const { packages: tplPackages, groups: tplGroups, schemas: tplSchemas, portSchemas } = loadSeeds([seedA, seedB]);
    const existing = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas);
    const first = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas, existing.packages, existing.groups);
    const second = hydrateSeeds(tplPackages, tplGroups, tplSchemas, portSchemas, existing.packages, existing.groups);
    expect(first.packages.map(p => p.id)).toEqual(second.packages.map(p => p.id));
    expect(first.groups.map(g => g.id)).toEqual(second.groups.map(g => g.id));
    expect(first.schemas.map(s => s.packageId)).toEqual(second.schemas.map(s => s.packageId));
  });
});

// --- hydrateSeed (single seed helper) ---

describe('hydrateSeed', () => {
  it('without existing: generates new UUIDs each time', () => {
    const first = hydrateSeed(seedA);
    const second = hydrateSeed(seedA);
    expect(first.packages[0].id).toMatch(/^pkg_/);
    expect(second.packages[0].id).toMatch(/^pkg_/);
    expect(first.packages[0].id).not.toBe(second.packages[0].id);
  });

  it('returns portSchemas from seed', () => {
    const result = hydrateSeed(seedA);
    expect(result.portSchemas).toBeDefined();
    expect(result.portSchemas).toHaveLength(1);
    expect(result.portSchemas[0].id).toBe('flow-in');
  });

  it('with existing: reuses IDs for matching names', () => {
    const first = hydrateSeed(seedA);
    const second = hydrateSeed(seedA, first.packages, first.groups);
    // Package names match, so IDs should be reused
    expect(second.packages[0].id).toBe(first.packages[0].id);
    expect(second.packages[0].name).toBe('Package A');
  });

  it('with existing from different seed: generates new IDs', () => {
    const firstA = hydrateSeed(seedA);
    const secondB = hydrateSeed(seedB, firstA.packages, firstA.groups);
    // seedB packages don't match seedA, so all new IDs
    for (const p of secondB.packages) {
      expect(firstA.packages.some(ep => ep.id === p.id)).toBe(false);
    }
  });
});
