import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '../../web-client/dist');
const dest = path.resolve(__dirname, '../dist/web-client');

if (!fs.existsSync(src)) {
  console.error('web-client dist not found. Run `pnpm build` in the root first.');
  process.exit(1);
}

// Clean destination
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}

// Recursive copy
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied web-client dist → ${dest}`);
