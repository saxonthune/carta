import type { ConstructNodeData, ConstructSchema, TableRow } from '../../types';

/**
 * OpenAPI Formatter
 * Compiles controller constructs to OpenAPI 3.0 YAML format
 */
export function formatOpenAPI(
  nodes: ConstructNodeData[],
  _edges: Array<{ source: string; target: string }>,
  _schema: ConstructSchema
): string {
  if (nodes.length === 0) return '';

  const paths: string[] = [];

  for (const node of nodes) {
    const route = (node.values.route as string) || '/api/unknown';
    const verb = ((node.values.verb as string) || 'GET').toLowerCase();
    const summary = (node.values.summary as string) || node.name;
    const params = (node.values.params as TableRow[]) || [];
    const responseType = (node.values.responseType as string) || 'object';

    // Build parameters
    const paramLines: string[] = [];
    for (const param of params) {
      if (param.name) {
        paramLines.push(`      - name: ${param.name}`);
        paramLines.push(`        in: ${param.in || 'query'}`);
        paramLines.push(`        required: ${param.required || false}`);
        paramLines.push(`        schema:`);
        paramLines.push(`          type: ${param.type || 'string'}`);
      }
    }

    // Build path entry
    const pathEntry = [
      `  ${route}:`,
      `    ${verb}:`,
      `      summary: ${summary}`,
      `      operationId: ${node.name.replace(/\s+/g, '_').toLowerCase()}`,
    ];

    if (paramLines.length > 0) {
      pathEntry.push(`      parameters:`);
      pathEntry.push(...paramLines);
    }

    pathEntry.push(`      responses:`);
    pathEntry.push(`        '200':`);
    pathEntry.push(`          description: Successful response`);
    pathEntry.push(`          content:`);
    pathEntry.push(`            application/json:`);
    pathEntry.push(`              schema:`);
    pathEntry.push(`                type: ${responseType}`);

    paths.push(pathEntry.join('\n'));
  }

  return `openapi: 3.0.0
info:
  title: Generated API
  version: 1.0.0
paths:
${paths.join('\n')}`;
}

export default formatOpenAPI;
