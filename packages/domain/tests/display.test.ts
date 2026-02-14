import { describe, it, expect } from 'vitest';
import { getDisplayName, getFieldsForTier, getFieldsForSummary, semanticIdToLabel } from '../src/utils/display';
import type { ConstructNodeData, ConstructSchema, FieldSchema, CompilationFormat } from '../src/types/index';

describe('semanticIdToLabel', () => {
  it('should convert kebab-case to title case', () => {
    const label = semanticIdToLabel('api-endpoint-001');
    expect(label).toBe('Endpoint 001');
  });

  it('should handle simple IDs', () => {
    const label = semanticIdToLabel('service-1');
    expect(label).toBe('1');
  });

  it('should handle multi-word IDs', () => {
    const label = semanticIdToLabel('controller-user-api');
    expect(label).toBe('User Api');
  });
});

describe('getFieldsForTier', () => {
  it('should filter fields by display tier', () => {
    const schema: ConstructSchema = {
      type: 'test',
      displayName: 'Test',
      color: '#000',
      fields: [
        { name: 'field1', label: 'Field 1', type: 'string', displayTier: 'pill' },
        { name: 'field2', label: 'Field 2', type: 'string', displayTier: 'summary' },
        { name: 'field3', label: 'Field 3', type: 'string', displayTier: 'summary' },
        { name: 'field4', label: 'Field 4', type: 'string' },
      ],
      compilation: { format: 'json' as CompilationFormat },
    };

    const summaryFields = getFieldsForTier(schema, 'summary');
    expect(summaryFields.length).toBe(2);
    expect(summaryFields[0].name).toBe('field2');

    const pillFields = getFieldsForTier(schema, 'pill');
    expect(pillFields.length).toBe(1);
    expect(pillFields[0].name).toBe('field1');
  });

  it('should sort fields by displayOrder', () => {
    const schema: ConstructSchema = {
      type: 'test',
      displayName: 'Test',
      color: '#000',
      fields: [
        { name: 'field1', label: 'Field 1', type: 'string', displayTier: 'summary', displayOrder: 2 },
        { name: 'field2', label: 'Field 2', type: 'string', displayTier: 'summary', displayOrder: 1 },
        { name: 'field3', label: 'Field 3', type: 'string', displayTier: 'summary', displayOrder: 3 },
      ],
      compilation: { format: 'json' as CompilationFormat },
    };

    const fields = getFieldsForTier(schema, 'summary');
    expect(fields.map(f => f.name)).toEqual(['field2', 'field1', 'field3']);
  });
});

describe('getFieldsForSummary', () => {
  it('should return summary tier fields only', () => {
    const schema: ConstructSchema = {
      type: 'test',
      displayName: 'Test',
      color: '#000',
      fields: [
        { name: 'field1', label: 'Field 1', type: 'string', displayTier: 'pill' },
        { name: 'field2', label: 'Field 2', type: 'string', displayTier: 'summary' },
        { name: 'field3', label: 'Field 3', type: 'string', displayTier: 'summary' },
        { name: 'field4', label: 'Field 4', type: 'string' },
      ],
      compilation: { format: 'json' as CompilationFormat },
    };

    const summaryFields = getFieldsForSummary(schema);
    expect(summaryFields.length).toBe(2);
    expect(summaryFields.map(f => f.name)).toContain('field2');
    expect(summaryFields.map(f => f.name)).toContain('field3');
    expect(summaryFields.map(f => f.name)).not.toContain('field1');
    expect(summaryFields.map(f => f.name)).not.toContain('field4');
  });
});

describe('getDisplayName', () => {
  it('should use displayField value when available', () => {
    const schema: ConstructSchema = {
      type: 'test',
      displayName: 'Test',
      color: '#000',
      fields: [
        { name: 'title', label: 'Title', type: 'string', displayTier: 'pill' },
        { name: 'description', label: 'Description', type: 'string', displayTier: 'summary' },
      ],
      compilation: { format: 'json' as CompilationFormat },
    };

    const data: ConstructNodeData = {
      constructType: 'test',
      semanticId: 'test-123',
      values: {
        title: 'My Test Item',
        description: 'A description',
      },
    };

    const displayName = getDisplayName(data, schema);
    expect(displayName).toBe('My Test Item');
  });

  it('should fall back to semanticId', () => {
    const schema: ConstructSchema = {
      type: 'test',
      displayName: 'Test',
      color: '#000',
      fields: [
        { name: 'title', label: 'Title', type: 'string', displayTier: 'pill' },
      ],
      compilation: { format: 'json' as CompilationFormat },
    };

    const data: ConstructNodeData = {
      constructType: 'test',
      semanticId: 'test-456',
      values: {},
    };

    const displayName = getDisplayName(data, schema);
    expect(displayName).toBe('test-456');
  });

  it('should fall back to semanticId when schema is undefined', () => {
    const data: ConstructNodeData = {
      constructType: 'test',
      semanticId: 'test-789',
      values: {
        title: 'My Test Item',
      },
    };

    const displayName = getDisplayName(data, undefined);
    expect(displayName).toBe('test-789');
  });
});
