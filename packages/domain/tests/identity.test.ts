import { describe, it, expect } from 'vitest';
import { generateSemanticId, generateDocumentId, toKebabCase, toSnakeCase } from '../src/utils/identity';

describe('toKebabCase', () => {
  it('should convert camelCase', () => {
    expect(toKebabCase('myServiceName')).toBe('myservicename');
  });

  it('should handle already-kebab', () => {
    expect(toKebabCase('my-name')).toBe('my-name');
  });

  it('should handle PascalCase', () => {
    expect(toKebabCase('MyService')).toBe('myservice');
  });

  it('should handle spaces', () => {
    expect(toKebabCase('My Service')).toBe('my-service');
  });

  it('should handle mixed case with spaces', () => {
    expect(toKebabCase('My Service Name')).toBe('my-service-name');
  });
});

describe('toSnakeCase', () => {
  it('should convert camelCase', () => {
    expect(toSnakeCase('myServiceName')).toBe('myservicename');
  });

  it('should handle spaces', () => {
    expect(toSnakeCase('My Field Name')).toBe('my_field_name');
  });

  it('should handle already-snake', () => {
    expect(toSnakeCase('my_field')).toBe('my_field');
  });
});

describe('generateSemanticId', () => {
  it('should include construct type in kebab form', () => {
    const id = generateSemanticId('apiEndpoint');
    expect(id).toMatch(/^apiendpoint-/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateSemanticId('service');
    const id2 = generateSemanticId('service');
    expect(id1).not.toBe(id2);
  });

  it('should handle underscores in construct type', () => {
    const id = generateSemanticId('api_endpoint');
    expect(id).toMatch(/^api-endpoint-/);
  });
});

describe('generateDocumentId', () => {
  it('should return a non-empty string', () => {
    const id = generateDocumentId();
    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(0);
  });

  it('should start with doc- prefix', () => {
    const id = generateDocumentId();
    expect(id).toMatch(/^doc-/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateDocumentId();
    const id2 = generateDocumentId();
    expect(id1).not.toBe(id2);
  });
});
