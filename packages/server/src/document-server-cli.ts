#!/usr/bin/env node
import { startServer } from './document-server.js';

const instance = await startServer();

process.on('SIGINT', async () => {
  const { stopServer } = await import('./document-server.js');
  await stopServer(instance);
  process.exit(0);
});
