import { describe, it, expect } from 'vitest';
import { buildDevModeHtml } from '../../src/canvas-editor-provider.js';

describe('buildDevModeHtml', () => {
  it('generates iframe pointing at dev server', () => {
    const html = buildDevModeHtml(null);
    expect(html).toContain('<iframe src="http://localhost:5173"');
  });

  it('includes room name as query parameter', () => {
    const html = buildDevModeHtml('01-vision/sketch');
    expect(html).toContain('?doc=01-vision%2Fsketch');
  });

  it('sets restrictive CSP allowing only dev server frames', () => {
    const html = buildDevModeHtml(null);
    expect(html).toContain('frame-src http://localhost:5173');
    expect(html).toContain("default-src 'none'");
  });
});
