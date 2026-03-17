import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  writeServerDiscovery,
  readServerDiscovery,
  cleanupServerDiscovery,
  getDefaultDiscoveryPath,
} from '../src/server-discovery.js';

describe('server-discovery', () => {
  const tmpDir = path.join(os.tmpdir(), `carta-discovery-test-${process.pid}`);
  const testPath = path.join(tmpDir, 'server.json');

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  describe('writeServerDiscovery + readServerDiscovery (round-trip)', () => {
    it('writes and reads back equivalent info', () => {
      const info = { url: 'http://127.0.0.1:51234', wsUrl: 'ws://127.0.0.1:51234', pid: process.pid };
      writeServerDiscovery(testPath, info);
      const result = readServerDiscovery(testPath);
      expect(result).toEqual(info);
    });

    it('creates parent directory if it does not exist', () => {
      const nested = path.join(tmpDir, 'deep', 'nested', 'server.json');
      const info = { url: 'http://127.0.0.1:9999', wsUrl: 'ws://127.0.0.1:9999', pid: process.pid };
      writeServerDiscovery(nested, info);
      expect(fs.existsSync(nested)).toBe(true);
    });
  });

  describe('readServerDiscovery (stale PID)', () => {
    it('returns null when PID is not running', () => {
      const info = { url: 'http://127.0.0.1:51234', wsUrl: 'ws://127.0.0.1:51234', pid: 999999 };
      writeServerDiscovery(testPath, info);

      // Mock process.kill to throw (simulating dead process)
      vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });

      const result = readServerDiscovery(testPath);
      expect(result).toBeNull();
    });
  });

  describe('readServerDiscovery (missing/malformed)', () => {
    it('returns null when file does not exist', () => {
      expect(readServerDiscovery('/nonexistent/server.json')).toBeNull();
    });

    it('returns null when file is malformed JSON', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(testPath, 'not json');
      expect(readServerDiscovery(testPath)).toBeNull();
    });

    it('returns null when url or pid is missing', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(testPath, JSON.stringify({ url: 'http://localhost' }));
      expect(readServerDiscovery(testPath)).toBeNull();
    });
  });

  describe('cleanupServerDiscovery', () => {
    it('removes server.json', () => {
      const info = { url: 'http://127.0.0.1:51234', wsUrl: 'ws://127.0.0.1:51234', pid: process.pid };
      writeServerDiscovery(testPath, info);
      expect(fs.existsSync(testPath)).toBe(true);

      cleanupServerDiscovery(testPath);
      expect(readServerDiscovery(testPath)).toBeNull();
      expect(fs.existsSync(testPath)).toBe(false);
    });

    it('is a no-op when file does not exist', () => {
      // Should not throw
      cleanupServerDiscovery('/nonexistent/server.json');
    });
  });

  describe('getDefaultDiscoveryPath', () => {
    it('returns a path ending in server.json', () => {
      const result = getDefaultDiscoveryPath();
      expect(path.basename(result)).toBe('server.json');
      expect(result).toContain('@carta');
    });
  });
});
