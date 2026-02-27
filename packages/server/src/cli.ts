#!/usr/bin/env node
/**
 * carta CLI — subcommand dispatcher
 *
 * Usage:
 *   carta init    Initialize a .carta/ workspace in the current directory
 *   carta serve   Start a workspace server for a .carta/ directory
 */

const [subcommand] = process.argv.slice(2);

switch (subcommand) {
  case 'init': {
    const { runInitInteractive } = await import('./init.js');
    await runInitInteractive(process.cwd());
    break;
  }
  case 'serve': {
    const { default: nodePath } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { existsSync } = await import('node:fs');

    const args = process.argv.slice(3); // skip 'node', 'cli.js', 'serve'
    let directory = '.';
    let port: number | undefined;
    let host: string | undefined;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--port' && args[i + 1]) {
        port = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i] === '--host' && args[i + 1]) {
        host = args[i + 1];
        i++;
      } else if (!args[i].startsWith('-')) {
        directory = args[i];
      }
    }

    const cartaDir = nodePath.resolve(directory, '.carta');
    const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
    const clientDir = nodePath.resolve(__dirname, '../../web-client/dist');

    if (!existsSync(clientDir)) {
      console.error(`Web client not built. Run 'pnpm build' in the project root first.`);
      process.exit(1);
    }

    const { startWorkspaceServer, stopWorkspaceServer } = await import('./workspace-server.js');
    const info = await startWorkspaceServer({ cartaDir, port, host, clientDir });

    console.log(`Carta workspace server running\n`);
    console.log(`  Local:   ${info.url}`);
    console.log(`  Serving: ${cartaDir}/\n`);
    console.log(`Press Ctrl+C to stop.`);

    process.on('SIGINT', async () => {
      await stopWorkspaceServer();
      process.exit(0);
    });

    break;
  }
  default:
    console.log('Usage: carta <command>\n');
    console.log('Commands:');
    console.log('  init    Initialize a .carta/ workspace in the current directory');
    console.log('  serve   Start a workspace server for a .carta/ directory');
    process.exit(subcommand ? 1 : 0);
}
