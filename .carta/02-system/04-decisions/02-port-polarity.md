---
title: "Five-value polarity model for ports"
status: active
---

# Decision 002: Five-Value Polarity Model for Ports

## Context

Connections between constructs need directional semantics. Simple source/sink is insufficient — some ports need to pass through (relay) or intercept without strict type matching.

## Decision

Five polarity values: source, sink, bidirectional, relay, intercept. Two-step validation:
1. Block same-direction pairs (relay maps to source, intercept maps to sink)
2. Skip compatibleWith check if either side is relay, intercept, or bidirectional; otherwise require match

## Consequences

- Rich enough to model most architectural relationships
- Relay and intercept enable middleware/proxy patterns without custom port types per relationship
- Bidirectional handles symmetric relationships (e.g., "communicates with")
- More complex validation logic than simple source/sink
- Port schemas are user-editable, allowing domain-specific extensions
