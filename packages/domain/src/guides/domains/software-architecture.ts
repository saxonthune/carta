export const SOFTWARE_ARCHITECTURE_GUIDE = `# Domain: Software Architecture

## When to Use
User wants to model REST APIs, services, databases, UI components, or system architecture.

## Discovery Questions
Ask these to customize the vocabulary:
- "REST, GraphQL, or gRPC?" → affects API schema fields and connection patterns
- "Is authentication a separate concern?" → adds Auth Policy schema
- "Do you need database modeling?" → adds Database + Table schemas with parent/child
- "Are you modeling UI components?" → adds UI Component + UI Event schemas

## Recommended Schemas
Reference seed: \`software-architecture\`

| Schema | Purpose | Pill Field | Key Display |
|--------|---------|-----------|-------------|
| REST Endpoint | HTTP API endpoint | route | verb as enum summary, tints bg |
| Auth Policy | Access control rule | name | authType enum |
| Database | Data store | name | engine enum |
| Table | DB table | name | parent→Database |
| API Model | Request/response shape | name | — |
| UI Component | Frontend element | name | componentType enum |
| User Story | Requirement | title | status enum |

## Connection Patterns
- API Gateway →(flow-out)→ REST Endpoint →(flow-out)→ Service
- REST Endpoint →(parent)→ API Model (request/response shapes)
- REST Endpoint ←(policy-in)← Auth Policy, Rate Limit
- Service →(flow-out)→ Database →(parent)→ Table
- UI Component →(flow-out)→ REST Endpoint (API calls)
- User Story →(flow-out)→ UI Component (implements)

## Display Recommendations
- Group by layer: API, Database, UI, User Story (use organizers)
- REST Endpoints: use \`tints\` backgroundColorPolicy to distinguish by domain
- Enum coloring on \`verb\` field for REST Endpoints (GET=green, POST=blue, etc.)
- Tables as children of Database nodes (parent/child ports)
`;
