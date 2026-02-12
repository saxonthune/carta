import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createPage, addPinConstraint, listPinConstraints, removePinConstraint, applyPinLayout, createOrganizer } from '../src/doc-operations';
import { resolvePinConstraints } from '@carta/domain';
import type { PinLayoutNode } from '@carta/domain';

describe('pin constraints - Yjs operations', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('should add a pin constraint', () => {
    const constraint = addPinConstraint(doc, pageId, {
      sourceOrganizerId: 'org-1',
      targetOrganizerId: 'org-2',
      direction: 'N',
    });

    expect(constraint.id).toBeDefined();
    expect(constraint.sourceOrganizerId).toBe('org-1');
    expect(constraint.targetOrganizerId).toBe('org-2');
    expect(constraint.direction).toBe('N');
    expect(constraint.gap).toBeUndefined();
  });

  it('should add a pin constraint with custom gap', () => {
    const constraint = addPinConstraint(doc, pageId, {
      sourceOrganizerId: 'org-1',
      targetOrganizerId: 'org-2',
      direction: 'E',
      gap: 100,
    });

    expect(constraint.gap).toBe(100);
  });

  it('should list pin constraints', () => {
    addPinConstraint(doc, pageId, {
      sourceOrganizerId: 'org-1',
      targetOrganizerId: 'org-2',
      direction: 'N',
    });

    addPinConstraint(doc, pageId, {
      sourceOrganizerId: 'org-2',
      targetOrganizerId: 'org-3',
      direction: 'S',
    });

    const constraints = listPinConstraints(doc, pageId);
    expect(constraints.length).toBe(2);
    expect(constraints[0]?.direction).toBe('N');
    expect(constraints[1]?.direction).toBe('S');
  });

  it('should remove a pin constraint', () => {
    const constraint = addPinConstraint(doc, pageId, {
      sourceOrganizerId: 'org-1',
      targetOrganizerId: 'org-2',
      direction: 'W',
    });

    let constraints = listPinConstraints(doc, pageId);
    expect(constraints.length).toBe(1);

    const removed = removePinConstraint(doc, pageId, constraint.id);
    expect(removed).toBe(true);

    constraints = listPinConstraints(doc, pageId);
    expect(constraints.length).toBe(0);
  });

  it('should return false when removing non-existent constraint', () => {
    const removed = removePinConstraint(doc, pageId, 'non-existent-id');
    expect(removed).toBe(false);
  });

  it('should isolate constraints per page', () => {
    const page2 = createPage(doc, 'Page 2');

    addPinConstraint(doc, pageId, {
      sourceOrganizerId: 'org-1',
      targetOrganizerId: 'org-2',
      direction: 'N',
    });

    addPinConstraint(doc, page2.id, {
      sourceOrganizerId: 'org-3',
      targetOrganizerId: 'org-4',
      direction: 'S',
    });

    const constraints1 = listPinConstraints(doc, pageId);
    const constraints2 = listPinConstraints(doc, page2.id);

    expect(constraints1.length).toBe(1);
    expect(constraints2.length).toBe(1);
    expect(constraints1[0]?.sourceOrganizerId).toBe('org-1');
    expect(constraints2[0]?.sourceOrganizerId).toBe('org-3');
  });
});

describe('pin constraints - resolution algorithm', () => {
  it('should resolve a simple linear constraint', () => {
    const nodes: PinLayoutNode[] = [
      { id: 'org-1', x: 0, y: 0, width: 200, height: 150 },
      { id: 'org-2', x: 100, y: 100, width: 200, height: 150 },
    ];

    const constraints = [
      {
        id: 'c1',
        sourceOrganizerId: 'org-2',
        targetOrganizerId: 'org-1',
        direction: 'S' as const,
        gap: 60,
      },
    ];

    const result = resolvePinConstraints(nodes, constraints);

    expect(result.warnings.length).toBe(0);
    expect(result.positions.get('org-1')).toEqual({ x: 0, y: 0 }); // Root stays
    expect(result.positions.get('org-2')?.y).toBeGreaterThan(0); // South of org-1
  });

  it('should resolve a chain: A -> B -> C', () => {
    const nodes: PinLayoutNode[] = [
      { id: 'A', x: 0, y: 0, width: 200, height: 100 },
      { id: 'B', x: 0, y: 0, width: 200, height: 100 },
      { id: 'C', x: 0, y: 0, width: 200, height: 100 },
    ];

    const constraints = [
      { id: 'c1', sourceOrganizerId: 'B', targetOrganizerId: 'A', direction: 'E' as const },
      { id: 'c2', sourceOrganizerId: 'C', targetOrganizerId: 'B', direction: 'E' as const },
    ];

    const result = resolvePinConstraints(nodes, constraints);

    expect(result.warnings.length).toBe(0);
    const posA = result.positions.get('A');
    const posB = result.positions.get('B');
    const posC = result.positions.get('C');

    expect(posA).toBeDefined();
    expect(posB).toBeDefined();
    expect(posC).toBeDefined();

    // B should be east of A
    expect(posB!.x).toBeGreaterThan(posA!.x);

    // C should be east of B
    expect(posC!.x).toBeGreaterThan(posB!.x);
  });

  it('should resolve diagonal directions', () => {
    const nodes: PinLayoutNode[] = [
      { id: 'center', x: 0, y: 0, width: 200, height: 200 },
      { id: 'ne', x: 0, y: 0, width: 100, height: 100 },
      { id: 'sw', x: 0, y: 0, width: 100, height: 100 },
    ];

    const constraints = [
      { id: 'c1', sourceOrganizerId: 'ne', targetOrganizerId: 'center', direction: 'NE' as const },
      { id: 'c2', sourceOrganizerId: 'sw', targetOrganizerId: 'center', direction: 'SW' as const },
    ];

    const result = resolvePinConstraints(nodes, constraints);

    expect(result.warnings.length).toBe(0);
    const posCenter = result.positions.get('center');
    const posNE = result.positions.get('ne');
    const posSW = result.positions.get('sw');

    expect(posNE!.x).toBeGreaterThan(posCenter!.x); // East
    expect(posNE!.y).toBeLessThan(posCenter!.y); // North

    expect(posSW!.x).toBeLessThan(posCenter!.x); // West
    expect(posSW!.y).toBeGreaterThan(posCenter!.y); // South
  });

  it('should detect cycles', () => {
    const nodes: PinLayoutNode[] = [
      { id: 'A', x: 0, y: 0, width: 200, height: 100 },
      { id: 'B', x: 100, y: 0, width: 200, height: 100 },
    ];

    const constraints = [
      { id: 'c1', sourceOrganizerId: 'B', targetOrganizerId: 'A', direction: 'E' as const },
      { id: 'c2', sourceOrganizerId: 'A', targetOrganizerId: 'B', direction: 'E' as const },
    ];

    const result = resolvePinConstraints(nodes, constraints);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Cycle detected');
  });

  it('should handle custom gap', () => {
    const nodes: PinLayoutNode[] = [
      { id: 'A', x: 0, y: 0, width: 200, height: 100 },
      { id: 'B', x: 0, y: 0, width: 200, height: 100 },
    ];

    const constraints = [
      { id: 'c1', sourceOrganizerId: 'B', targetOrganizerId: 'A', direction: 'S' as const, gap: 200 },
    ];

    const result = resolvePinConstraints(nodes, constraints);

    expect(result.warnings.length).toBe(0);
    const posA = result.positions.get('A');
    const posB = result.positions.get('B');

    // B should be 200px below A's bottom edge
    const expectedY = posA!.y + 100 + 200; // A.y + A.height + gap
    expect(posB!.y).toBe(expectedY);
  });

  it('should warn about missing nodes', () => {
    const nodes: PinLayoutNode[] = [
      { id: 'A', x: 0, y: 0, width: 200, height: 100 },
    ];

    const constraints = [
      { id: 'c1', sourceOrganizerId: 'B', targetOrganizerId: 'A', direction: 'S' as const },
    ];

    const result = resolvePinConstraints(nodes, constraints);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Source organizer not found');
  });

  it('should handle tree structure: A -> B, A -> C', () => {
    const nodes: PinLayoutNode[] = [
      { id: 'A', x: 0, y: 0, width: 200, height: 100 },
      { id: 'B', x: 0, y: 0, width: 200, height: 100 },
      { id: 'C', x: 0, y: 0, width: 200, height: 100 },
    ];

    const constraints = [
      { id: 'c1', sourceOrganizerId: 'B', targetOrganizerId: 'A', direction: 'S' as const },
      { id: 'c2', sourceOrganizerId: 'C', targetOrganizerId: 'A', direction: 'E' as const },
    ];

    const result = resolvePinConstraints(nodes, constraints);

    expect(result.warnings.length).toBe(0);
    const posA = result.positions.get('A');
    const posB = result.positions.get('B');
    const posC = result.positions.get('C');

    // B should be south of A
    expect(posB!.y).toBeGreaterThan(posA!.y);

    // C should be east of A
    expect(posC!.x).toBeGreaterThan(posA!.x);
  });
});

describe('pin constraints - applyPinLayout integration', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('should apply pin layout to organizers', () => {
    // Create two organizers
    const org1 = createOrganizer(doc, pageId, 'Organizer 1', { x: 0, y: 0 });
    const org2 = createOrganizer(doc, pageId, 'Organizer 2', { x: 100, y: 100 });

    // Add constraint: org2 south of org1
    addPinConstraint(doc, pageId, {
      sourceOrganizerId: org2.id,
      targetOrganizerId: org1.id,
      direction: 'S',
    });

    // Apply layout
    const result = applyPinLayout(doc, pageId);

    expect(result.warnings.length).toBe(0);
    expect(result.updated).toBeGreaterThan(0);
  });

  it('should return warnings on cycle', () => {
    const org1 = createOrganizer(doc, pageId, 'Organizer 1', { x: 0, y: 0 });
    const org2 = createOrganizer(doc, pageId, 'Organizer 2', { x: 100, y: 100 });

    // Create cycle
    addPinConstraint(doc, pageId, {
      sourceOrganizerId: org2.id,
      targetOrganizerId: org1.id,
      direction: 'S',
    });

    addPinConstraint(doc, pageId, {
      sourceOrganizerId: org1.id,
      targetOrganizerId: org2.id,
      direction: 'S',
    });

    const result = applyPinLayout(doc, pageId);

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
