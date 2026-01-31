# Carta

Readme is WIP! 

This is a visual editor that let's users build anything related to the world of software architecture. Users define their own components, called `Constructs`, and put them together on a grid, powered by (react-flow)[reactflow link here hehe]. A `Construct` can be a REST controller, a database table, a UI page, user story, event, message queue; it can also represent user stories, (domains)[DDD website, if one exists], tickets, and so on. 

There are three main goals, which unfold in sequence.
1. A visual tool to help developers think about designing software that solves problems. Like (Excalidraw)[url ] but more focused on strongly typed nodes.
2. The map of nodes can be exported to a markdown file; if the design is detailed enough, and the type explanations are detailed enough, then an AI agent can read the file in implement in, perhaps even in the language and framework of choice.
3. Work with AI agents via MCP to collaboratively edit and implement designs.

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
npm run dev
```

Opens at `http://localhost:5173`. Documents persist locally in IndexedDB.

### Development (server/collaboration mode)

```bash
npm run server        # starts MongoDB + collab server on :1234
npm run dev:client    # starts client pointing at collab server
```

Visit `http://localhost:5173/?doc=my-document-id` to open a specific document.

### Tests

```bash
npm run test          # integration tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
```

### Build

```bash
pnpm -r build         # build all workspace packages
npm run build          # build web client for production
```



