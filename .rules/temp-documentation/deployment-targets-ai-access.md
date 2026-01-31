# 

## Data abstraction

1. Portfolio. User flows: mental collection for user; show cartas connected to project; user navigates around lists of cartas; users make their own spaces; hosted projects have permissions, owners, etc; cartas have descriptions and tagging
2. Carta. User works in a scoped mental domain; user edits a map and metamap, manipulating instances, schema, and ports.

## Three deployments
Portfolios can be hosted via the filesystem, or by an api + server. The server just implements the api operations

| deployment | filesystem portfolio? | server portfolio? |
| --- | --- | --- |
| 1. Static PWA | no | no |
| 2. web client | yes | yes |
| 3. desktop client | yes | yes |

## Server

User connects to a server to: get source of truth; collaborate and share Cartas and portfolios; access data from multiple devices.
Server has many portfolios, and portfolios have many Cartas

## AI Access

- chat + api key: user inputs an openrouter key or similar, requests go to ai provider. AI has access to Carta state
- server-managed chat: user prompts are sent to server

| deployment | chat + api key | server-managed | mcp local | mcp remote
| --- | --- | --- |
| 1. Static PWA | yes | no | no | no |
| 2. web client | yes | yes | no | yes |
| 3. desktop client | yes | yes | yes | yes |
