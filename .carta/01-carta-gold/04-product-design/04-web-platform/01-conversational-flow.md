---
title: Conversational Flow
status: draft
summary: AI-heavy interaction flavor — agent elicits domain knowledge and produces specs
tags: [web, ai, specs, workflow]
deps: [doc01.04.04.00]
---

# Conversational Flow

The user interacts with an AI agent loaded with the `/carta-spec-builder` skill. The conversation is the primary interface.

## What the Agent Does

- Elicits domain knowledge through structured questioning
- Creates and edits spec files in the workspace
- Handles placement, cross-references, frontmatter, and MANIFEST updates
- Uses the same skill definition as the CLI-based `/carta-spec-builder`

## What the User Sees

The user sees the resulting specs appear in the sidebar file tree as the conversation progresses. They can click any spec to review or edit it directly — switching to the direct editing flow (doc01.03.09) mid-session is natural.

The conversation produces specs as output. The specs are the artifact, not the chat log.

## Open Questions

1. Should the agent proactively surface related specs during conversation ("I see you mentioned X — there's an existing spec for that")?
2. How does the agent handle requests that span multiple spec levels (e.g., user describes a business process that implies architectural decisions)?
3. Session continuity — does the agent remember prior conversations, or does each session start fresh with workspace context?
