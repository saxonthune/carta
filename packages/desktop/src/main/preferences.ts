/**
 * Desktop preferences management.
 *
 * Stores user preferences like vault path in a JSON file
 * separate from the document data.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface DesktopPreferences {
  vaultPath: string | null;
  lastDocumentId: string | null;
}

const DEFAULT_PREFERENCES: DesktopPreferences = {
  vaultPath: null,
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
      vaultPath: typeof parsed.vaultPath === 'string' ? parsed.vaultPath : null,
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
 * Get the default vault path.
 * Returns ~/Documents/Carta/ on all platforms.
 */
export function getDefaultVaultPath(): string {
  const home = os.homedir();
  return path.join(home, 'Documents', 'Carta');
}

/**
 * Check if this is the first run (no vault configured).
 */
export function isFirstRun(userDataPath: string): boolean {
  const prefs = readPreferences(userDataPath);
  return prefs.vaultPath === null;
}

/**
 * Ensure the vault directory exists.
 * Creates it if it doesn't exist.
 */
export function ensureVaultExists(vaultPath: string): void {
  if (!fs.existsSync(vaultPath)) {
    fs.mkdirSync(vaultPath, { recursive: true });
  }
}
