import type { Deployable } from './types';
import { getDocumentState } from '../stores/documentStore';

/**
 * DeployableRegistry - Facade over document store for deployable management
 *
 * Deployables are optional groupings for constructs that help organize them
 * into logical deployable units (API, database, CDK stack, UI app, etc.)
 *
 * Note: All data is stored in the unified document store. This class
 * provides a familiar API for components while delegating to the store.
 */
class DeployableRegistry {
  private static instance: DeployableRegistry;

  private constructor() {}

  static getInstance(): DeployableRegistry {
    if (!DeployableRegistry.instance) {
      DeployableRegistry.instance = new DeployableRegistry();
    }
    return DeployableRegistry.instance;
  }

  /**
   * Get all deployables
   */
  getAll(): Deployable[] {
    return getDocumentState().deployables;
  }

  /**
   * Get a deployable by ID
   */
  get(id: string): Deployable | undefined {
    return getDocumentState().getDeployable(id);
  }

  /**
   * Add a new deployable
   */
  add(name: string, description: string, color?: string): Deployable {
    return getDocumentState().addDeployable({ name, description, color });
  }

  /**
   * Update an existing deployable
   */
  update(id: string, updates: Partial<Omit<Deployable, 'id'>>): Deployable | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;

    getDocumentState().updateDeployable(id, updates);
    return this.get(id);
  }

  /**
   * Remove a deployable
   */
  remove(id: string): boolean {
    return getDocumentState().removeDeployable(id);
  }

  /**
   * Save deployables to localStorage
   * @deprecated Auto-saved by document store
   */
  saveToLocalStorage(): void {
    // No-op: Auto-saved by document store
  }

  /**
   * Load deployables from localStorage
   * @deprecated Loaded by document store on init
   */
  loadFromLocalStorage(): number {
    // No-op: Loaded by document store on init
    return this.getAll().length;
  }

  /**
   * Clear all deployables
   */
  clear(): void {
    getDocumentState().setDeployables([]);
  }

  /**
   * Import deployables - clears existing and replaces with new ones
   * Used when importing a .carta project file
   */
  importDeployables(deployables: Deployable[]): number {
    // Clear existing deployables
    this.clear();

    let count = 0;
    for (const deployable of deployables) {
      if (this.validateDeployable(deployable)) {
        // Use setDeployables to add with existing IDs (import preserves IDs)
        getDocumentState().setDeployables([...getDocumentState().deployables, deployable]);
        count++;
      }
    }

    return count;
  }

  /**
   * Validate a deployable structure
   */
  private validateDeployable(deployable: unknown): deployable is Deployable {
    if (!deployable || typeof deployable !== 'object') return false;

    const d = deployable as Record<string, unknown>;

    return (
      typeof d.id === 'string' &&
      typeof d.name === 'string' &&
      typeof d.description === 'string' &&
      (d.color === undefined || typeof d.color === 'string')
    );
  }
}

// Export singleton instance
export const deployableRegistry = DeployableRegistry.getInstance();
export default deployableRegistry;
