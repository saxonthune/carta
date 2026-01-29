import type { Node, Edge } from '@xyflow/react';
import type { ConstructNodeData, CompilationFormat, Deployable, ConstructSchema } from '../types';
import { formatJSON } from './formatters/json';

type FormatterFn = (
  nodes: ConstructNodeData[],
  edges: Array<{ source: string; target: string }>,
  schema: any,
  allNodes?: ConstructNodeData[]
) => string;

/**
 * Format handlers registry
 */
const formatters: Record<CompilationFormat, FormatterFn> = {
  json: formatJSON,
  custom: formatJSON,  // Custom uses JSON by default, can use template if provided
};

/**
 * Options for compilation - all dependencies passed explicitly
 */
export interface CompileOptions {
  schemas: ConstructSchema[];
  deployables: Deployable[];
}

/**
 * CompilerEngine
 *
 * Transforms the visual graph (nodes + edges) into text output.
 * Each construct type can have its own compilation format.
 *
 * This is a pure function - all dependencies are passed as parameters,
 * making it easy to test and reason about.
 */
export class CompilerEngine {
  /**
   * Compile all nodes to a single output string
   * @param nodes - Graph nodes to compile
   * @param edges - Graph edges
   * @param options - Schemas and deployables for context
   */
  compile(nodes: Node[], edges: Edge[], options: CompileOptions): string {
    const { schemas, deployables } = options;

    // Helper to find schema by type
    const getSchema = (type: string) => schemas.find(s => s.type === type);

    // Helper to find deployable by id
    const getDeployable = (id: string) => deployables.find(d => d.id === id);
    // Filter out virtual parent nodes (they are visual-only, not compiled)
    const compilableNodes = nodes.filter(n => n.type !== 'virtual-parent');

    const sections: string[] = [];

    // Convert edges to simple format
    const simpleEdges = edges.map(e => ({
      source: e.source,
      target: e.target,
    }));

    // Add deployables section at the top if any exist
    const deployablesSection = this.compileDeployables(compilableNodes, deployables);
    if (deployablesSection) {
      sections.push(deployablesSection);
    }

    // Add schemas section listing all used construct types
    const schemasSection = this.compileSchemas(compilableNodes, getSchema);
    if (schemasSection) {
      sections.push(schemasSection);
    }

    // Enhance nodes with relationship metadata
    const nodesWithRelationships = this.addRelationshipMetadata(compilableNodes, edges);

    // Extract all node data for passing to formatters
    const allNodeData = nodesWithRelationships.map(n => n.data as ConstructNodeData);

    // Group nodes by deployment group
    const grouped = this.groupByDeployment(nodesWithRelationships);

    for (const [deploymentKey, deploymentNodes] of Object.entries(grouped)) {
      const deploymentName = this.getDeploymentName(deploymentKey, getDeployable);
      const header = `# Deployment: ${deploymentName}`;

      // Group by type within deployment
      const typeGroups = this.groupByType(deploymentNodes);
      const typeOutputs: string[] = [];

      for (const [type, typeNodes] of Object.entries(typeGroups)) {
        const schema = getSchema(type);

        if (!schema) {
          // Unknown type - use JSON
          typeOutputs.push(`## Type: ${type}\n${formatJSON(typeNodes, simpleEdges, {} as any, allNodeData)}`);
          continue;
        }

        const formatter = formatters[schema.compilation.format] || formatJSON;
        const typeHeader = `## ${schema.displayName}`;
        const content = formatter(typeNodes, simpleEdges, schema, allNodeData);

        if (content.trim()) {
          typeOutputs.push(`${typeHeader}\n\n${content}`);
        }
      }

      if (typeOutputs.length > 0) {
        sections.push(`${header}\n\n${typeOutputs.join('\n\n')}`);
      }
    }

    if (sections.length === 0) {
      return '# No constructs to compile\n\nAdd some constructs to your canvas to generate output.';
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Compile deployables section
   * Outputs metadata about deployable groupings used in the diagram
   */
  private compileDeployables(nodes: Node[], allDeployables: Deployable[]): string | null {
    if (allDeployables.length === 0) return null;

    // Find which deployables are actually used
    const usedDeployableIds = new Set<string>();
    for (const node of nodes) {
      const data = node.data as ConstructNodeData;
      if (data.deployableId) {
        usedDeployableIds.add(data.deployableId);
      }
    }

    // Filter to only include used deployables, but show all if none are explicitly assigned
    const deployablesToShow: Deployable[] = usedDeployableIds.size > 0
      ? allDeployables.filter(d => usedDeployableIds.has(d.id))
      : allDeployables;

    if (deployablesToShow.length === 0) return null;

    const deployablesJson = JSON.stringify(
      {
        deployables: deployablesToShow.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
        })),
      },
      null,
      2
    );

    return `# Deployables

The following deployables define logical groupings. When generating code, group constructs belonging to the same deployable together.

\`\`\`json
${deployablesJson}
\`\`\``;
  }

  /**
   * Compile schemas section
   * Lists all used construct schemas and their descriptions
   */
  private compileSchemas(
    nodes: Node[],
    getSchema: (type: string) => ConstructSchema | undefined
  ): string | null {
    // Find all unique construct types used
    const usedTypes = new Set<string>();
    for (const node of nodes) {
      const data = node.data as ConstructNodeData;
      if (data.constructType) {
        usedTypes.add(data.constructType);
      }
    }

    if (usedTypes.size === 0) return null;

    // Get schemas and their descriptions
    const schemas = Array.from(usedTypes)
      .map(type => {
        const schema = getSchema(type);
        return schema ? {
          type: schema.type,
          displayName: schema.displayName,
          semanticDescription: schema.semanticDescription || 'No description provided',
          ...(schema.ports && schema.ports.length > 0 && {
            ports: schema.ports.map(p => ({
              id: p.id,
              label: p.label,
              portType: p.portType,
              ...(p.semanticDescription && { semanticDescription: p.semanticDescription }),
            }))
          }),
        } : null;
      })
      .filter(s => s !== null)
      .sort((a, b) => {
        // Sort by display name
        return a!.displayName.localeCompare(b!.displayName);
      });

    if (schemas.length === 0) return null;

    const schemasJson = JSON.stringify(
      {
        schemas: schemas,
      },
      null,
      2
    );

    return `# Construct Schemas

The following construct types are used in this architecture. These definitions help AI tools understand the purpose and structure of each construct.

\`\`\`json
${schemasJson}
\`\`\``;
  }

  /**
   * Group nodes by deployment group
   */
  private groupByDeployment(nodes: Node[]): Record<string, Node[]> {
    const grouped: Record<string, Node[]> = {};

    for (const node of nodes) {
      const data = node.data as ConstructNodeData;
      const deploymentKey = data.deployableId || '__unassigned__';

      if (!grouped[deploymentKey]) {
        grouped[deploymentKey] = [];
      }
      grouped[deploymentKey].push(node);
    }

    return grouped;
  }

  /**
   * Get human-readable deployment name
   */
  private getDeploymentName(
    deploymentKey: string,
    getDeployable: (id: string) => Deployable | undefined
  ): string {
    if (deploymentKey === '__unassigned__') {
      return 'Unassigned';
    }

    const deployable = getDeployable(deploymentKey);
    return deployable ? deployable.name : deploymentKey;
  }

  /**
   * Group nodes by their construct type
   */
  private groupByType(nodes: Node[]): Record<string, ConstructNodeData[]> {
    const grouped: Record<string, ConstructNodeData[]> = {};

    for (const node of nodes) {
      const data = node.data as ConstructNodeData;
      if (!data.constructType) continue;

      if (!grouped[data.constructType]) {
        grouped[data.constructType] = [];
      }
      grouped[data.constructType].push(data);
    }

    return grouped;
  }

  /**
   * Add relationship metadata to nodes based on edges
   * This adds references and referencedBy arrays to each construct
   */
  private addRelationshipMetadata(nodes: Node[], edges: Edge[]): Node[] {
    // Create a map of nodeId to semanticId for quick lookup
    const nodeIdToSemanticId = new Map<string, string>();
    for (const node of nodes) {
      const data = node.data as ConstructNodeData;
      nodeIdToSemanticId.set(node.id, data.semanticId);
    }

    // Create maps for relationships
    const referencesMap = new Map<string, string[]>();
    const referencedByMap = new Map<string, string[]>();

    // Initialize empty arrays for all nodes
    for (const node of nodes) {
      referencesMap.set(node.id, []);
      referencedByMap.set(node.id, []);
    }

    // Analyze edges and build relationships
    for (const edge of edges) {
      const sourceSemanticId = nodeIdToSemanticId.get(edge.source);
      const targetSemanticId = nodeIdToSemanticId.get(edge.target);

      if (sourceSemanticId && targetSemanticId) {
        // Source references target
        const sourceRefs = referencesMap.get(edge.source) || [];
        if (!sourceRefs.includes(targetSemanticId)) {
          sourceRefs.push(targetSemanticId);
        }
        referencesMap.set(edge.source, sourceRefs);

        // Target is referenced by source
        const targetRefs = referencedByMap.get(edge.target) || [];
        if (!targetRefs.includes(sourceSemanticId)) {
          targetRefs.push(sourceSemanticId);
        }
        referencedByMap.set(edge.target, targetRefs);
      }
    }

    // Return nodes with relationship metadata added
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        references: referencesMap.get(node.id)?.length ? referencesMap.get(node.id) : undefined,
        referencedBy: referencedByMap.get(node.id)?.length ? referencedByMap.get(node.id) : undefined,
      },
    }));
  }

  /**
   * Get available formats
   */
  getAvailableFormats(): CompilationFormat[] {
    return Object.keys(formatters) as CompilationFormat[];
  }
}

// Export singleton instance
export const compiler = new CompilerEngine();
export default compiler;
