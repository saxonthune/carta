import type { ConstructNodeData, ConstructSchema } from '../../types';

/**
 * DBML Formatter
 * Compiles database and table constructs to DBML format
 *
 * DBML (Database Markup Language) is a DSL for defining database schemas.
 * See: https://dbml.dbdiagram.io/docs/
 */
export function formatDBML(
  nodes: ConstructNodeData[],
  edges: Array<{ source: string; target: string }>,
  schema: ConstructSchema,
  allNodes?: ConstructNodeData[]
): string {
  // Handle database nodes - output project header
  if (schema.type === 'database') {
    return formatDatabases(nodes);
  }

  // Handle table nodes - output table definitions and refs
  if (schema.type === 'table') {
    return formatTables(nodes, edges, allNodes);
  }
  
  // Fallback for unknown types
  return '';
}

/**
 * Format database nodes as DBML project headers
 */
function formatDatabases(nodes: ConstructNodeData[]): string {
  const outputs: string[] = [];
  
  for (const node of nodes) {
    const engine = (node.values.engine as string) || 'PostgreSQL';
    const note = node.values.note as string;
    const dbName = node.name.toLowerCase().replace(/\s+/g, '_');
    
    const lines = [
      `Project ${dbName} {`,
      `  database_type: '${engine}'`,
    ];
    
    if (note) {
      lines.push(`  Note: '${note}'`);
    }
    
    lines.push('}');
    outputs.push(lines.join('\n'));
  }
  
  return outputs.join('\n\n');
}

/**
 * Format table nodes as DBML table definitions
 */
function formatTables(
  nodes: ConstructNodeData[],
  edges: Array<{ source: string; target: string }>,
  allNodes?: ConstructNodeData[]
): string {
  const outputs: string[] = [];
  
  // Create a map of node names for reference lookup
  const nodeNameMap = new Map<string, string>();
  for (const node of nodes) {
    // We need the node ID, but we only have the data here
    // Use the name as a fallback identifier
    nodeNameMap.set(node.name, node.name);
  }
  
  for (const node of nodes) {
    const tableName = node.name.toLowerCase().replace(/\s+/g, '_');
    const indexes = node.values.indexes as string;

    // Find child column constructs
    const childColumns = allNodes
      ? allNodes.filter(n =>
          n.constructType === 'column' &&
          n.connections?.some(c => c.targetSemanticId === node.semanticId && c.portId === 'parent')
        )
      : [];

    const lines = [`Table ${tableName} {`];

    // Add columns from child constructs
    for (const col of childColumns) {
      const colName = col.values.name as string;
      if (!colName) continue;

      const colType = (col.values.dataType as string) || 'varchar';
      const constraints: string[] = [];

      if (col.values.primaryKey) {
        constraints.push('pk');
      }
      if (col.values.nullable === false) {
        constraints.push('not null');
      }

      const constraintStr = constraints.length > 0
        ? ` [${constraints.join(', ')}]`
        : '';

      lines.push(`  ${colName} ${colType}${constraintStr}`);
    }
    
    // Add indexes if specified
    if (indexes) {
      lines.push('');
      lines.push('  indexes {');
      lines.push(`    ${indexes}`);
      lines.push('  }');
    }
    
    lines.push('}');
    outputs.push(lines.join('\n'));
  }
  
  // Generate Ref statements for table-to-table edges
  // These represent foreign key relationships
  const refs = generateRefs(nodes, edges);
  if (refs) {
    outputs.push('');
    outputs.push('// References');
    outputs.push(refs);
  }
  
  return outputs.join('\n\n');
}

/**
 * Generate DBML Ref statements from edges between tables
 */
function generateRefs(
  _nodes: ConstructNodeData[],
  _edges: Array<{ source: string; target: string }>
): string {
  // For now, we don't have node IDs in the formatter context
  // This would need enhancement to map edges to actual table names
  // Placeholder for future implementation when we have full node context
  
  // Filter edges that connect tables (source table -> target table)
  // Convention: source.{target}_id > target.id
  const refs: string[] = [];
  
  // This is a simplified version - in a full implementation,
  // you'd need the node IDs to properly map edges to table names
  
  return refs.join('\n');
}

export default formatDBML;
