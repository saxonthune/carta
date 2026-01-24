import { registry } from './registry';

/**
 * Schema Storage - File import/export utilities
 *
 * Note: localStorage persistence is now handled by the unified document store.
 * The load/save methods are kept as no-ops for backward compatibility.
 */
export const schemaStorage = {
  /**
   * Save all schemas to localStorage
   * @deprecated Auto-saved by document store
   */
  saveToLocalStorage(): void {
    // No-op: Auto-saved by document store
  },

  /**
   * Load schemas from localStorage and register them
   * @deprecated Loaded by document store on init
   */
  loadFromLocalStorage(): number {
    // No-op: Loaded by document store on init
    return registry.getAllSchemas().length;
  },

  /**
   * Check if any schemas are stored in localStorage
   * @deprecated Use registry.getAllSchemas().length > 0
   */
  hasStoredSchemas(): boolean {
    return registry.getAllSchemas().length > 0;
  },

  /**
   * Clear schemas from localStorage
   * @deprecated Use registry.clearAllSchemas()
   */
  clearLocalStorage(): void {
    registry.clearAllSchemas();
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
    return registry.importSchemas(json);
  }
};

export default schemaStorage;
