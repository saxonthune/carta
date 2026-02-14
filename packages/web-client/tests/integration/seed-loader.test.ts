import { describe, it, expect } from 'vitest';
import { loadSeeds, hydrateSeeds } from '../../../domain/src/schemas/seed-loader';
import type { SchemaSeed } from '../../../domain/src/schemas/seed-loader';
import { hydrateSeed } from '../../../domain/src/schemas/built-ins';
import { sketchingSeed } from '../../../domain/src/schemas/seeds/sketching';
import { softwareArchitectureSeed } from '../../../domain/src/schemas/seeds/software-architecture';

// --- synthetic test seeds ---

const seedA: SchemaSeed = {
  group: { id: 'grpA', name: 'Group A' },
  schemas: [
    {
      type: 'schema-a1',
      displayName: 'Schema A1',
      color: '#000',
      groupId: 'grpA',
      fields: [],
      ports: [],
    },
  ],
};

const seedB: SchemaSeed = {
  group: { id: 'grpB', name: 'Group B' },
  subgroups: [
    { id: 'subB1', name: 'Sub B1' },
    { id: 'subB2', name: 'Sub B2' },
  ],
  schemas: [
    {
      type: 'schema-b1',
      displayName: 'Schema B1',
      color: '#111',
      groupId: 'subB1',
      fields: [],
      ports: [],
    },
    {
      type: 'schema-b2',
      displayName: 'Schema B2',
      color: '#222',
      groupId: 'subB2',
      fields: [],
      ports: [],
    },
  ],
};

// --- loadSeeds ---

describe('loadSeeds', () => {
  it('flattens groups from multiple seeds', () => {
    const { groups, schemas } = loadSeeds([seedA, seedB]);
    // seedA: 1 group, seedB: 1 group + 2 subgroups = 4 total
    expect(groups).toHaveLength(4);
    expect(schemas).toHaveLength(3);
  });

  it('flattens subgroups with parentId set to root group', () => {
    const { groups } = loadSeeds([seedB]);
    const sub1 = groups.find(g => g.id === 'subB1');
    const sub2 = groups.find(g => g.id === 'subB2');
    expect(sub1?.parentId).toBe('grpB');
    expect(sub2?.parentId).toBe('grpB');
  });

  it('schema groupIds point to seed-local refs', () => {
    const { schemas } = loadSeeds([seedA, seedB]);
    expect(schemas.find(s => s.type === 'schema-a1')?.groupId).toBe('grpA');
    expect(schemas.find(s => s.type === 'schema-b1')?.groupId).toBe('subB1');
  });

  it('works with real seed files', () => {
    const { groups, schemas } = loadSeeds([sketchingSeed, softwareArchitectureSeed]);
    expect(groups.length).toBeGreaterThan(0);
    expect(schemas.length).toBeGreaterThan(0);
    // Sketching has no subgroups, software-architecture has several
    const sketchGroup = groups.find(g => g.name === 'Sketching');
    expect(sketchGroup).toBeDefined();
  });
});

// --- hydrateSeeds (current behavior) ---

describe('hydrateSeeds', () => {
  it('all group IDs become UUIDs (grp_xxx format)', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedA, seedB]);
    const { groups } = hydrateSeeds(tplGroups, tplSchemas);
    for (const g of groups) {
      expect(g.id).toMatch(/^grp_/);
      expect(g.id).not.toBe('grpA');
      expect(g.id).not.toBe('grpB');
    }
  });

  it('schema groupIds resolve to generated UUIDs', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedA]);
    const { groups, schemas } = hydrateSeeds(tplGroups, tplSchemas);
    const groupA = groups.find(g => g.name === 'Group A');
    const schemaA1 = schemas.find(s => s.type === 'schema-a1');
    expect(schemaA1?.groupId).toBe(groupA?.id);
  });

  it('subgroup parentIds resolve correctly', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedB]);
    const { groups } = hydrateSeeds(tplGroups, tplSchemas);
    const root = groups.find(g => g.name === 'Group B');
    const sub1 = groups.find(g => g.name === 'Sub B1');
    const sub2 = groups.find(g => g.name === 'Sub B2');
    expect(sub1?.parentId).toBe(root?.id);
    expect(sub2?.parentId).toBe(root?.id);
  });

  it('two hydrations produce different UUIDs (non-idempotent)', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedA]);
    const first = hydrateSeeds(tplGroups, tplSchemas);
    const second = hydrateSeeds(tplGroups, tplSchemas);
    expect(first.groups[0].id).not.toBe(second.groups[0].id);
  });

  // --- idempotent behavior with existingGroups ---

  it('with existingGroups matching by name: reuses existing group IDs', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedA, seedB]);
    // First hydration creates the "existing" state
    const first = hydrateSeeds(tplGroups, tplSchemas);
    // Second hydration passes first result as existing
    const second = hydrateSeeds(tplGroups, tplSchemas, first.groups);
    // All group IDs should match
    for (const fg of first.groups) {
      const sg = second.groups.find(g => g.name === fg.name);
      expect(sg?.id).toBe(fg.id);
    }
  });

  it('with existingGroups partially matching: reuses matches, generates new for missing', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedA, seedB]);
    // Only pass seedA's groups as existing
    const firstA = hydrateSeeds(
      loadSeeds([seedA]).groups,
      loadSeeds([seedA]).schemas,
    );
    const result = hydrateSeeds(tplGroups, tplSchemas, firstA.groups);
    // Group A should match
    const resA = result.groups.find(g => g.name === 'Group A');
    expect(resA?.id).toBe(firstA.groups[0].id);
    // Group B should be new
    const resB = result.groups.find(g => g.name === 'Group B');
    expect(resB?.id).toMatch(/^grp_/);
    expect(resB?.id).not.toBe(firstA.groups[0].id);
  });

  it('with empty existingGroups: generates all new (same as before)', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedA]);
    const withEmpty = hydrateSeeds(tplGroups, tplSchemas, []);
    const without = hydrateSeeds(tplGroups, tplSchemas);
    // Both should have grp_ format but different IDs
    expect(withEmpty.groups[0].id).toMatch(/^grp_/);
    expect(without.groups[0].id).toMatch(/^grp_/);
    // They won't match each other (random IDs)
    expect(withEmpty.groups[0].id).not.toBe(without.groups[0].id);
  });

  it('calling twice with same existingGroups produces identical output', () => {
    const { groups: tplGroups, schemas: tplSchemas } = loadSeeds([seedA, seedB]);
    const existing = hydrateSeeds(tplGroups, tplSchemas).groups;
    const first = hydrateSeeds(tplGroups, tplSchemas, existing);
    const second = hydrateSeeds(tplGroups, tplSchemas, existing);
    expect(first.groups.map(g => g.id)).toEqual(second.groups.map(g => g.id));
    expect(first.schemas.map(s => s.groupId)).toEqual(second.schemas.map(s => s.groupId));
  });
});

// --- hydrateSeed (single seed helper) ---

describe('hydrateSeed', () => {
  it('without existingGroups: generates new UUIDs each time', () => {
    const first = hydrateSeed(seedA);
    const second = hydrateSeed(seedA);
    expect(first.groups[0].id).toMatch(/^grp_/);
    expect(second.groups[0].id).toMatch(/^grp_/);
    expect(first.groups[0].id).not.toBe(second.groups[0].id);
  });

  it('with existingGroups: reuses IDs for matching group names', () => {
    const first = hydrateSeed(seedA);
    const second = hydrateSeed(seedA, first.groups);
    // Group names match, so IDs should be reused
    expect(second.groups[0].id).toBe(first.groups[0].id);
    expect(second.groups[0].name).toBe('Group A');
  });

  it('with existingGroups from different seed: generates new IDs', () => {
    const firstA = hydrateSeed(seedA);
    const secondB = hydrateSeed(seedB, firstA.groups);
    // seedB groups don't match seedA, so all new IDs
    for (const g of secondB.groups) {
      expect(firstA.groups.some(eg => eg.id === g.id)).toBe(false);
    }
  });
});
