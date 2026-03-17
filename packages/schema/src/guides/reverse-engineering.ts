/**
 * Reverse Engineering Guide - How to go from existing code to a Carta canvas
 *
 * This guide teaches AI agents how to reverse-engineer an existing codebase
 * into a Carta canvas: identifying components, creating schemas, populating
 * constructs, connecting them, and organizing the result.
 */

export const REVERSE_ENGINEERING_GUIDE = `# Carta Reverse Engineering Guide

## Overview

This guide walks you through translating an existing codebase into a Carta canvas. The goal is a canvas that captures the *architecture* — the meaningful components, their boundaries, and how they relate — not the implementation details.

Work iteratively. Start with a rough top-level picture, then add detail where it matters.

## Step 1: Identify Components

Read the codebase and find natural architectural boundaries:

- **Packages or modules**: directories, workspace packages, Go modules, Python packages
- **Services**: processes that run independently and communicate over a network
- **Layers**: presentation, application, domain, infrastructure
- **Subsystems**: groups of closely related functionality (e.g., auth, payments, notifications)

**What to look for:**
- Directory structure and naming conventions
- Package manifests (package.json, go.mod, pyproject.toml, Cargo.toml)
- Import/dependency graphs — things that are imported together tend to belong together
- README files and existing architecture diagrams

**One construct per meaningful component.** A component is meaningful when it has a clear responsibility and a boundary that other components respect. Do not create one construct per file.

## Step 2: Choose a Domain Guide

Read the domain guide directory at \`carta://guide/domains\` to find the guide that best matches your codebase's domain. Available guides:

- **Software Architecture** (\`carta://guide/domains/software-architecture\`) — REST APIs, services, databases, UI layers
- **AWS Cloud** (\`carta://guide/domains/aws\`) — Lambda, API Gateway, DynamoDB, S3, serverless
- **BPMN Process** (\`carta://guide/domains/bpmn\`) — Business processes, workflows, events, gateways

If your codebase spans multiple domains (e.g., a serverless backend with a frontend), pick the guide that covers the dominant part, or read both.

## Step 3: Create Schemas

Use \`carta_schema op:create\` to define the types of components in your architecture. Follow the domain guide's schema recommendations.

**Order of creation:**
1. Structural types first (services, modules, layers, boundaries)
2. Supporting types second (databases, queues, external APIs)
3. Relationship types last, if your domain uses typed edges

**Principles:**
- One schema per *category* of component, not per individual instance
- Include a \`semanticDescription\` on each schema explaining what this type of component represents
- Add fields for the properties that distinguish instances (name, technology, responsibilities)
- Add ports that reflect how components of this type connect to others

## Step 4: Create Constructs

Use \`carta_canvas op:create\` or \`op:create_bulk\` to create one construct per identified component.

**For each construct:**
- Set field values from what you found in the code (names, technologies, responsibilities)
- Use \`semanticId\` values that match names in the codebase (package names, service names) for traceability
- Omit x/y coordinates — auto-placement is fine; you'll lay out in Step 7

**Bulk creation tip:** Group constructs by schema type when using \`op:create_bulk\`. This makes the transaction easier to review and retry if it fails.

## Step 5: Connect

Use \`carta_canvas op:connect\` or \`op:connect_bulk\` to map dependencies and data flows to connections.

**What to connect:**
- **Dependencies**: if A imports B, connect A → B
- **Data flows**: if A sends data to B (HTTP, events, queues), connect A → B
- **Ownership**: if A owns B (parent/child, contains), connect A → B using a \`child\` port

**What to skip:**
- Transitive dependencies (if A→B and B→C, don't add A→C unless it's a direct relationship)
- Implementation details (a function calling a utility, a component using a helper)

Use \`carta_schema op:list_port_types\` to check port compatibility before connecting.

## Step 6: Organize

Use \`carta_canvas op:create_organizer\` to create visual groupings for logical clusters:

- One organizer per layer (e.g., "Frontend", "Backend", "Infrastructure")
- One organizer per service boundary if you have microservices
- One organizer per team ownership boundary if that's meaningful

Then use \`carta_canvas op:move\` to place constructs into their organizers.

## Step 7: Layout

Use \`carta_layout op:flow\` or \`op:arrange\` to produce a clean, readable layout.

- \`op:flow\` with \`direction: "TB"\` works well for layered architectures (top = entry points, bottom = storage)
- \`op:flow\` with \`direction: "LR"\` works well for pipeline architectures
- \`op:arrange\` with \`strategy: "grid"\` works well for peer services with no dominant direction

## What to Model

**Model:**
- Boundaries and contracts between components
- The types of components and their roles
- Data flows and dependencies between components
- Ownership and containment relationships

**Do not model:**
- Implementation details (algorithms, data structures, individual functions)
- Internal state that doesn't cross component boundaries
- One-off utility functions that have no architectural significance

## How Deep to Go

Start shallow. A canvas with 10–20 well-chosen constructs is more useful than one with 200 that nobody can read.

**Level 1 (start here):** Top-level services or packages — the things that deploy independently or have their own repository.

**Level 2 (add when useful):** Major subsystems within each service — the layers or domains that have distinct responsibilities.

**Level 3 (rarely needed):** Individual classes or modules — only when the architectural question requires that granularity.

After completing a level, compile the canvas (\`carta_compile\`) and review the output. If the output gives enough context to answer "what does this system do and how does it work?", you are done. If not, add detail.
`;
