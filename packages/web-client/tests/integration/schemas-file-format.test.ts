import { describe, it, expect } from 'vitest';
import { importSchemasFromString, validateCartaSchemasFile, exportSchemasToString } from '../../../document/src/file-format';
import type { CartaSchemasFile } from '../../../domain/src/types';

describe('.carta-schemas file format', () => {
  const validFile: CartaSchemasFile = {
    formatVersion: 1,
    name: 'Test Schema Library',
    description: 'A test schema library',
    version: 1,
    changelog: 'Initial version',
    schemas: [
      {
        type: 'test-schema',
        displayName: 'Test Schema',
        color: '#000',
        fields: [],
        compilation: { format: 'json' },
      },
    ],
    portSchemas: [
      {
        id: 'test-port',
        displayName: 'Test Port',
        semanticDescription: 'A test port',
        polarity: 'source',
        compatibleWith: [],
        color: '#fff',
      },
    ],
    schemaGroups: [
      {
        id: 'test-group',
        name: 'Test Group',
      },
    ],
    exportedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('validateCartaSchemasFile', () => {
    it('validates a valid .carta-schemas file', () => {
      const result = validateCartaSchemasFile(validFile);
      expect(result.formatVersion).toBe(1);
      expect(result.name).toBe('Test Schema Library');
      expect(result.schemas).toHaveLength(1);
      expect(result.portSchemas).toHaveLength(1);
      expect(result.schemaGroups).toHaveLength(1);
    });

    it('throws on non-object input', () => {
      expect(() => validateCartaSchemasFile(null)).toThrow('expected JSON object');
      expect(() => validateCartaSchemasFile('string')).toThrow('expected JSON object');
      expect(() => validateCartaSchemasFile(123)).toThrow('expected JSON object');
    });

    it('throws on missing formatVersion', () => {
      const invalid = { ...validFile };
      delete (invalid as { formatVersion?: number }).formatVersion;
      expect(() => validateCartaSchemasFile(invalid)).toThrow('formatVersion must be 1');
    });

    it('throws on wrong formatVersion', () => {
      const invalid = { ...validFile, formatVersion: 2 };
      expect(() => validateCartaSchemasFile(invalid)).toThrow('formatVersion must be 1');
    });

    it('throws on missing name', () => {
      const invalid = { ...validFile };
      delete (invalid as { name?: string }).name;
      expect(() => validateCartaSchemasFile(invalid)).toThrow('missing or invalid name');
    });

    it('throws on missing version', () => {
      const invalid = { ...validFile };
      delete (invalid as { version?: number }).version;
      expect(() => validateCartaSchemasFile(invalid)).toThrow('missing or invalid version');
    });

    it('throws on missing exportedAt', () => {
      const invalid = { ...validFile };
      delete (invalid as { exportedAt?: string }).exportedAt;
      expect(() => validateCartaSchemasFile(invalid)).toThrow('missing or invalid exportedAt');
    });

    it('throws on missing schemas array', () => {
      const invalid = { ...validFile };
      delete (invalid as { schemas?: unknown[] }).schemas;
      expect(() => validateCartaSchemasFile(invalid)).toThrow('missing or invalid schemas array');
    });

    it('throws on missing portSchemas array', () => {
      const invalid = { ...validFile };
      delete (invalid as { portSchemas?: unknown[] }).portSchemas;
      expect(() => validateCartaSchemasFile(invalid)).toThrow('missing or invalid portSchemas array');
    });

    it('throws on missing schemaGroups array', () => {
      const invalid = { ...validFile };
      delete (invalid as { schemaGroups?: unknown[] }).schemaGroups;
      expect(() => validateCartaSchemasFile(invalid)).toThrow('missing or invalid schemaGroups array');
    });

    it('throws on invalid schema structure', () => {
      const invalid = {
        ...validFile,
        schemas: [{ type: 'incomplete' }],
      };
      expect(() => validateCartaSchemasFile(invalid)).toThrow('schema missing required fields');
    });

    it('throws on invalid portSchema structure', () => {
      const invalid = {
        ...validFile,
        portSchemas: [{ id: 'incomplete' }],
      };
      expect(() => validateCartaSchemasFile(invalid)).toThrow('portSchema missing required fields');
    });

    it('throws on invalid portSchema polarity', () => {
      const invalid = {
        ...validFile,
        portSchemas: [
          {
            id: 'test-port',
            displayName: 'Test Port',
            semanticDescription: 'A test port',
            polarity: 'invalid-polarity',
            compatibleWith: [],
            color: '#fff',
          },
        ],
      };
      expect(() => validateCartaSchemasFile(invalid)).toThrow('invalid polarity');
    });

    it('throws on invalid schemaGroup structure', () => {
      const invalid = {
        ...validFile,
        schemaGroups: [{ id: 'incomplete' }],
      };
      expect(() => validateCartaSchemasFile(invalid)).toThrow('schemaGroup missing required fields');
    });
  });

  describe('importSchemasFromString', () => {
    it('parses and validates valid JSON', () => {
      const json = JSON.stringify(validFile);
      const result = importSchemasFromString(json);
      expect(result.name).toBe('Test Schema Library');
      expect(result.schemas).toHaveLength(1);
    });

    it('throws on invalid JSON syntax', () => {
      expect(() => importSchemasFromString('not json')).toThrow();
    });

    it('throws on invalid structure', () => {
      const invalid = JSON.stringify({ formatVersion: 999 });
      expect(() => importSchemasFromString(invalid)).toThrow();
    });
  });

  describe('exportSchemasToString', () => {
    it('serializes to formatted JSON', () => {
      const json = exportSchemasToString(validFile);
      expect(json).toContain('"formatVersion": 1');
      expect(json).toContain('"name": "Test Schema Library"');
      expect(JSON.parse(json)).toEqual(validFile);
    });
  });

  describe('round-trip', () => {
    it('export → import returns equivalent data', () => {
      const exported = exportSchemasToString(validFile);
      const imported = importSchemasFromString(exported);
      expect(imported).toEqual(validFile);
    });
  });
});
