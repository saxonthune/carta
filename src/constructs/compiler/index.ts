import type { Node, Edge } from '@xyflow/react';
import { registry } from '../registry';
import { deployableRegistry } from '../deployables';
import type { ConstructNodeData, CompilationFormat, Deployable } from '../types';
import { formatOpenAPI } from './formatters/openapi';
import { formatJSON } from './formatters/json';
import { formatDBML } from './formatters/dbml';

type FormatterFn = (
  nodes: ConstructNodeData[],
  edges: Array<{ source: string; target: string }>,
  schema: any
) => string;

/**
 * Format handlers registry
 */
const formatters: Record<CompilationFormat, FormatterFn> = {
  openapi: formatOpenAPI,
  dbml: formatDBML,
  json: formatJSON,
  custom: formatJSON,  // Custom uses JSON by default, can use template if provided
};

/**
 * CompilerEngine
 * 
 * Transforms the visual graph (nodes + edges) into text output.
 * Each construct type can have its own compilation format.
 */
export class CompilerEngine {
  /**
   * Compile all nodes to a single output string
   */
  compile(nodes: Node[], edges: Edge[]): string {
    const sections: string[] = [];

    // Convert edges to simple format
    const simpleEdges = edges.map(e => ({
      source: e.source,
      target: e.target,
    }));

    // Add deployables section at the top if any exist
    const deployablesSection = this.compileDeployables(nodes);
    if (deployablesSection) {
      sections.push(deployablesSection);
    }

    // Enhance nodes with relationship metadata
    const nodesWithRelationships = this.addRelationshipMetadata(nodes, edges);

    // Group nodes by construct type
    const grouped = this.groupByType(nodesWithRelationships);

    for (const [type, typeNodes] of Object.entries(grouped)) {
      const schema = registry.getSchema(type);
      
      if (!schema) {
        // Unknown type - use JSON
        sections.push(`# Unknown Type: ${type}\n${formatJSON(typeNodes, simpleEdges, {} as any)}`);
        continue;
      }

      const formatter = formatters[schema.compilation.format] || formatJSON;
      const header = schema.compilation.sectionHeader || `# ${schema.displayName}`;
      const content = formatter(typeNodes, simpleEdges, schema);

      if (content.trim()) {
        sections.push(`${header}\n\n${content}`);
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
  private compileDeployables(nodes: Node[]): string | null {
    const allDeployables = deployableRegistry.getAll();
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
      const semanticId = data.semanticId || `${data.constructType}-${data.name.toLowerCase().replace(/\s+/g, '-')}`;
      nodeIdToSemanticId.set(node.id, semanticId);
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
