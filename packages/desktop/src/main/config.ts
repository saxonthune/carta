import { app } from 'electron';

export const is = {
  dev: !app.isPackaged
};

export function getRendererUrl(): string {
  if (is.dev) {
    return 'http://localhost:5373';
  }
  // In production, load from bundled files
  return new URL('../renderer/index.html', import.meta.url).toString();
}
