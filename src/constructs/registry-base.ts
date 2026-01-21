import { v4 as uuidv4 } from 'uuid';

/**
 * Base interface for all registry items
 */
export interface RegistryItem {
  id: string;
  name: string;
  description?: string;
}

/**
 * Generic registry interface
 */
export interface Registry<T extends RegistryItem> {
  get(id: string): T | undefined;
  getAll(): T[];
  add(item: Omit<T, 'id'>): T;
  update(id: string, updates: Partial<T>): T | undefined;
  remove(id: string): boolean;
  clear(): void;
}

/**
 * BaseRegistry - Abstract base class for registries with localStorage persistence
 *
 * Provides common CRUD operations and optional persistence for registry items.
 */
export abstract class BaseRegistry<T extends RegistryItem> implements Registry<T> {
  protected items: Map<string, T> = new Map();
  protected abstract storageKey: string;
  protected persistEnabled: boolean = true;

  constructor(persistEnabled: boolean = true) {
    this.persistEnabled = persistEnabled;
  }

  /**
   * Load items from localStorage (call in subclass constructor after storageKey is set)
   */
  protected loadFromStorage(): void {
    if (!this.persistEnabled || typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as T[];
        for (const item of parsed) {
          if (this.validateItem(item)) {
            this.items.set(item.id, item);
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to load ${this.storageKey} from storage:`, e);
    }
  }

  /**
   * Save items to localStorage
   */
  protected saveToStorage(): void {
    if (!this.persistEnabled || typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.getAll()));
    } catch (e) {
      console.warn(`Failed to save ${this.storageKey} to storage:`, e);
    }
  }

  /**
   * Validate an item structure (override in subclasses for specific validation)
   */
  protected validateItem(item: unknown): item is T {
    if (!item || typeof item !== 'object') return false;
    const i = item as Record<string, unknown>;
    return typeof i.id === 'string' && typeof i.name === 'string';
  }

  /**
   * Get an item by ID
   */
  get(id: string): T | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items
   */
  getAll(): T[] {
    return Array.from(this.items.values());
  }

  /**
   * Add a new item (generates ID automatically)
   */
  add(item: Omit<T, 'id'>): T {
    const newItem = { ...item, id: uuidv4() } as T;
    this.items.set(newItem.id, newItem);
    this.saveToStorage();
    return newItem;
  }

  /**
   * Update an existing item
   */
  update(id: string, updates: Partial<T>): T | undefined {
    const existing = this.items.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates, id } as T; // Preserve original ID
    this.items.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Remove an item by ID
   */
  remove(id: string): boolean {
    const deleted = this.items.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear();
    this.saveToStorage();
  }

  /**
   * Check if an item exists
   */
  has(id: string): boolean {
    return this.items.has(id);
  }

  /**
   * Get the count of items
   */
  get size(): number {
    return this.items.size;
  }
}
