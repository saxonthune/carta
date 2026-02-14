---
title: AI Assistant
status: draft
---

# AI Assistant

An AI sidebar for chat-based interaction with the Carta document.

## Chat Interface

- Toggle open/close from header
- Send messages (Enter to send, Shift+Enter for newline)
- Streaming responses with stop button
- Message history within session
- Click assistant messages to view details (tool calls, reasoning)

## AI Tools

The AI assistant can manipulate the document through tool calls:
- **getDocument**: Read full document state
- **getNode**: Get a specific construct by semantic ID
- **addConstruct**: Create a new construct instance
- **updateNode**: Update construct field values
- **connectNodes**: Connect two constructs via ports
- **deleteNode**: Remove a construct
- **queryNodes**: Search constructs by type or semantic ID pattern

## Configuration

Settings panel accessible from the sidebar:
- API key input (persists to localStorage)
- Model selection
- OpenRouter integration support

## Access Modes

AI access varies by deployment target (see doc02.05 for full matrix):

- **Chat + API key**: User provides an OpenRouter key or similar. Requests go directly to AI provider. Available in all deployments.
- **Server-managed chat**: Prompts routed through the Carta server. Available in web client and desktop.
- **MCP local**: Desktop client can expose a local MCP server for AI tools like Claude Code.
- **MCP remote**: Server exposes an MCP endpoint for remote AI tool integration.

## MCP Server

Carta exposes an MCP server (doc02.03) for integration with external AI tools like Claude Code. The MCP server provides the same document manipulation capabilities as the sidebar tools, plus schema and deployable operations.

### Desktop MCP Auto-Discovery

In the desktop app, the embedded server writes `server.json` to `{userData}/` containing the server URL and PID. The MCP stdio binary reads this file automatically when `CARTA_SERVER_URL` is not set. Users can copy the Claude Desktop config snippet from Settings > Copy MCP Config.
