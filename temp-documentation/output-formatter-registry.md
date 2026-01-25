# Output Formatter Registry Design

## Problem

Hard-coded compilation to formats like OpenAPI felt wrong—it coupled the compiler to specific construct types. A more general solution would let users define how their constructs map to any output format.

## Proposed Architecture

Three distinct concerns:

### 1. Formatter Schema
What data structure the output format requires.

```typescript
// OpenAPI formatter declares its requirements:
{
  rootType: "endpoint",
  requiredFields: {
    path: "string",
    method: { type: "enum", options: ["GET", "POST", "PUT", "DELETE"] }
  },
  children: [{
    type: "parameter",
    requiredFields: {
      name: "string",
      location: { type: "enum", options: ["path", "query", "header", "body"] }
    }
  }]
}
```

### 2. Mapping Rules
How user constructs satisfy formatter requirements.

```typescript
// User maps their constructs to OpenAPI formatter:
{
  rootMapping: {
    constructType: "controller",
    fields: {
      path: "route",      // my "route" field → OpenAPI "path"
      method: "httpMethod"
    }
  },
  childMappings: [{
    constructType: "api-parameter",
    fields: {
      name: "paramName",
      location: "in"
    }
  }]
}
```

### 3. Traversal Rules
How to gather hierarchical data via connections.

```typescript
// User defines how to find children:
{
  childTraversal: {
    fromPort: "child",        // source port on parent
    toPort: "parent",         // destination port on child
    targetType: "api-parameter"
  }
}
// Reads as: "find api-parameter nodes connected via their 'parent' port to my 'child' port"
```

## Type Correctness

This approaches structural typing. A formatter declares an interface; a user's document either satisfies it or doesn't. Validation at mapping time can check whether construct schemas + port configurations fulfill formatter requirements.

## DDL Options

For user-defined formatters, need a safe expression language. Options:

| Approach | Safety | Expressiveness | Complexity |
|----------|--------|----------------|------------|
| Declarative JSON | High | Limited | Low |
| Expression language (JSONata) | High | Good | Medium |
| Restricted JS AST | Medium | High | High |
| Custom DSL | High | Tailored | High |

## Recommended Approach

JSONata-style expression language extended with graph traversal primitives:

```
{
  "paths": $traverse(nodes, 'controller').{
    $$.values.route: {
      $$.values.method: {
        "parameters": $children($$, 'child', 'api-parameter').{
          "name": values.name,
          "in": values.location
        }
      }
    }
  }
}
```

**Key insight:** Traversal rules are the domain-specific part. Generic data transformation is well-handled by existing expression languages. The "necessary and sufficient" DDL is: **JSONata + custom functions for port-based graph traversal**.
