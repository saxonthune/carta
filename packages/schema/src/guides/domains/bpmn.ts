export const BPMN_GUIDE = `# Domain: BPMN Process

## When to Use
User wants to model business processes, workflows, events, gateways, or organizational swim lanes.

## Discovery Questions
Ask these to customize the vocabulary:
- "How many swim lanes/participants?" → creates Pool and Lane schemas
- "Are there parallel paths?" → uses Parallel Gateway
- "Message events between pools?" → adds Message Flow connections
- "Timer or error events?" → uses Intermediate Event types

## Schema Reference

Reference package: \`bpmn\`

### Flow Elements

**Activity** (\`bpmn-activity\`) — #3b82f6
- Fields: name (string, pill), activityType (enum: Task/Subprocess/Call Activity, summary), description (string, summary)
- Ports: seq-in ← Sequence In, seq-out → Sequence Out, child ← Lane, parent → Sub-activities, data-link ↔ Data

**Event** (\`bpmn-event\`) — #22c55e — shape: circle
- Fields: name (string, pill), eventPosition (enum: Start/Intermediate/End, summary), trigger (enum: None/Message/Timer/Error/Signal, summary), description (string, summary)
- Ports: seq-in ← Sequence In, seq-out → Sequence Out, child ← Lane

**Gateway** (\`bpmn-gateway\`) — #f59e0b — shape: diamond
- Fields: name (string, pill), gatewayType (enum: Exclusive (XOR)/Parallel (AND)/Inclusive (OR)/Event-Based, summary), description (string, summary)
- Ports: seq-in ← Sequence In, seq-out → Sequence Out, child ← Lane

### Swimlanes

**Pool** (\`bpmn-pool\`) — #6366f1
- Fields: name (string, pill), description (string, summary)
- Ports: parent → Lanes, msg-out (relay) → Message Out, msg-in (intercept) ← Message In

**Lane** (\`bpmn-lane\`) — #818cf8
- Fields: name (string, pill), description (string, summary)
- Ports: child ← Pool, parent → Elements

### Artifacts

**Data Object** (\`bpmn-data-object\`) — #8b5cf6 — shape: document
- Fields: name (string, pill), state (string, summary), description (string, summary)
- Ports: data-link ↔ Used By

## Connection Patterns
- Start Event →(seq-out)→ Activity →(seq-out)→ Gateway
- Gateway →(seq-out)→ Activity (conditional flows)
- Gateway →(seq-out)→ Gateway (merge after parallel paths)
- Activity →(seq-out)→ End Event
- Pool ←(message-out)→ Pool (cross-organization communication)
- Activity →(data-out)→ Data Object (reads/writes)
- Pool →(parent)→ Lane →(parent)→ Activity (organizational hierarchy)

## Display Recommendations
- Shape coding: circles for events, rectangles for activities, diamonds for gateways
- Color coding: green start, red end, blue activities, yellow gateways
- Pools and lanes as nested organizers (vertical lanes)
- Sequence flows: solid arrows; message flows: dashed arrows
- Use badge notation for gateway types (XOR, AND, OR) per doc05.01
- Data objects as separate layer with dotted connections
`;
