---
title: AI Agent Integration
status: active
---

# AI Agent Integration

How AI agents work with Carta: what's free, what needs MCP, and the two core workflows for using Carta with code.

## What Needs MCP vs What's Free

**Free (file reads, no MCP):**
- Reading `.carta/` workspace files directly from disk (canvas JSON, schemas, text files)
- Reading compiled output you've already generated
- Reading any file in the workspace directory

**Requires MCP tools:**
- Writing constructs, connections, schemas, or organizers to the canvas
- Running the compiler (`carta_compile`)
- Running layout algorithms (`carta_layout`)
- Schema migrations (rename, retype, add/remove fields and ports)
- Any canvas mutation

MCP tools are the *only* interface for programmatic canvas mutation. File-level writes to canvas JSON are not supported — always use the MCP tools. See doc02.03 for the full tool reference.

## Connecting Your AI

Run `carta serve .` in your workspace directory. Point your MCP client at the server URL it prints. That's it.

The server exposes both the MCP tool interface (for canvas manipulation) and static guide resources (for orientation). No per-provider configuration is needed beyond the server URL.

## Spec-to-Code Workflow

Use this workflow when you have a Carta canvas and want to generate or update code to match it.

1. **Compile the canvas** — run `carta_compile` with the canvas ID. This produces a structured JSON representation stripping visual-only data.

2. **Read the output as a specification** — the compiled output has four sections:
   - **Organizer groupings** → module or package boundaries in your code
   - **Schema definitions** → type contracts: interfaces, classes, or type definitions
   - **Constructs by type** → concrete instances to implement
   - **Relationship metadata** → dependency graph: imports, API calls, event subscriptions

3. **Write code from the spec** — use the structure to generate or place code. Organizer boundaries become directory boundaries. Schema fields become type properties. Relationships become dependency wiring.

4. **Recompile after canvas changes** — whenever the canvas is updated, recompile before writing more code. Compiled output is not automatically kept in sync with the canvas.

See the Analysis Guide (`carta://guide/analysis`) for how to interpret compiled output and check code consistency against a spec.

## Code-to-Spec Workflow

Use this workflow when you have an existing codebase and want to create a Carta canvas representing its architecture.

1. **Read the codebase** — identify natural architectural boundaries: packages, services, layers, subsystems.

2. **Read the domain guide directory** — fetch `carta://guide/domains` to see available guides. Pick the one closest to your codebase's domain.

3. **Create schemas** — use `carta_schema op:create` following the domain guide's recommendations. Define one schema per *category* of component, not per individual file.

4. **Create constructs** — use `carta_canvas op:create` or `op:create_bulk`. One construct per meaningful component; fill in field values from what you found in the code.

5. **Connect** — use `carta_canvas op:connect` or `op:connect_bulk`. Map dependencies, data flows, and ownership to connections.

6. **Organize** — use `carta_canvas op:create_organizer` and `op:move` to group constructs by layer, service, or team boundary.

7. **Layout** — use `carta_layout op:flow` or `op:arrange` for a clean, readable result.

See the Reverse Engineering Guide (`carta://guide/reverse-engineering`) for step-by-step detail on each of these phases.

## Guide Directory

All guides are static MCP resources. Read them before working in a new domain or attempting a workflow you haven't done before.

| Guide | URI | When to Read |
|-------|-----|--------------|
| Metamodel | `carta://guide/metamodel` | First time working with Carta; need to understand schemas, constructs, ports, organizers |
| Analysis | `carta://guide/analysis` | Before analyzing a canvas for structural issues or code generation readiness |
| Domain Directory | `carta://guide/domains` | When starting a new canvas; find the right domain guide |
| Software Architecture | `carta://guide/domains/software-architecture` | Modeling REST APIs, services, databases, UI layers |
| AWS Cloud | `carta://guide/domains/aws` | Modeling Lambda, API Gateway, DynamoDB, S3, serverless patterns |
| BPMN Process | `carta://guide/domains/bpmn` | Modeling business processes, workflows, events, gateways |
| Reverse Engineering | `carta://guide/reverse-engineering` | Going from an existing codebase to a Carta canvas |
