#!/usr/bin/env node
/**
 * carta CLI — subcommand dispatcher
 *
 * Usage:
 *   carta init    Initialize a .carta/ workspace in the current directory
 *   carta serve   Start a workspace server (coming soon)
 */

const [subcommand] = process.argv.slice(2);

switch (subcommand) {
  case 'init': {
    const { runInitInteractive } = await import('./init.js');
    await runInitInteractive(process.cwd());
    break;
  }
  case 'serve':
    console.error('carta serve is not yet implemented. Use the document-server for now.');
    process.exit(1);
    break;
  default:
    console.log('Usage: carta <command>\n');
    console.log('Commands:');
    console.log('  init    Initialize a .carta/ workspace in the current directory');
    console.log('  serve   Start a workspace server (coming soon)');
    process.exit(subcommand ? 1 : 0);
}
