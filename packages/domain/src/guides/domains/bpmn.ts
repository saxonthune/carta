export const BPMN_GUIDE = `# Domain: BPMN Process

## When to Use
User wants to model business processes, workflows, events, gateways, or organizational swim lanes.

## Discovery Questions
Ask these to customize the vocabulary:
- "How many swim lanes/participants?" → creates Pool and Lane schemas
- "Are there parallel paths?" → uses Parallel Gateway
- "Message events between pools?" → adds Message Flow connections
- "Timer or error events?" → uses Intermediate Event types

## Recommended Schemas
Reference seed: \`bpmn\`

| Schema | Purpose | Pill Field | Key Display |
|--------|---------|-----------|-------------|
| Start Event | Process trigger | name | circle shape, green |
| End Event | Process termination | name | circle shape, red |
| Activity | Work unit (task) | name | rectangle shape |
| Gateway | Decision/merge point | name | diamond shape, type enum |
| Intermediate Event | Mid-process event | name | circle shape, type enum |
| Pool | Process participant | name | organizer, contains lanes |
| Lane | Responsibility group | name | organizer within pool |
| Data Object | Information artifact | name | document icon |

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
