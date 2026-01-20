import type { Deployable } from './types';

const DEPLOYABLES_KEY = 'carta-deployables';

/**
 * Generate a simple UUID for deployable IDs
 */
function generateId(): string {
  return 'dep_' + Math.random().toString(36).substring(2, 11);
}


/**
 * DeployableRegistry - Singleton that manages deployables
 * 
 * Deployables are optional groupings for constructs that help organize them
 * into logical deployable units (API, database, CDK stack, UI app, etc.)
 */
class DeployableRegistry {
  private static instance: DeployableRegistry;
  private deployables: Map<string, Deployable> = new Map();

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
    return Array.from(this.deployables.values());
  }

  /**
   * Get a deployable by ID
   */
  get(id: string): Deployable | undefined {
    return this.deployables.get(id);
  }

  /**
   * Add a new deployable
   */
  add(name: string, description: string, color?: string): Deployable {
    const id = generateId();
    const deployableColor = color || this.generateColor();
    const deployable: Deployable = { id, name, description, color: deployableColor };
    this.deployables.set(id, deployable);
    this.saveToLocalStorage();
    return deployable;
  }

  /**
   * Update an existing deployable
   */
  update(id: string, updates: Partial<Omit<Deployable, 'id'>>): Deployable | undefined {
    const existing = this.deployables.get(id);
    if (!existing) return undefined;

    const updated: Deployable = {
      ...existing,
      ...updates,
    };
    this.deployables.set(id, updated);
    this.saveToLocalStorage();
    return updated;
  }

  /**
   * Remove a deployable
   */
  remove(id: string): boolean {
    const deleted = this.deployables.delete(id);
    if (deleted) {
      this.saveToLocalStorage();
    }
    return deleted;
  }

  /**
   * Save deployables to localStorage
   */
  saveToLocalStorage(): void {
    try {
      const deployables = this.getAll();
      localStorage.setItem(DEPLOYABLES_KEY, JSON.stringify(deployables));
    } catch (error) {
      console.error('Failed to save deployables to localStorage:', error);
    }
  }

  /**
   * Load deployables from localStorage
   */
  loadFromLocalStorage(): number {
    try {
      const saved = localStorage.getItem(DEPLOYABLES_KEY);
      if (!saved) return 0;

      const deployables: Deployable[] = JSON.parse(saved);
      let count = 0;

      for (const deployable of deployables) {
        if (this.validateDeployable(deployable)) {
          // Ensure deployable has a color
          const deployableWithColor = deployable.color
            ? deployable
            : { ...deployable, color: this.generateColor() };
          this.deployables.set(deployable.id, deployableWithColor);
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error('Failed to load deployables from localStorage:', error);
      return 0;
    }
  }

  /**
   * Generate a color for deployable visualization
   */
  private generateColor(): string {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#f97316', // orange
      '#ec4899', // pink
      '#6b7280', // gray
    ];
    return colors[Math.floor(Math.random() * colors.length)];
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

  /**
   * Clear all deployables
   */
  clear(): void {
    this.deployables.clear();
    localStorage.removeItem(DEPLOYABLES_KEY);
  }

  /**
   * Import deployables - clears existing and replaces with new ones
   * Used when importing a .carta project file
   */
  importDeployables(deployables: Deployable[]): number {
    // Clear existing deployables
    this.deployables.clear();
    
    let count = 0;
    for (const deployable of deployables) {
      if (this.validateDeployable(deployable)) {
        this.deployables.set(deployable.id, deployable);
        count++;
      }
    }
    
    this.saveToLocalStorage();
    return count;
  }
}

// Export singleton instance
export const deployableRegistry = DeployableRegistry.getInstance();
export default deployableRegistry;
