import { describe, it, expect } from 'vitest';
import { buildDevModeHtml } from '../../src/canvas-editor-provider.js';

describe('buildDevModeHtml', () => {
  it('generates iframe with embedded flag when no room or server', () => {
    const html = buildDevModeHtml(null, null);
    expect(html).toContain('<iframe src="http://localhost:5173?embedded=true"');
  });

  it('includes room name and syncUrl as query parameters', () => {
    const html = buildDevModeHtml('01-vision/sketch', 'http://127.0.0.1:9876');
    expect(html).toContain('doc=01-vision%2Fsketch');
    expect(html).toContain('embedded=true');
    expect(html).toContain('syncUrl=http%3A%2F%2F127.0.0.1%3A9876');
  });

  it('sets restrictive CSP allowing only dev server frames', () => {
    const html = buildDevModeHtml(null, null);
    expect(html).toContain('frame-src http://localhost:5173');
    expect(html).toContain("default-src 'none'");
  });

  it('includes connect-src when serverUrl is provided', () => {
    const html = buildDevModeHtml(null, 'http://127.0.0.1:9876');
    expect(html).toContain('connect-src ws://127.0.0.1:9876 http://127.0.0.1:9876');
  });

  it('adds display:block to iframe style', () => {
    const html = buildDevModeHtml(null, null);
    expect(html).toContain('display: block');
  });
});
