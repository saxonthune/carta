import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { ConstructSchema, FieldSchema } from '@carta/domain';
import {
  renameField as renameFieldOp,
  removeField as removeFieldOp,
  addField as addFieldOp,
  changeFieldType as changeFieldTypeOp,
  narrowEnumOptions as narrowEnumOptionsOp,
  type MigrationResult,
} from '@carta/document';

/**
 * Focused hook for schema state and operations.
 * Only re-renders when schemas change.
 */
export function useSchemas() {
  const { adapter } = useDocumentContext();

  const [schemas, setSchemasState] = useState<ConstructSchema[]>(() => adapter.getSchemas());

  useEffect(() => {
    const unsubscribe = adapter.subscribeToSchemas
      ? adapter.subscribeToSchemas(() => setSchemasState(adapter.getSchemas()))
      : adapter.subscribe(() => setSchemasState(adapter.getSchemas()));
    return unsubscribe;
  }, [adapter]);

  // Memoized lookup map for getSchema
  const schemaById = useMemo(() => {
    const map = new Map<string, ConstructSchema>();
    for (const schema of schemas) {
      map.set(schema.type, schema);
    }
    return map;
  }, [schemas]);

  const getSchema = useCallback(
    (type: string) => schemaById.get(type),
    [schemaById]
  );

  const setSchemas = useCallback(
    (newSchemas: ConstructSchema[]) => {
      adapter.setSchemas(newSchemas);
    },
    [adapter]
  );

  const addSchema = useCallback(
    (schema: ConstructSchema) => {
      adapter.addSchema(schema);
    },
    [adapter]
  );

  const updateSchema = useCallback(
    (type: string, updates: Partial<ConstructSchema>) => {
      adapter.updateSchema(type, updates);
    },
    [adapter]
  );

  const removeSchema = useCallback(
    (type: string) => adapter.removeSchema(type),
    [adapter]
  );

  // Migration operations for field evolution
  const renameField = useCallback(
    (schemaType: string, oldName: string, newName: string): MigrationResult => {
      const ydoc = (adapter as unknown as { ydoc: import('yjs').Doc }).ydoc;
      return renameFieldOp(ydoc, schemaType, oldName, newName, 'user');
    },
    [adapter]
  );

  const removeField = useCallback(
    (schemaType: string, fieldName: string): MigrationResult => {
      const ydoc = (adapter as unknown as { ydoc: import('yjs').Doc }).ydoc;
      return removeFieldOp(ydoc, schemaType, fieldName, 'user');
    },
    [adapter]
  );

  const addFieldToSchema = useCallback(
    (schemaType: string, field: FieldSchema, defaultValue?: unknown): MigrationResult => {
      const ydoc = (adapter as unknown as { ydoc: import('yjs').Doc }).ydoc;
      return addFieldOp(ydoc, schemaType, field as unknown as Record<string, unknown>, defaultValue, 'user');
    },
    [adapter]
  );

  const changeFieldType = useCallback(
    (schemaType: string, fieldName: string, newType: string, options?: { force?: boolean; enumOptions?: string[] }): MigrationResult => {
      const ydoc = (adapter as unknown as { ydoc: import('yjs').Doc }).ydoc;
      return changeFieldTypeOp(ydoc, schemaType, fieldName, newType, options, 'user');
    },
    [adapter]
  );

  const narrowEnumOptions = useCallback(
    (schemaType: string, fieldName: string, newOptions: string[], valueMapping?: Record<string, string>): MigrationResult => {
      const ydoc = (adapter as unknown as { ydoc: import('yjs').Doc }).ydoc;
      return narrowEnumOptionsOp(ydoc, schemaType, fieldName, newOptions, valueMapping, 'user');
    },
    [adapter]
  );

  return {
    schemas,
    schemaById,
    getSchema,
    setSchemas,
    addSchema,
    updateSchema,
    removeSchema,
    renameField,
    removeField,
    addFieldToSchema,
    changeFieldType,
    narrowEnumOptions,
  };
}
