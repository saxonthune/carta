import { registry } from './registry';
import type { ConstructSchema } from './types';

const SCHEMAS_KEY = 'carta-schemas';

/**
 * Schema Storage - Handles persistence of all schemas
 */
export const schemaStorage = {
  /**
   * Save all schemas to localStorage
   */
  saveToLocalStorage(): void {
    try {
      const schemas = registry.getAllSchemas();
      localStorage.setItem(SCHEMAS_KEY, JSON.stringify(schemas));
    } catch (error) {
      console.error('Failed to save schemas to localStorage:', error);
    }
  },

  /**
   * Load schemas from localStorage and register them
   */
  loadFromLocalStorage(): number {
    try {
      const saved = localStorage.getItem(SCHEMAS_KEY);
      if (!saved) return 0;

      const schemas: ConstructSchema[] = JSON.parse(saved);
      let count = 0;

      for (const schema of schemas) {
        registry.registerSchema(schema);
        count++;
      }

      return count;
    } catch (error) {
      console.error('Failed to load schemas from localStorage:', error);
      return 0;
    }
  },

  /**
   * Check if any schemas are stored in localStorage
   */
  hasStoredSchemas(): boolean {
    try {
      const saved = localStorage.getItem(SCHEMAS_KEY);
      return saved !== null && saved.length > 0;
    } catch (error) {
      console.error('Failed to check stored schemas:', error);
      return false;
    }
  },

  /**
   * Clear schemas from localStorage
   */
  clearLocalStorage(): void {
    localStorage.removeItem(SCHEMAS_KEY);
  },

  /**
   * Export schemas to a downloadable JSON file
   */
  exportToFile(filename: string = 'construct-schemas.json'): void {
    const json = registry.exportSchemas();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Import schemas from a JSON file
   */
  importFromFile(file: File): Promise<{ success: boolean; count: number; errors: string[] }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const result = registry.importSchemas(content);
        
        if (result.success) {
          this.saveToLocalStorage(); // Persist imported schemas
        }
        
        resolve(result);
      };

      reader.onerror = () => {
        resolve({ success: false, count: 0, errors: ['Failed to read file'] });
      };

      reader.readAsText(file);
    });
  },

  /**
   * Import schemas from a JSON string
   */
  importFromString(json: string): { success: boolean; count: number; errors: string[] } {
    const result = registry.importSchemas(json);
    
    if (result.success) {
      this.saveToLocalStorage();
    }
    
    return result;
  }
};

export default schemaStorage;
