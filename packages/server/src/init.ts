/**
 * carta init — scaffold a .carta/ workspace directory.
 *
 * Exports:
 *   scaffoldWorkspace(options) — pure function, testable, no I/O beyond fs
 *   runInitInteractive(projectDir) — prompts then calls scaffoldWorkspace()
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

// ============================================================
// Types
// ============================================================

export interface ScaffoldOptions {
  /** Absolute path to the project root (the directory containing .carta/) */
  projectDir: string;
  /** Workspace title */
  title: string;
  /** Workspace description (optional) */
  description?: string;
}

export interface ScaffoldResult {
  /** Files created, relative to projectDir */
  created: string[];
  /** Whether .gitignore was updated */
  gitignoreUpdated: boolean;
  /** Whether .carta/ already existed (scaffold was skipped) */
  alreadyExists: boolean;
}

// ============================================================
// Scaffold logic
// ============================================================

const GITIGNORE_ENTRIES = ['.carta/.state/', '.carta/ui-state.json'];
const GITIGNORE_SECTION_HEADER = '# Carta workspace';

/**
 * Pure scaffold function — creates the .carta/ directory structure.
 * No prompts, no readline. Testable in isolation.
 */
export function scaffoldWorkspace(options: ScaffoldOptions): ScaffoldResult {
  const { projectDir, title, description } = options;
  const cartaDir = path.join(projectDir, '.carta');

  // Idempotency check
  if (fs.existsSync(cartaDir)) {
    return { alreadyExists: true, created: [], gitignoreUpdated: false };
  }

  const created: string[] = [];

  // 1. Create .carta/
  fs.mkdirSync(cartaDir);
  created.push('.carta/');

  // 2. Write .carta/workspace.json
  const manifest: { formatVersion: number; title: string; description?: string } = {
    formatVersion: 1,
    title,
  };
  if (description !== undefined && description !== '') {
    manifest.description = description;
  }
  const workspaceJsonPath = path.join(cartaDir, 'workspace.json');
  fs.writeFileSync(workspaceJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  created.push('.carta/workspace.json');

  // 3. Create .carta/schemas/ and schemas.json
  const schemasDir = path.join(cartaDir, 'schemas');
  fs.mkdirSync(schemasDir);
  created.push('.carta/schemas/');

  const schemasFile = {
    formatVersion: 1,
    schemas: [],
    portSchemas: [],
    schemaGroups: [],
    schemaRelationships: [],
    schemaPackages: [],
  };
  const schemasJsonPath = path.join(schemasDir, 'schemas.json');
  fs.writeFileSync(schemasJsonPath, JSON.stringify(schemasFile, null, 2) + '\n', 'utf-8');
  created.push('.carta/schemas/schemas.json');

  // 4. Create .carta/.state/
  const stateDir = path.join(cartaDir, '.state');
  fs.mkdirSync(stateDir);
  created.push('.carta/.state/');

  // 5. Update .gitignore
  const gitignorePath = path.join(projectDir, '.gitignore');
  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf-8')
    : '';

  const missingEntries = GITIGNORE_ENTRIES.filter((entry) => !existing.includes(entry));
  let gitignoreUpdated = false;

  if (missingEntries.length > 0) {
    const section =
      (existing.length > 0 && !existing.endsWith('\n') ? '\n' : '') +
      '\n' +
      GITIGNORE_SECTION_HEADER +
      '\n' +
      missingEntries.join('\n') +
      '\n';
    fs.writeFileSync(gitignorePath, existing + section, 'utf-8');
    gitignoreUpdated = true;
  }

  return { alreadyExists: false, created, gitignoreUpdated };
}

// ============================================================
// Interactive wrapper
// ============================================================

export async function runInitInteractive(projectDir: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  const dirName = path.basename(projectDir);
  const title = (await ask(`Workspace title [${dirName}]: `)).trim() || dirName;
  const description = (await ask('Description (optional): ')).trim() || undefined;
  rl.close();

  const result = scaffoldWorkspace({ projectDir, title, description });

  if (result.alreadyExists) {
    console.log('.carta/ already exists — nothing to do.');
    return;
  }

  for (const file of result.created) {
    console.log(`  Created ${file}`);
  }
  if (result.gitignoreUpdated) {
    console.log('  Updated .gitignore');
  }
  console.log('\nWorkspace initialized. Run `carta serve .` to start editing.');
}
