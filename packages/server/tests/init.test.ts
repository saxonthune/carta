import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scaffoldWorkspace } from '../src/init.js';
import { validateWorkspaceManifest, validateSchemasFile } from '@carta/document';

// ===== Helpers =====

let tempDirs: string[] = [];

function mkTemp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-init-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

// ===== Tests =====

describe('scaffoldWorkspace', () => {
  it('creates expected directory structure', () => {
    const projectDir = mkTemp();

    const result = scaffoldWorkspace({ projectDir, title: 'My Project', description: 'A description' });

    expect(result.alreadyExists).toBe(false);

    // .carta/workspace.json
    const workspaceJsonPath = path.join(projectDir, '.carta', 'workspace.json');
    expect(fs.existsSync(workspaceJsonPath)).toBe(true);
    const manifest = validateWorkspaceManifest(JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf-8')));
    expect(manifest.title).toBe('My Project');
    expect(manifest.description).toBe('A description');
    expect(manifest.formatVersion).toBe(1);

    // .carta/schemas/schemas.json
    const schemasJsonPath = path.join(projectDir, '.carta', 'schemas', 'schemas.json');
    expect(fs.existsSync(schemasJsonPath)).toBe(true);
    const schemas = validateSchemasFile(JSON.parse(fs.readFileSync(schemasJsonPath, 'utf-8')));
    expect(schemas.schemas).toEqual([]);
    expect(schemas.portSchemas).toEqual([]);
    expect(schemas.schemaGroups).toEqual([]);
    expect(schemas.schemaRelationships).toEqual([]);
    expect(schemas.schemaPackages).toEqual([]);

    // .carta/.state/
    const stateDir = path.join(projectDir, '.carta', '.state');
    expect(fs.existsSync(stateDir)).toBe(true);
    expect(fs.statSync(stateDir).isDirectory()).toBe(true);
  });

  it('omits description key when not provided', () => {
    const projectDir = mkTemp();

    scaffoldWorkspace({ projectDir, title: 'No Description' });

    const workspaceJsonPath = path.join(projectDir, '.carta', 'workspace.json');
    const raw = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf-8')) as Record<string, unknown>;
    expect('description' in raw).toBe(false);
    // Must still pass validation
    expect(() => validateWorkspaceManifest(raw)).not.toThrow();
  });

  it('appends to existing .gitignore', () => {
    const projectDir = mkTemp();
    const gitignorePath = path.join(projectDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'node_modules/\ndist/\n', 'utf-8');

    const result = scaffoldWorkspace({ projectDir, title: 'Test' });

    expect(result.gitignoreUpdated).toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    // Original content preserved
    expect(content).toContain('node_modules/');
    expect(content).toContain('dist/');
    // Carta entries appended
    expect(content).toContain('.carta/.state/');
    expect(content).toContain('.carta/ui-state.json');
  });

  it('creates .gitignore when none exists', () => {
    const projectDir = mkTemp();

    const result = scaffoldWorkspace({ projectDir, title: 'Test' });

    expect(result.gitignoreUpdated).toBe(true);
    const gitignorePath = path.join(projectDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.carta/.state/');
    expect(content).toContain('.carta/ui-state.json');
  });

  it('returns alreadyExists when .carta/ already exists', () => {
    const projectDir = mkTemp();
    const cartaDir = path.join(projectDir, '.carta');
    fs.mkdirSync(cartaDir);

    const result = scaffoldWorkspace({ projectDir, title: 'Test' });

    expect(result.alreadyExists).toBe(true);
    expect(result.created).toEqual([]);
    expect(result.gitignoreUpdated).toBe(false);
  });

  it('does not duplicate gitignore entries', () => {
    const projectDir = mkTemp();
    const gitignorePath = path.join(projectDir, '.gitignore');
    // Pre-populate with Carta entries already present
    fs.writeFileSync(gitignorePath, '# Carta workspace\n.carta/.state/\n.carta/ui-state.json\n', 'utf-8');

    const result = scaffoldWorkspace({ projectDir, title: 'Test' });

    expect(result.gitignoreUpdated).toBe(false);
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    // Count occurrences — should be exactly once each
    const stateCount = (content.match(/\.carta\/\.state\//g) ?? []).length;
    const uiStateCount = (content.match(/\.carta\/ui-state\.json/g) ?? []).length;
    expect(stateCount).toBe(1);
    expect(uiStateCount).toBe(1);
  });

  it('result lists all created files', () => {
    const projectDir = mkTemp();

    const result = scaffoldWorkspace({ projectDir, title: 'Test' });

    expect(result.created).toContain('.carta/');
    expect(result.created).toContain('.carta/workspace.json');
    expect(result.created).toContain('.carta/schemas/');
    expect(result.created).toContain('.carta/schemas/schemas.json');
    expect(result.created).toContain('.carta/.state/');
  });
});
