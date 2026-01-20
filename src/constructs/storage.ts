import { registry } from './registry';
import type { ConstructSchema } from './types';

const USER_SCHEMAS_KEY = 'carta-user-schemas';

/**
 * Schema Storage - Handles persistence of user-defined schemas
 */
export const schemaStorage = {
  /**
   * Save user schemas to localStorage
   */
  saveToLocalStorage(): void {
    try {
      const schemas = registry.getUserSchemas();
      localStorage.setItem(USER_SCHEMAS_KEY, JSON.stringify(schemas));
    } catch (error) {
      console.error('Failed to save schemas to localStorage:', error);
    }
  },

  /**
   * Load user schemas from localStorage and register them
   */
  loadFromLocalStorage(): number {
    try {
      const saved = localStorage.getItem(USER_SCHEMAS_KEY);
      if (!saved) return 0;

      const schemas: ConstructSchema[] = JSON.parse(saved);
      let count = 0;

      for (const schema of schemas) {
        registry.registerUserSchema(schema);
        count++;
      }

      return count;
    } catch (error) {
      console.error('Failed to load schemas from localStorage:', error);
      return 0;
    }
  },

  /**
   * Clear user schemas from localStorage
   */
  clearLocalStorage(): void {
    localStorage.removeItem(USER_SCHEMAS_KEY);
  },

  /**
   * Export schemas to a downloadable JSON file
   */
  exportToFile(filename: string = 'construct-schemas.json'): void {
    const json = registry.exportUserSchemas();
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
        const result = registry.importUserSchemas(content);
        
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
    const result = registry.importUserSchemas(json);
    
    if (result.success) {
      this.saveToLocalStorage();
    }
    
    return result;
  }
};

export default schemaStorage;
