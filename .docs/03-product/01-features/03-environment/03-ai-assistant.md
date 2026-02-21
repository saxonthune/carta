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

The AI sidebar can manipulate the document through tool calls. Tools are defined in `@carta/document` and exposed to the AI provider via JSON Schema. They operate on the local Yjs document and do not require the document server to be running.

Schema tools: `list_schemas`, `get_schema`, `create_schema`, `update_schema`, `delete_schema`, `rename_field`, `remove_field`, `add_field`, `rename_port`, `remove_port`, `add_port`, `change_port_type`, `rename_schema_type`, `change_field_type`, `narrow_enum_options`

Page tools: `list_pages`, `create_page`, `rename_page`, `delete_page`, `set_active_page`, `compile`

Construct tools: `list_constructs`, `get_construct`, `create_construct`, `update_construct`, `delete_construct`, `create_constructs`, `delete_constructs`, `move_construct`

Connection tools: `connect_constructs`, `disconnect_constructs`, `connect_constructs_bulk`

Organizer tools: `list_organizers`, `create_organizer`, `update_organizer`, `delete_organizer`

Layout tools: `flow_layout`, `arrange`, `pin_constraint`, `list_pin_constraints`, `remove_pin_constraint`, `apply_pin_layout`, `rebuild_page`

Batch tools: `batch_mutate`

Package tools: `list_packages`, `create_package`, `get_package`

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
