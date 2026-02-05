---
title: Schema Design Patterns
status: active
---

# Schema Design Patterns

Higher-level workflows for designing and refactoring schemas in the Metamap view. These compose the atomic "Define a Schema" workflow (doc03.03.03) into creative schema design activities.

## Ponder Schema, Then Get Back to Work

Open the Metamap to study the current schema landscape. Identify a problem — a missing type, a wrong relationship, an overly broad schema. Fix it, then switch back to the Map to continue modeling instances.

- **Features**: doc03.01.01.05 (Metamap), doc03.01.01.06 (Schema Editor)
- **Atomic workflows**: doc03.03.03

## Make What You Need to Unblock Yourself

While working on the Map, realize there's no schema for what you need. Switch to Metamap, create the schema (possibly with ports), switch back, and use it immediately. Minimal friction — the schema exists to serve the model, not the other way around.

- **Features**: doc03.01.01.05 (Metamap), doc03.01.01.06 (Schema Editor)
- **Atomic workflows**: doc03.03.03, doc03.03.01

## Simple Types with 2–4 Connections

The bread-and-butter schema pattern. Create a type with a name field and a few ports (flow-in, flow-out, maybe parent/child). Most schemas start here.

- **Features**: doc03.01.01.06 (Schema Editor), doc03.01.01.03 (Ports and Connections)

## N-ary Relationship Patterns

Model a relationship that involves more than two participants. Create a "junction" schema with ports connecting to each participant type. The junction construct sits in the middle and connects N other constructs.

- **Features**: doc03.01.01.06 (Schema Editor), doc03.01.01.03 (Ports and Connections)

## Make an Interceptor Between Two Types

Insert a new schema between two existing types that are already connected. The interceptor has intercept-polarity ports that can tap into existing connections. Use this when a relationship needs to be mediated — e.g., adding middleware between a client and server.

- **Features**: doc03.01.01.06 (Schema Editor), doc03.01.01.03 (Ports and Connections)
- **Related**: doc02.04.02 (Port Polarity ADR)

## Refactor Schema

### Split a Schema

A schema has grown too broad. Create two or more narrower schemas, migrate the fields, update ports, and re-type existing instances.

### Decompose into N-ary Relationship

A schema with too many direct connections becomes a junction pattern. Extract the relationship into its own schema.

### Extract Parent/Child

A schema's fields suggest a containment hierarchy. Split it into a parent schema and a child schema connected by parent/child ports.

### Extract and Set the Connecting Port

Two schemas are connected by a generic port. Create a dedicated port type that captures the relationship's semantics, then update both schemas to use it.

### Merge Schemas

Two schemas are too similar to justify separate types. Combine them into one, reconciling fields and ports. Re-type instances of the removed schema.

- **Features**: doc03.01.01.05 (Metamap), doc03.01.01.06 (Schema Editor)
