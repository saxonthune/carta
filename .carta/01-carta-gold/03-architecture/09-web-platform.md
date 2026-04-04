---
title: Web Platform Architecture
status: draft
summary: Future server architecture — git-backed workspace, WebSocket sync, REST API
tags: [server, web, architecture, git]
deps: [doc01.04.01]
---

> **Note:** TypeScript packages referenced in this doc now live in [Luminous](https://github.com/saxonthune/Luminous). File paths like `packages/web-client/` refer to the Luminous repo.


# Web Platform Architecture

Architecture of the hosted web platform — a server that wraps git repositories and exposes them to web clients via REST API and WebSocket sync.

## Server Responsibilities

- **Git operations**: Commit, push, pull on behalf of web users
- **WebSocket sync**: Real-time Yjs document sync for collaboration
- **REST API**: Document CRUD, workspace browsing, schema serving
- **MCP server**: Programmatic access for AI agents

## Package

`@carta/server` (`packages/server/`) — Node.js server with Express and y-websocket.

## Deployment Modes

Configuration via environment variables:
- `VITE_SYNC_URL`: Server URL (absent = browser-only mode)
- `VITE_AI_MODE`: AI credential handling (`none`, `user-key`, `server-proxy`)
