import { cpSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const webClientDist = join(__dirname, '../../web-client/dist');
const desktopRendererDist = join(__dirname, '../dist/renderer');

console.log('Copying web-client dist to desktop renderer...');
cpSync(webClientDist, desktopRendererDist, { recursive: true });
console.log('Copy complete.');
