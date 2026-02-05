import type {
  CompilerNode,
  CompilerEdge,
  ConstructNodeData,
  CompilationFormat,
  ConstructSchema,
  OrganizerNodeData,
} from '@carta/domain';
import { formatJSON } from './formatters/json.js';

type FormatterFn = (
  nodes: ConstructNodeData[],
  edges: Array<{ source: string; target: string }>,
  schema: ConstructSchema,
  allNodes?: ConstructNodeData[]
) => string;

/**
 * Format handlers registry
 */
const formatters: Record<CompilationFormat, FormatterFn> = {
  json: formatJSON,
  custom: formatJSON,
};

/**
 * Options for compilation - all dependencies passed explicitly
 */
export interface CompileOptions {
  schemas: ConstructSchema[];
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
   */
  compile(nodes: CompilerNode[], edges: CompilerEdge[], options: CompileOptions): string {
    const { schemas } = options;

    const getSchema = (type: string) => schemas.find(s => s.type === type);

    // Filter out visual-only nodes (organizers)
    const compilableNodes = nodes.filter(n => n.type !== 'organizer');

    const sections: string[] = [];

    const simpleEdges = edges.map(e => ({
      source: e.source,
      target: e.target,
    }));

    // Add organizers section if any exist
    const organizersSection = this.compileOrganizers(nodes);
    if (organizersSection) {
      sections.push(organizersSection);
    }

    // Add schemas section listing all used construct types
    const schemasSection = this.compileSchemas(compilableNodes, getSchema);
    if (schemasSection) {
      sections.push(schemasSection);
    }

    // Enhance nodes with relationship metadata
    const nodesWithRelationships = this.addRelationshipMetadata(compilableNodes, edges);

    const allNodeData = nodesWithRelationships.map(n => n.data);

    // Group nodes by type
    const typeGroups = this.groupByType(nodesWithRelationships);
    const typeOutputs: string[] = [];

    for (const [type, typeNodes] of Object.entries(typeGroups)) {
      const schema = getSchema(type);

      if (!schema) {
        typeOutputs.push(`## Type: ${type}\n${formatJSON(typeNodes, simpleEdges, {} as ConstructSchema, allNodeData)}`);
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
      sections.push(`# Constructs\n\n${typeOutputs.join('\n\n')}`);
    }

    if (sections.length === 0) {
      return '# No constructs to compile\n\nAdd some constructs to your canvas to generate output.';
    }

    return sections.join('\n\n---\n\n');
  }

  private compileOrganizers(allNodes: CompilerNode[]): string | null {
    // Find organizer nodes
    const organizerNodes = allNodes.filter(n => n.type === 'organizer');
    if (organizerNodes.length === 0) return null;

    // Build organizer membership from parentId relationships
    const organizerData = organizerNodes.map(g => {
      const data = g.data as unknown as OrganizerNodeData;
      const members = allNodes
        .filter(n => (n as { parentId?: string }).parentId === g.id && n.type !== 'organizer')
        .map(n => n.data.semanticId)
        .filter((id): id is string => !!id);

      return {
        id: g.id,
        name: data.name,
        ...(data.description && { description: data.description }),
        layout: data.layout || 'freeform',
        members,
      };
    });

    const organizersJson = JSON.stringify({ organizers: organizerData }, null, 2);

    return `# Organizers

Organizers group constructs visually on the canvas. Unlike connections (which model semantic relationships via ports), organizers have no ports and represent user-defined collections. Use these when interacting with grouped items.

\`\`\`json
${organizersJson}
\`\`\``;
  }

  private compileSchemas(
    nodes: CompilerNode[],
    getSchema: (type: string) => ConstructSchema | undefined
  ): string | null {
    const usedTypes = new Set<string>();
    for (const node of nodes) {
      if (node.data.constructType) {
        usedTypes.add(node.data.constructType);
      }
    }

    if (usedTypes.size === 0) return null;

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
      .sort((a, b) => a!.displayName.localeCompare(b!.displayName));

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

  private groupByType(nodes: CompilerNode[]): Record<string, ConstructNodeData[]> {
    const grouped: Record<string, ConstructNodeData[]> = {};

    for (const node of nodes) {
      if (!node.data.constructType) continue;

      if (!grouped[node.data.constructType]) {
        grouped[node.data.constructType] = [];
      }
      grouped[node.data.constructType].push(node.data);
    }

    return grouped;
  }

  private addRelationshipMetadata(nodes: CompilerNode[], edges: CompilerEdge[]): CompilerNode[] {
    const nodeIdToSemanticId = new Map<string, string>();
    for (const node of nodes) {
      nodeIdToSemanticId.set(node.id, node.data.semanticId);
    }

    const referencesMap = new Map<string, string[]>();
    const referencedByMap = new Map<string, string[]>();

    for (const node of nodes) {
      referencesMap.set(node.id, []);
      referencedByMap.set(node.id, []);
    }

    for (const edge of edges) {
      const sourceSemanticId = nodeIdToSemanticId.get(edge.source);
      const targetSemanticId = nodeIdToSemanticId.get(edge.target);

      if (sourceSemanticId && targetSemanticId) {
        const sourceRefs = referencesMap.get(edge.source) || [];
        if (!sourceRefs.includes(targetSemanticId)) {
          sourceRefs.push(targetSemanticId);
        }
        referencesMap.set(edge.source, sourceRefs);

        const targetRefs = referencedByMap.get(edge.target) || [];
        if (!targetRefs.includes(sourceSemanticId)) {
          targetRefs.push(sourceSemanticId);
        }
        referencedByMap.set(edge.target, targetRefs);
      }
    }

    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        references: referencesMap.get(node.id)?.length ? referencesMap.get(node.id) : undefined,
        referencedBy: referencedByMap.get(node.id)?.length ? referencedByMap.get(node.id) : undefined,
      },
    }));
  }

  getAvailableFormats(): CompilationFormat[] {
    return Object.keys(formatters) as CompilationFormat[];
  }
}

export const compiler = new CompilerEngine();
export default compiler;
export { formatJSON } from './formatters/json.js';
