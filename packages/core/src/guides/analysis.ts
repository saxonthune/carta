/**
 * Analysis Guide - How to find flaws and make helpful suggestions
 *
 * This guide teaches AI agents how to analyze Carta documents for
 * structural issues, completeness gaps, and code generation readiness.
 */

export const ANALYSIS_GUIDE = `# Carta Analysis Guide

## Overview

This guide helps you analyze Carta documents to find issues, identify gaps, and make helpful suggestions to users. The goal is to help users create complete, well-structured architecture designs that can be successfully translated into working code.

## Structural Health Checks

### 1. Orphan Constructs

**What to look for:** Nodes with no connections at all (empty \`connections\` array AND no incoming connections from other nodes).

**Why it matters:** Orphans are often:
- Forgotten pieces from earlier iterations
- Incomplete work that was never connected
- Copy-paste artifacts

**How to detect:**
\`\`\`javascript
function findOrphans(nodes, edges) {
  const connectedIds = new Set();

  // Collect all nodes that appear in any edge
  edges.forEach(edge => {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  });

  // Find nodes not in any edge
  return nodes.filter(node => !connectedIds.has(node.id));
}
\`\`\`

**Suggestion template:**
> "The construct '[name]' ([semanticId]) isn't connected to anything. Should it relate to [nearby construct], or can it be removed?"

### 2. Missing Parent-Child Relationships

**What to look for:** Constructs that typically need parents but don't have them.

**Common patterns:**
- \`db-attribute\` should have a \`table\` parent
- \`constraint\` should have a \`table\` parent
- \`api-model\` should have a \`controller\` parent
- \`ui-event\` should have a \`ui-screen\` parent

**How to detect:**
\`\`\`javascript
function findMissingParents(nodes) {
  const childTypes = ['db-attribute', 'constraint', 'api-model', 'ui-event'];

  return nodes.filter(node => {
    if (!childTypes.includes(node.data.constructType)) return false;

    const hasParentConnection = node.data.connections?.some(
      conn => conn.portId === 'parent' || conn.portId === 'child'
    );

    return !hasParentConnection;
  });
}
\`\`\`

**Suggestion template:**
> "The [type] '[name]' doesn't belong to any parent. It should probably be a child of a [expected parent type]."

### 3. Disconnected Clusters

**What to look for:** Separate groups of connected constructs with no connections between them.

**Why it matters:** May indicate:
- Incomplete integration between system components
- Separate features that should interact
- Missing API calls or data flows

**Suggestion template:**
> "Your diagram has [N] disconnected groups. The [group A description] and [group B description] aren't connected. Should there be a relationship between them?"

### 4. Incomplete Hierarchies

**What to look for:** Parent constructs with missing or minimal children.

**Common patterns:**
- Tables with only a primary key (missing other columns)
- Databases with no tables
- UI screens with no events
- Controllers with no request/response models

**Suggestion template:**
> "The table '[name]' only has [N] column(s) defined. Based on [related construct], it probably needs additional attributes like [suggestions]."

## Completeness Checks

### 1. Empty Required Fields

**What to look for:** Fields that should have values but don't.

**High-priority fields:**
- \`route\` on controllers (can't generate endpoint without it)
- \`tableName\` on tables
- \`name\` on attributes
- \`dataType\` on attributes

**Suggestion template:**
> "The [type] '[semanticId]' is missing a value for '[field]'. This is needed for [reason]."

### 2. Generic/Placeholder Values

**What to look for:** Values that look like placeholders:
- "TODO"
- "TBD"
- "placeholder"
- Empty strings in important fields
- Default values that weren't customized (e.g., "/api/" as a route)

**Suggestion template:**
> "The [field] '[value]' on [construct] looks like a placeholder. What should it actually be?"

### 3. Schemas Without Instances

**What to look for:** Custom schemas defined but never used.

**Why it matters:** May indicate:
- Forgotten schema definitions
- Planned features not yet modeled
- Over-engineering

**Suggestion template:**
> "You've defined a '[schema name]' construct type but haven't created any instances. Is this schema needed, or should you add some [schema name] constructs?"

### 4. Naming Inconsistencies

**What to look for:**
- Mixed naming conventions (camelCase vs snake_case vs PascalCase)
- Inconsistent pluralization (User vs Users)
- Typos or misspellings

**Suggestion template:**
> "Naming inconsistency: You have both '[name1]' and '[name2]'. Should these use the same convention?"

## Code Generation Readiness

### For API/Backend Generation

**Minimum requirements:**
- [ ] Controllers have \`route\` and \`verb\` defined
- [ ] POST/PUT/PATCH controllers have request models defining accepted fields
- [ ] Controllers specify response type
- [ ] Data flow connects UI → Controller → Database

**Check for POST/PUT without request body:**
\`\`\`javascript
function findControllersNeedingRequestBody(nodes) {
  const mutationVerbs = ['POST', 'PUT', 'PATCH'];

  return nodes.filter(node => {
    if (node.data.constructType !== 'controller') return false;
    if (!mutationVerbs.includes(node.data.values.verb)) return false;

    // Check for api-model child with modelType: 'request'
    const hasRequestModel = nodes.some(other =>
      other.data.constructType === 'api-model' &&
      other.data.values.modelType === 'request' &&
      other.data.connections?.some(conn =>
        conn.targetSemanticId === node.data.semanticId
      )
    );

    return !hasRequestModel;
  });
}
\`\`\`

**Suggestion template:**
> "The [verb] [route] endpoint accepts data but has no request model. What fields should it accept? Consider adding an API Model child with the expected request body structure."

### For Database Generation

**Minimum requirements:**
- [ ] Tables have explicit column definitions
- [ ] Primary keys are defined for each table
- [ ] Foreign key relationships reference valid tables
- [ ] Data types are specified (not left as defaults)

**Check for incomplete tables:**
\`\`\`javascript
function findIncompleteTables(nodes) {
  return nodes
    .filter(node => node.data.constructType === 'table')
    .filter(table => {
      const attributes = nodes.filter(n =>
        n.data.constructType === 'db-attribute' &&
        n.data.connections?.some(c =>
          c.targetSemanticId === table.data.semanticId &&
          c.portId === 'parent'
        )
      );

      // Table with 0-1 attributes is likely incomplete
      return attributes.length <= 1;
    });
}
\`\`\`

**Suggestion template:**
> "The '[table]' table only defines [N] column(s). Based on [evidence], consider adding: [suggested columns]."

### For Frontend Generation

**Minimum requirements:**
- [ ] UI screens have descriptions of purpose and content
- [ ] UI events specify triggers and what happens
- [ ] Flow connections show the user journey
- [ ] Events connect to appropriate backend endpoints

## Making Helpful Suggestions

### Be Specific, Not Generic

**Bad:** "Your database is incomplete."
**Good:** "The Users table only defines UserId. Based on the Signup Screen description mentioning 'email, username, password', you probably need email (VARCHAR), username (VARCHAR), and passwordHash (VARCHAR) columns."

### Reference Related Constructs

When suggesting additions, point to evidence from elsewhere in the diagram:

**Good:** "The UI Event 'Submit signup' triggers POST /api/users, but there's no request model. The Signup Screen mentions 'email, username, password, phone' - these should probably be the request body fields."

### Offer Alternatives

When there are multiple valid approaches:

**Good:** "You could either: (a) Add db-attribute children to define each column, or (b) Fill in the table's 'columns' field with a comma-separated list. Option (a) is more visual; option (b) is quicker."

### Prioritize by Impact

Focus on issues that block code generation before style issues:

1. **Blockers:** Missing routes, undefined data types, unconnected controllers
2. **Important:** Incomplete schemas, missing validation
3. **Nice-to-have:** Naming consistency, documentation

## Inferring Missing Information

When data is missing, look for clues elsewhere:

### From UI Descriptions

UI Screen descriptions often list fields:
> "User can put in email, username, password, and phone number."

→ Infer: Users table needs email, username, passwordHash, phoneNumber columns
→ Infer: POST /api/users request body needs email, username, password, phoneNumber fields

### From Construct Names

Names often indicate purpose:
- "UserController" → Handles user CRUD operations
- "OrdersTable" → Stores order data
- "LoginScreen" → Handles authentication

### From Relationships

- If UIEvent → Controller → Database, the controller likely does CRUD on that database
- If Table has FK to another table, there's a relationship to model

## Analysis Checklist Summary

### Quick Scan (Always Do)
- [ ] Any orphan constructs?
- [ ] Any constructs missing obvious parents?
- [ ] Any empty required fields?
- [ ] Any obvious placeholders?

### Structural Analysis
- [ ] How many disconnected clusters?
- [ ] Do hierarchies make sense (DB → Tables → Columns)?
- [ ] Do flows make sense (UI → API → DB)?

### Code Generation Assessment
- [ ] Can I generate API routes from controllers?
- [ ] Can I generate database schema from tables?
- [ ] Can I generate request/response types from models?
- [ ] What's missing for a complete implementation?

### Suggestions
- [ ] Prioritized by impact
- [ ] Specific with evidence from diagram
- [ ] Actionable (user knows exactly what to do)
`;
