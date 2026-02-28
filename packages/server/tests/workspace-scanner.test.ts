import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanWorkspace } from '../src/workspace-scanner.js';

// ===== Helpers =====

let tempDirs: string[] = [];

function mkTemp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-scanner-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function mkCartaDir(): string {
  const base = mkTemp();
  const cartaDir = path.join(base, '.carta');
  fs.mkdirSync(cartaDir);
  return cartaDir;
}

const WORKSPACE_MANIFEST = { formatVersion: 1, title: 'Test Workspace', description: 'A test' };
const GROUP_META = { name: 'API Contract', description: 'API specs' };

// ===== Tests =====

describe('scanWorkspace', () => {
  it('returns correct tree for workspace with group, ungrouped file, and schemas', () => {
    const cartaDir = mkCartaDir();

    // workspace.json with groups
    writeJson(path.join(cartaDir, 'workspace.json'), {
      ...WORKSPACE_MANIFEST,
      groups: { '01-api-contract': GROUP_META },
    });

    // schemas/schemas.json
    writeJson(path.join(cartaDir, 'schemas', 'schemas.json'), {
      formatVersion: 1,
      schemas: [],
      portSchemas: [],
      schemaGroups: [],
      schemaRelationships: [],
      schemaPackages: [],
    });

    // Group directory: 01-api-contract
    const groupDir = path.join(cartaDir, '01-api-contract');
    fs.mkdirSync(groupDir);
    writeJson(path.join(groupDir, 'endpoint-map.canvas.json'), {
      formatVersion: 1, nodes: [], edges: [],
    });
    fs.writeFileSync(path.join(groupDir, 'openapi.ts'), 'export {}', 'utf-8');

    // Ungrouped canvas file at top level
    writeJson(path.join(cartaDir, 'overview.canvas.json'), {
      formatVersion: 1, nodes: [], edges: [],
    });

    const tree = scanWorkspace(cartaDir);

    // Manifest
    expect(tree.manifest.title).toBe('Test Workspace');
    expect(tree.manifest.formatVersion).toBe(1);

    // Schemas path
    expect(tree.schemasPath).toBe('schemas/schemas.json');

    // Groups
    expect(tree.groups).toHaveLength(1);
    const group = tree.groups[0]!;
    expect(group.name).toBe('API Contract');
    expect(group.description).toBe('API specs');
    expect(group.dirName).toBe('01-api-contract');
    expect(group.path).toBe('01-api-contract');
    expect(group.files).toHaveLength(2);

    // Files within group (sorted by name)
    const canvasFile = group.files.find(f => f.name === 'endpoint-map.canvas.json')!;
    expect(canvasFile).toBeDefined();
    expect(canvasFile.type).toBe('canvas');
    expect(canvasFile.path).toBe('01-api-contract/endpoint-map.canvas.json');
    expect(canvasFile.size).toBeGreaterThan(0);

    const resourceFile = group.files.find(f => f.name === 'openapi.ts')!;
    expect(resourceFile).toBeDefined();
    expect(resourceFile.type).toBe('file');
    expect(resourceFile.path).toBe('01-api-contract/openapi.ts');

    // Ungrouped files
    expect(tree.ungroupedFiles).toHaveLength(1);
    expect(tree.ungroupedFiles[0]!.name).toBe('overview.canvas.json');
    expect(tree.ungroupedFiles[0]!.type).toBe('canvas');
    expect(tree.ungroupedFiles[0]!.path).toBe('overview.canvas.json');
  });

  it('returns 0 groups and multiple ungrouped files when no group dirs', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'canvas-a.canvas.json'), { formatVersion: 1, nodes: [], edges: [] });
    writeJson(path.join(cartaDir, 'canvas-b.canvas.json'), { formatVersion: 1, nodes: [], edges: [] });

    const tree = scanWorkspace(cartaDir);

    expect(tree.groups).toHaveLength(0);
    expect(tree.ungroupedFiles).toHaveLength(2);
    expect(tree.ungroupedFiles.map(f => f.name)).toEqual(['canvas-a.canvas.json', 'canvas-b.canvas.json']);
  });

  it('throws when workspace.json is missing', () => {
    const cartaDir = mkCartaDir();
    expect(() => scanWorkspace(cartaDir)).toThrow();
  });

  it('excludes ui-state.json and .state/ directory from the tree', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'ui-state.json'), { theme: 'dark' });
    const stateDir = path.join(cartaDir, '.state');
    fs.mkdirSync(stateDir);
    fs.writeFileSync(path.join(stateDir, 'some-doc.yjs'), Buffer.from([1, 2, 3]));

    const tree = scanWorkspace(cartaDir);

    expect(tree.ungroupedFiles.map(f => f.name)).not.toContain('ui-state.json');
    expect(tree.groups.map(g => g.dirName)).not.toContain('.state');
  });

  it('detects schemas path when schemas/schemas.json exists', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'schemas', 'schemas.json'), {
      formatVersion: 1,
      schemas: [],
      portSchemas: [],
      schemaGroups: [],
      schemaRelationships: [],
      schemaPackages: [],
    });

    const tree = scanWorkspace(cartaDir);
    expect(tree.schemasPath).toBe('schemas/schemas.json');
  });

  it('returns null schemasPath when schemas/schemas.json is absent', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    const tree = scanWorkspace(cartaDir);
    expect(tree.schemasPath).toBeNull();
  });

  it('sorts groups by dirName', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), {
      ...WORKSPACE_MANIFEST,
      groups: {
        '03-deployment': { name: '03-deployment' },
        '01-api': { name: '01-api' },
        '02-data-model': { name: '02-data-model' },
      },
    });

    for (const dirName of ['03-deployment', '01-api', '02-data-model']) {
      fs.mkdirSync(path.join(cartaDir, dirName));
    }

    const tree = scanWorkspace(cartaDir);

    expect(tree.groups.map(g => g.dirName)).toEqual(['01-api', '02-data-model', '03-deployment']);
  });

  it('ignores directories not listed in manifest groups', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), {
      ...WORKSPACE_MANIFEST,
      groups: { '01-specs': { name: 'Specs' } },
    });

    // Listed group
    const groupDir = path.join(cartaDir, '01-specs');
    fs.mkdirSync(groupDir);
    writeJson(path.join(groupDir, 'spec.canvas.json'), { formatVersion: 1, nodes: [], edges: [] });

    // Unlisted directory — should be ignored
    fs.mkdirSync(path.join(cartaDir, '99-unknown'));

    const tree = scanWorkspace(cartaDir);

    expect(tree.groups).toHaveLength(1);
    expect(tree.groups[0]!.files).toHaveLength(1);
  });
});
