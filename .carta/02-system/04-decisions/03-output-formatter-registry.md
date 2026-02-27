---
title: "Extensible output formatter registry"
status: draft
---

# Decision 03: Extensible Output Formatter Registry

## Context

Hard-coded compilation to specific formats (like OpenAPI) couples the compiler to specific construct types. A more general solution would let users define how their constructs map to any output format.

## Decision

Separate compilation into three concerns:

### 1. Formatter Schema

What data structure the output format requires. A formatter declares an interface — required fields, child types, hierarchy.

### 2. Mapping Rules

How user constructs satisfy formatter requirements. Users map their construct fields to formatter fields (e.g., "my 'route' field maps to OpenAPI 'path'").

### 3. Traversal Rules

How to gather hierarchical data via port-based connections. Defines which ports to follow and what construct types to collect as children.

## Type Correctness

This approaches structural typing. A formatter declares an interface; a user's document either satisfies it or doesn't. Validation at mapping time can check whether construct schemas + port configurations fulfill formatter requirements.

## Expression Language

For user-defined formatters, a safe expression language is needed. Recommended approach: JSONata-style expressions extended with custom functions for port-based graph traversal. Traversal rules are the domain-specific part; generic data transformation is handled by the expression language.

## Consequences

- Users can define custom output formats without modifying the compiler
- Formatter schemas serve as contracts between the visual model and output format
- Validation can check at mapping time whether a document satisfies a formatter's requirements
- Adds complexity: three-concern separation is more to understand than a single compile function
- JSONata or similar expression language is a new dependency and learning curve

## Status

Draft — not yet implemented. Current compiler uses a single JSON format.
