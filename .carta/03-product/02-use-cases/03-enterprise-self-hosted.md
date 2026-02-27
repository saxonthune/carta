---
title: Team Workspace
status: active
---

# Team Workspace

## Scenario

A team works on a shared codebase. The `.carta/` workspace lives in the repository alongside source code. Developers run `carta serve .` locally. Non-developers (product managers, domain experts) connect to a shared workspace server via the web client. The server performs git operations on their behalf.

## Deployment Configuration

| Setting | Value |
|---------|-------|
| `VITE_SYNC_URL` | `https://carta.internal` or `http://localhost:51234` |
| `VITE_AI_MODE` | `user-key` or `server-proxy` |

The workspace server wraps a git clone of the team's repository. It serves the web client, manages Yjs rooms per canvas, and commits/pushes to the remote on behalf of web users.

## User Flows

### Developer (local)

- Runs `carta serve .` in their repo checkout
- Edits canvases in the browser, changes write to disk via debouncer
- Versions changes with git directly (`git add`, `git commit`, `git push`)
- AI agents (Claude Code, Cursor) read `.carta/` files directly, use MCP for canvas/schema editing
- Pulls teammate changes via `git pull` — filesystem watcher reconciles any open Yjs rooms

### Product manager (web client)

- Opens the team's workspace server URL in a browser
- Browses the workspace tree in the navigator (spec groups = directories)
- Creates canvases, adds constructs, uses AI sidebar
- Clicks "Publish to repository" when ready to share
  - Sees files they changed (pre-selected) and others' uncommitted changes (visible, not selected)
  - Writes a commit message → server runs `git commit --author="PM Name <pm@company.com>" && git push`
- If they close their laptop without publishing, auto-quiesce commits their changes as a safety net

### Real-time collaboration

- Two web users editing the same canvas see each other's changes in real time via Yjs
- A developer running `carta serve .` locally does NOT see web users' real-time edits (separate server instances)
- Cross-instance sharing happens through git: web user publishes → developer pulls

## Git Integration

The workspace server tracks which user edited which file (`Map<filePath, Set<userId>>`). On publish, it stages the selected files, commits with the user's author identity, and pushes. See ADR 009's "Git integration" section for the full publish model.

The server does not manage branches. Everyone works on the same branch. The remote is GitHub/GitLab/etc. — the server is not a git hosting service.

## Features Used

- doc03.01.01.01 (Canvas) — primary workspace
- doc03.01.01.02 (Constructs) — modeling components
- doc03.01.01.03 (Ports and Connections) — defining relationships
- doc03.01.02.01 (Compilation) — AI-readable output
- doc03.01.03.02 (Collaboration) — real-time sync between web users
- doc03.01.03.03 (AI Assistant) — sidebar chat, MCP tools
