#!/bin/bash
# Start the Yjs WebSocket collaboration server
# Default: localhost:1234

HOST=${HOST:-localhost}
PORT=${PORT:-1234}

echo "Starting Yjs WebSocket server on $HOST:$PORT"
HOST=$HOST PORT=$PORT npx y-websocket
