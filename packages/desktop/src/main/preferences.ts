/**
 * Desktop preferences management.
 *
 * Stores user preferences (workspace path, last document) in a JSON file
 * separate from the workspace data.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DesktopPreferences {
  workspacePath: string | null;
  lastDocumentId: string | null;
}

const DEFAULT_PREFERENCES: DesktopPreferences = {
  workspacePath: null,
  lastDocumentId: null,
};

/**
 * Get the path to the preferences file.
 */
export function getPreferencesPath(userDataPath: string): string {
  return path.join(userDataPath, 'preferences.json');
}

/**
 * Read preferences from disk.
 */
export function readPreferences(userDataPath: string): DesktopPreferences {
  const prefsPath = getPreferencesPath(userDataPath);
  if (!fs.existsSync(prefsPath)) {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const content = fs.readFileSync(prefsPath, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      workspacePath: typeof parsed.workspacePath === 'string' ? parsed.workspacePath : null,
      lastDocumentId: typeof parsed.lastDocumentId === 'string' ? parsed.lastDocumentId : null,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Write preferences to disk.
 */
export function writePreferences(userDataPath: string, prefs: DesktopPreferences): void {
  const prefsPath = getPreferencesPath(userDataPath);
  fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
}

/**
 * Check if this is the first run (no workspace configured or workspace invalid).
 * A workspace is valid if the path exists and contains .carta/workspace.json.
 */
export function isFirstRun(userDataPath: string): boolean {
  const prefs = readPreferences(userDataPath);
  if (prefs.workspacePath === null) return true;
  if (!fs.existsSync(prefs.workspacePath)) return true;
  return !fs.existsSync(path.join(prefs.workspacePath, '.carta', 'workspace.json'));
}
