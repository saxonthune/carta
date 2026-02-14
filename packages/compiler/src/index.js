import { formatJSON } from './formatters/json.js';
/**
 * Format handlers registry
 */
const formatters = {
    json: formatJSON,
    custom: formatJSON,
};
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
    compile(nodes, edges, options) {
        const { schemas, deployables } = options;
        const getSchema = (type) => schemas.find(s => s.type === type);
        const getDeployable = (id) => deployables.find(d => d.id === id);
        // Filter out visual-only nodes (organizers)
        const compilableNodes = nodes.filter(n => n.type !== 'organizer');
        const sections = [];
        const simpleEdges = edges.map(e => ({
            source: e.source,
            target: e.target,
        }));
        // Add organizers section if any exist
        const organizersSection = this.compileOrganizers(nodes);
        if (organizersSection) {
            sections.push(organizersSection);
        }
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
        const allNodeData = nodesWithRelationships.map(n => n.data);
        // Group nodes by deployment group
        const grouped = this.groupByDeployment(nodesWithRelationships);
        for (const [deploymentKey, deploymentNodes] of Object.entries(grouped)) {
            const deploymentName = this.getDeploymentName(deploymentKey, getDeployable);
            const header = `# Deployment: ${deploymentName}`;
            const typeGroups = this.groupByType(deploymentNodes);
            const typeOutputs = [];
            for (const [type, typeNodes] of Object.entries(typeGroups)) {
                const schema = getSchema(type);
                if (!schema) {
                    typeOutputs.push(`## Type: ${type}\n${formatJSON(typeNodes, simpleEdges, {}, allNodeData)}`);
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
    compileOrganizers(allNodes) {
        // Find organizer nodes
        const organizerNodes = allNodes.filter(n => n.type === 'organizer');
        if (organizerNodes.length === 0)
            return null;
        // Build organizer membership from parentId relationships
        const organizerData = organizerNodes.map(g => {
            const data = g.data;
            const members = allNodes
                .filter(n => n.parentId === g.id && n.type !== 'organizer')
                .map(n => n.data.semanticId)
                .filter((id) => !!id);
            return {
                id: g.id,
                name: data.name,
                members,
            };
        });
        const organizersJson = JSON.stringify({ organizers: organizerData }, null, 2);
        return `# Organizers

The following organizers group constructs on the canvas. These are for organization purposes only.

\`\`\`json
${organizersJson}
\`\`\``;
    }
    compileDeployables(nodes, allDeployables) {
        if (allDeployables.length === 0)
            return null;
        const usedDeployableIds = new Set();
        for (const node of nodes) {
            if (node.data.deployableId) {
                usedDeployableIds.add(node.data.deployableId);
            }
        }
        const deployablesToShow = usedDeployableIds.size > 0
            ? allDeployables.filter(d => usedDeployableIds.has(d.id))
            : allDeployables;
        if (deployablesToShow.length === 0)
            return null;
        const deployablesJson = JSON.stringify({
            deployables: deployablesToShow.map(d => ({
                id: d.id,
                name: d.name,
                description: d.description,
            })),
        }, null, 2);
        return `# Deployables

The following deployables define logical groupings. When generating code, group constructs belonging to the same deployable together.

\`\`\`json
${deployablesJson}
\`\`\``;
    }
    compileSchemas(nodes, getSchema) {
        const usedTypes = new Set();
        for (const node of nodes) {
            if (node.data.constructType) {
                usedTypes.add(node.data.constructType);
            }
        }
        if (usedTypes.size === 0)
            return null;
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
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
        if (schemas.length === 0)
            return null;
        const schemasJson = JSON.stringify({
            schemas: schemas,
        }, null, 2);
        return `# Construct Schemas

The following construct types are used in this architecture. These definitions help AI tools understand the purpose and structure of each construct.

\`\`\`json
${schemasJson}
\`\`\``;
    }
    groupByDeployment(nodes) {
        const grouped = {};
        for (const node of nodes) {
            const deploymentKey = node.data.deployableId || '__unassigned__';
            if (!grouped[deploymentKey]) {
                grouped[deploymentKey] = [];
            }
            grouped[deploymentKey].push(node);
        }
        return grouped;
    }
    getDeploymentName(deploymentKey, getDeployable) {
        if (deploymentKey === '__unassigned__') {
            return 'Unassigned';
        }
        const deployable = getDeployable(deploymentKey);
        return deployable ? deployable.name : deploymentKey;
    }
    groupByType(nodes) {
        const grouped = {};
        for (const node of nodes) {
            if (!node.data.constructType)
                continue;
            if (!grouped[node.data.constructType]) {
                grouped[node.data.constructType] = [];
            }
            grouped[node.data.constructType].push(node.data);
        }
        return grouped;
    }
    addRelationshipMetadata(nodes, edges) {
        const nodeIdToSemanticId = new Map();
        for (const node of nodes) {
            nodeIdToSemanticId.set(node.id, node.data.semanticId);
        }
        const referencesMap = new Map();
        const referencedByMap = new Map();
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
    getAvailableFormats() {
        return Object.keys(formatters);
    }
}
export const compiler = new CompilerEngine();
export default compiler;
export { formatJSON } from './formatters/json.js';
