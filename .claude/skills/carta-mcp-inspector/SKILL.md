---
name: carta-mcp-inspector
description: Audits Carta's MCP tools against best practices and generates improvement recommendations with implementation guidance
---

# carta-mcp-inspector

Audits Carta's MCP tool surface against established best practices and generates actionable improvement recommendations. Can also be pointed at the current conversation to diagnose tool-use friction in real time.

## When to invoke

- After experiencing friction using Carta MCP tools (too many round trips, missing operations, bad errors)
- When planning new MCP tools or modifying existing ones
- Periodically as the tool surface grows, to check for bloat and overlap
- When reviewing a conversation transcript where MCP tools were used

## Reference sources

These best practices are distilled from authoritative sources:

### Tier 1: Official

- **MCP Specification (2025-11-25)**: Tool schema, annotations, error handling, structured content
  - https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- **Anthropic: Writing Effective Tools for Agents**: The definitive guide
  - https://www.anthropic.com/engineering/writing-tools-for-agents
- **Anthropic: Code Execution with MCP**: Batch operations, context efficiency
  - https://www.anthropic.com/engineering/code-execution-with-mcp

### Tier 2: Strong community signal

- **Klavis: 4 MCP Design Patterns**: Workflow-based, progressive discovery, code mode, semantic search
  - https://www.klavis.ai/blog/less-is-more-mcp-design-patterns-for-ai-agents
- **Phil Schmid: MCP Best Practices**: "MCP is a UI for AI agents"
  - https://www.philschmid.de/mcp-best-practices
- **Shaaf: Intent Multiplexing**: Consolidate 45 tools into 1 with enum dispatch
  - https://shaaf.dev/post/2026-01-08-two-essential-patterns-for-buildingm-mcp-servers/

## Best practices checklist

### 1. Outcomes over operations

Design tools around agent goals, not API endpoints.

**Anti-pattern**: Separate `list_users`, `list_events`, `create_event` tools requiring 3 calls to schedule a meeting.
**Pattern**: Single `schedule_event` tool that orchestrates internally.

**Audit question**: "Does the agent need to chain 3+ tools to accomplish a single conceptual action? If so, the server should offer a workflow tool."

### 2. Consolidate related operations

Frequently chained operations should be a single tool.

**Anti-pattern**: Delete 20 constructs, create 20 constructs, create 20 connections = 60 tool calls.
**Pattern**: `carta_batch_mutate` accepting an array of heterogeneous operations (create, update, delete, connect, move) in one transaction.

**Audit question**: "Would the agent save 5+ round trips if related operations were batched?"

### 3. Missing workflow tools

Some operations require server-side intelligence the agent shouldn't have to replicate.

**Examples of missing workflow tools**:
- `carta_move_construct` — change parentId (organizer membership) without delete/recreate
- `carta_auto_layout` — reposition constructs to avoid overlaps
- `carta_reorganize` — move constructs into organizers while preserving connections
- `carta_clone_construct` — deep copy with new semanticId

**Audit question**: "Is the agent doing delete-then-recreate to simulate a move? Is it manually computing positions?"

### 4. Flatten arguments

Use top-level primitives and constrained types. Avoid nested objects that force the agent to guess structure.

**Anti-pattern**: `{ config: { display: { tier: "minimal" } } }`
**Pattern**: `{ displayTier: "minimal" }`

**Audit question**: "Are there nested objects in inputSchema that could be flattened?"

### 5. Response format control

Agent context is precious. Every token in a tool response is a token not available for reasoning.

**Pattern**: Add `output: "concise" | "detailed"` parameter. Concise returns just IDs and names. Detailed returns full field values, connections, positions.

**Audit question**: "Does the tool return fields the agent doesn't need for this call? Can the agent choose verbosity?"

### 6. Smart defaults and auto-placement

The server should do work the agent can't do well.

**Pattern**: When `x`/`y` are omitted, auto-place with overlap avoidance (not just grid). When `parentId` is set without position, place relative to siblings using the organizer's layout strategy.

**Audit question**: "Is the agent guessing coordinates? Is it placing things that overlap?"

### 7. Actionable error messages

Error responses should guide the agent toward a fix.

**Anti-pattern**: `{ "error": "TypeError: sourceYdata.get is not a function" }`
**Pattern**: `{ "error": "Construct 'abc-123' not found on the active level. It may exist on a different level — try carta_list_constructs with levelId to locate it.", "suggestion": "carta_list_levels" }`

**Audit question**: "If this error appeared in a conversation, would the agent know what to do next?"

### 8. Tool annotations

Use MCP annotations to declare tool behavior.

```json
{
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true
  }
}
```

**Read-only tools**: list_*, get_*, compile
**Destructive tools**: delete_*
**Idempotent tools**: update_*, set_active_level

**Audit question**: "Are annotations present? Would a client know which tools are safe to auto-approve?"

### 9. Description quality (SEP-1382 pattern)

Tool `description` enables *selection* (when to use this tool).
Parameter `description` enables *invocation* (how to call it correctly).

**Anti-pattern**: Tool description repeats parameter details. Parameter descriptions are generic ("The ID").
**Pattern**: Tool description explains *when and why*. Parameter descriptions explain *format, constraints, examples*.

**Audit question**: "Could an agent choose the right tool from the description alone? Could it fill parameters correctly from their descriptions alone?"

### 10. Tool count discipline

5-15 tools per server is the sweet spot. Beyond that, tool definitions consume too much context.

**Pattern**: Group related operations. Consider intent multiplexing (one tool + operation enum) for CRUD families.

**Audit question**: "How many tokens do all tool definitions consume? Is it more than 5-7% of context?"

## Execution pattern

You are opus. You do the analysis.

### 1. Read the current tool surface

```
Read('packages/server/src/mcp/tools.ts')
```

Count tools, measure description quality, check for annotations, identify missing operations.

### 2. Read the document operations layer

```
Read('packages/document/src/doc-operations.ts')
Read('packages/server/src/document-server-core.ts')
```

Identify operations that exist in the server but aren't exposed via MCP tools. Identify operations that don't exist yet but should.

### 3. Analyze conversation context (if applicable)

If invoked during or after a conversation where MCP tools were used, review the tool call sequence:
- Count total round trips
- Identify chains that should be single tools
- Note errors that weren't actionable
- Flag delete-then-recreate patterns (missing move/reparent)
- Calculate token waste from verbose responses

### 4. Generate audit report

```markdown
## MCP Tool Audit

### Tool Surface Summary
- Total tools: N
- Read-only: N | Mutating: N | Destructive: N
- Annotations present: yes/no
- Estimated definition token cost: ~N tokens

### Checklist Results

| # | Practice | Status | Notes |
|---|----------|--------|-------|
| 1 | Outcomes over operations | pass/fail | ... |
| 2 | Consolidate related ops | pass/fail | ... |
| ... | ... | ... | ... |

### Missing Tools (priority ordered)
1. **carta_move_construct** — Severity: high
   - Problem: agents must delete+recreate to change organizer membership
   - Impact: loses connections, wastes tokens, error-prone
   - Implementation: extend updateConstruct in doc-operations.ts to accept parentId

2. ...

### Description Improvements
| Tool | Current | Suggested |
|------|---------|-----------|
| ... | ... | ... |

### Conversation Friction (if applicable)
- Total tool calls: N
- Avoidable calls with batch/workflow tools: N
- Token waste estimate: ~N tokens
- Error recovery attempts: N
```

### 5. Generate todo plan (if requested)

If the user wants to act on findings, write a plan to `todo-plans/mcp-tool-improvements.md` following the standard plan format (frontload the summary in first 10 lines).

## Important notes

- **Read code first**: Always read tools.ts and doc-operations.ts before auditing
- **Count tokens**: Estimate how many tokens tool definitions consume in agent context
- **Conversation-aware**: If invoked mid-conversation, analyze the actual tool call sequence
- **Prioritize by pain**: Rank improvements by frequency of friction, not theoretical cleanliness
- **Don't over-consolidate**: Some granular tools are correct. Not every pair needs merging.
- **Output is a report**: This skill produces analysis, not code changes. Code changes come from a follow-up implementation task.
