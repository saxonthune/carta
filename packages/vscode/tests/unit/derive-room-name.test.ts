import { describe, it, expect } from 'vitest';
import { deriveRoomName } from '../../src/find-carta-workspace.js';

describe('deriveRoomName', () => {
  it('derives room name from canvas file path', () => {
    expect(deriveRoomName('/project/.carta', '/project/.carta/01-vision/sketch.canvas.json'))
      .toBe('01-vision/sketch');
  });

  it('returns null for files outside .carta dir', () => {
    expect(deriveRoomName('/project/.carta', '/other/file.canvas.json'))
      .toBeNull();
  });

  it('returns null for non-canvas files', () => {
    expect(deriveRoomName('/project/.carta', '/project/.carta/readme.md'))
      .toBeNull();
  });

  it('handles nested paths', () => {
    expect(deriveRoomName('/project/.carta', '/project/.carta/a/b/c.canvas.json'))
      .toBe('a/b/c');
  });

  it('handles root-level canvas file', () => {
    expect(deriveRoomName('/project/.carta', '/project/.carta/main.canvas.json'))
      .toBe('main');
  });
});
