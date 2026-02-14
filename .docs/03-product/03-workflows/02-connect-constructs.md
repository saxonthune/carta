---
title: Connect Constructs
status: draft
---

# Connect Constructs

## Steps

1. Hover over the bottom of a construct node to expand the port drawer
2. The drawer shows colored port circles with labels
3. Click and drag from a port circle to initiate a connection
4. As you drag, target nodes display horizontal strip drop zones ordered by port array index
5. Valid drop zones are colored (matching the target port color); invalid ones are grayed out
6. Drop on a valid zone to create the connection
7. The edge appears on canvas using dynamic nearest-edge routing; connection data is stored on the source construct

## Validation Feedback

- Invalid drop zones are visually distinct (gray, dotted border)
- Self-connections are not allowed
- Same-construct connections are not allowed
- Polarity rules: source-source and sink-sink pairs are blocked
- Compatibility rules: plain source+sink require compatibleWith match; relay/intercept/bidirectional bypass this

## Features

- doc03.01.01.03 (Ports and Connections)
- doc03.01.01.01 (Canvas)
