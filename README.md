# Carta

## About

What is Carta?

1. **A typed diagramming tool**. Instead of a boxes labeled `API` or `Database`, make custom schema for api controllers and database tables. Define the fields that model your domain, and define how schema connect to each other. Front-end, back-end, serverless, product storyboards, business processes; use a simple toolkit to model anything.
2. **Built-in AI support via MCP**. Turn a fine-grained API map into code. Import existing source code into your document. Use a prompt to improve your design and make new schema, without getting your hands dirty.
3. **Remote hosting and collaboration hooks built in**. Carta's data model is backed by y.js, enabling collaboration between multiple users.

## Use Cases

1. **Product to prototype.** Start with simple notes, then build an architecture, then build component trees and table definitions, then build a deployable prototype, with AI helping every step of the way.
2. **Extract domain knowledge from legacy code.** Point your AI agent to an old monolith, extract its control branches and database writes, and finally get a view into legacy processes.
3. **Extreme vibe coding.** Instead of giving up when your new project gets too big, make an inventory of your components, and what you want them to do. Let your AI agent read your Carta pages when planning your next feature.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install

```bash
pnpm install
```

### Development (static/offline mode)

```bash
pnpm demo
```

Opens at `http://localhost:5173`. Documents persist locally in IndexedDB.

### Development (server/collaboration mode)

```bash
pnpm server           # starts MongoDB + collab server on :1234
pnpm client           # starts client pointing at collab server
```

Visit `http://localhost:5173/?doc=my-document-id` to open a specific document.

Use `pnpm server:memory` to run the server with in-memory storage (no MongoDB required).

### Tests

```bash
pnpm test             # typecheck + integration tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
```

### Build

```bash
pnpm build:all        # build all workspace packages
pnpm build            # build web client for production
```

### Desktop

```bash
pnpm desktop          # run desktop app in dev mode
pnpm build:desktop    # build desktop app
pnpm package:desktop  # package desktop app for distribution
```



