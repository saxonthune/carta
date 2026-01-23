import type { PortDefinition } from './types';

/**
 * Default port type definitions
 * These define the connection semantics for port types
 */
export const DEFAULT_PORT_DEFINITIONS: PortDefinition[] = [
  {
    id: 'flow-in',
    label: 'Flow In',
    description: 'Receives flow from flow-out or symmetric ports',
    compatibleWith: ['flow-out', 'symmetric'],
    defaultPosition: 'left',
    color: '#3b82f6',
  },
  {
    id: 'flow-out',
    label: 'Flow Out',
    description: 'Sends flow to flow-in or symmetric ports',
    compatibleWith: ['flow-in', 'symmetric'],
    defaultPosition: 'right',
    color: '#22c55e',
  },
  {
    id: 'parent',
    label: 'Parent',
    description: 'Connected by child ports in hierarchy',
    compatibleWith: ['child', 'symmetric'],
    defaultPosition: 'top',
    color: '#f59e0b',
  },
  {
    id: 'child',
    label: 'Child',
    description: 'Connects to parent ports in hierarchy',
    compatibleWith: ['parent', 'symmetric'],
    defaultPosition: 'bottom',
    color: '#f59e0b',
  },
  {
    id: 'symmetric',
    label: 'Link',
    description: 'Connects to any port type',
    compatibleWith: undefined, // undefined means connects to anything
    defaultPosition: 'right',
    color: '#8b5cf6',
  },
];

/**
 * Port Registry - manages port type definitions and connection validation
 */
export class PortRegistry {
  private definitions: Map<string, PortDefinition>;

  constructor(definitions: PortDefinition[] = DEFAULT_PORT_DEFINITIONS) {
    this.definitions = new Map(definitions.map(d => [d.id, d]));
  }

  /**
   * Get a port definition by ID
   */
  get(id: string): PortDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * Get all port definitions
   */
  getAll(): PortDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Check if two port types can be connected
   */
  canConnect(sourcePortType: string, targetPortType: string): boolean {
    const sourceDef = this.definitions.get(sourcePortType);
    const targetDef = this.definitions.get(targetPortType);

    // If either port type is unknown, deny connection
    if (!sourceDef || !targetDef) return false;

    // Check source -> target compatibility
    if (sourceDef.compatibleWith === undefined) {
      // Source can connect to anything, now check if target accepts source
      if (targetDef.compatibleWith === undefined) {
        return true; // Both accept anything
      }
      return targetDef.compatibleWith.includes(sourcePortType);
    }

    // Check if source explicitly lists target as compatible
    if (sourceDef.compatibleWith.includes(targetPortType)) {
      return true;
    }

    // Check reverse: if target accepts anything
    if (targetDef.compatibleWith === undefined) {
      return true;
    }

    return false;
  }

  /**
   * Get the color for a port type
   */
  getColor(portType: string): string {
    const def = this.definitions.get(portType);
    return def?.color || '#6b7280'; // Default gray
  }

  /**
   * Register a new port definition
   */
  register(definition: PortDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  /**
   * Get the default position for a port type
   */
  getDefaultPosition(portType: string): 'left' | 'right' | 'top' | 'bottom' {
    const def = this.definitions.get(portType);
    return def?.defaultPosition || 'right';
  }
}

// Export singleton instance
export const portRegistry = new PortRegistry();
export default portRegistry;
