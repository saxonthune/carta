export const SOFTWARE_ARCHITECTURE_GUIDE = `# Domain: Software Architecture

## When to Use
User wants to model REST APIs, services, databases, UI components, or system architecture.

## Discovery Questions
Ask these to customize the vocabulary:
- "REST, GraphQL, or gRPC?" → affects API schema fields and connection patterns
- "Is authentication a separate concern?" → adds Auth Policy schema
- "Do you need database modeling?" → adds Database + Table schemas with parent/child
- "Are you modeling UI components?" → adds UI Component + UI Event schemas

## Schema Reference

Reference package: \`software-architecture\`

### API Group

**REST Endpoint** (\`rest-endpoint\`) — #7c7fca
- Fields: route (string, pill), verb (enum: GET/POST/PUT/PATCH/DELETE, summary), summary (string, summary), responseType (enum: object/array/string/number/boolean/void, summary)
- Ports: flow-in ← Flow In, flow-out → Flow Out, parent → Models, policy-in ← Policies

**Auth Policy** (\`auth-policy\`) — #dc2626
- Fields: name (string, pill), authType (enum: API Key/JWT/OAuth2/Basic/IAM/Custom, summary), description (string, summary)
- Ports: flow-out → Applies To

**Rate Limit** (\`rate-limit\`) — #f59e0b
- Fields: name (string, pill), requests (number, summary), window (enum: second/minute/hour/day, summary), scope (enum: per-user/per-ip/global, summary)
- Ports: flow-out → Applies To

**Cache Policy** (\`cache-policy\`) — #06b6d4
- Fields: name (string, pill), ttl (number, summary), location (enum: edge/origin/both, summary), varyBy (string, summary)
- Ports: flow-out → Applies To

**API Model** (\`api-model\`) — #7c7fca
- Fields: modelName (string, pill), modelType (enum: request/response, summary), data (string, summary)
- Ports: child ← Controller

### Database Group

**Database** (\`database\`) — #c49a4c
- Fields: engine (enum: PostgreSQL/MySQL/SQLite/SQL Server/MongoDB, pill), note (string, summary)
- Ports: link-in ← Referenced By, child ← Tables

**Table** (\`table\`) — #8a7cb8
- Fields: tableName (string, pill), columns (string, summary), constraints (string)
- Ports: link-in ← Referenced By, link-out → References, parent → Database, child ← Attributes & Constraints

**DB Attribute** (\`db-attribute\`) — #8a7cb8
- Fields: name (string, pill), dataType (enum: VARCHAR/INT/BIGINT/BOOLEAN/DATE/TIMESTAMP/TEXT/JSON, summary), primaryKey (boolean, summary), nullable (boolean, summary)
- Ports: parent → Table

**Constraint** (\`constraint\`) — #9488b8
- Fields: name (string, pill), constraintType (enum: PRIMARY KEY/UNIQUE/FOREIGN KEY/CHECK/NOT NULL/DEFAULT, summary), columns (string, summary), definition (string)
- Ports: parent → Table

### UI Group

**UI Event** (\`ui-event\`) — #5ba88e
- Fields: eventName (string, pill), trigger (string, summary), description (string, summary)
- Ports: child ← Events, flow-out → Flow Out

**UI Screen** (\`ui-screen\`) — #6a8fc0
- Fields: screenName (string, pill), description (string, summary)
- Ports: flow-in ← Flow In, parent → Events

### User Story Group

**User Story** (\`user-story\`) — #5ba88e
- Fields: title (string, pill), description (string, summary)
- Ports: flow-out → Flow Out

### Ungrouped

**Implementation Details** (\`implementation-details\`) — #6b7280
- Fields: details (string, pill)
- Ports: link ↔ Related To

## Connection Patterns
- API Gateway →(flow-out)→ REST Endpoint →(flow-out)→ Service
- REST Endpoint →(parent)→ API Model (request/response shapes)
- REST Endpoint ←(policy-in)← Auth Policy, Rate Limit
- Service →(flow-out)→ Database →(parent)→ Table
- UI Component →(flow-out)→ REST Endpoint (API calls)
- User Story →(flow-out)→ UI Component (implements)

## Display Recommendations
- Group by layer: API, Database, UI, User Story (use organizers)
- REST Endpoints: use \`instanceColors: true\` to let users distinguish by domain
- Per-instance color picking available when \`instanceColors\` is enabled on the schema
- Tables as children of Database nodes (parent/child ports)
`;
