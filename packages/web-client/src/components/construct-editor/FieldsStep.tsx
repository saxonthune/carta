import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import TierZone from '../field-display/TierZone';
import DraggableField from '../field-display/DraggableField';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FieldSubWizard from '../schema-wizard/FieldSubWizard';
import { toSnakeCase } from '../../utils/stringUtils';
import type { ConstructSchema, FieldSchema, DisplayTier } from '@carta/domain';

const TIERS: { tier: DisplayTier; label: string; description: string; maxItems?: number }[] = [
  { tier: 'pill', label: 'Title (Pill)', description: 'Node title shown in pill and compact modes. Only one field allowed.', maxItems: 1 },
  { tier: 'summary', label: 'Summary', description: 'Shown on canvas nodes.' },
];

interface FieldsStepProps {
  formData: ConstructSchema;
  setFormData: React.Dispatch<React.SetStateAction<ConstructSchema>>;
  fieldAssignments: Map<string, { tier: DisplayTier | undefined; order: number }>;
  setFieldAssignments: React.Dispatch<React.SetStateAction<Map<string, { tier: DisplayTier | undefined; order: number }>>>;
  isEditMode?: boolean;
  onRenameField?: (oldName: string, newName: string) => void;
  onRemoveField?: (fieldName: string) => void;
  onAddField?: (field: FieldSchema, defaultValue?: unknown) => void;
  onChangeFieldType?: (fieldName: string, newType: string, enumOptions?: string[]) => void;
}

export default function FieldsStep({
  formData,
  setFormData,
  fieldAssignments,
  setFieldAssignments,
  isEditMode = false,
  onRenameField,
  onRemoveField: onRemoveFieldCallback,
  onAddField: onAddFieldCallback,
  onChangeFieldType,
}: FieldsStepProps) {
  const [activeField, setActiveField] = useState<FieldSchema | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [addingField, setAddingField] = useState(false);

  const getFieldsForTier = useCallback((tier: DisplayTier | undefined): FieldSchema[] => {
    return formData.fields
      .filter((f) => {
        const a = fieldAssignments.get(f.name);
        return a && a.tier === tier;
      })
      .sort((a, b) => {
        const aOrder = fieldAssignments.get(a.name)?.order ?? 0;
        const bOrder = fieldAssignments.get(b.name)?.order ?? 0;
        return aOrder - bOrder;
      });
  }, [formData.fields, fieldAssignments]);

  const getFieldIdsForTier = useCallback((tier: DisplayTier | undefined): string[] => {
    return getFieldsForTier(tier).map((f) => f.name);
  }, [getFieldsForTier]);

  const findTierForField = useCallback((fieldName: string): DisplayTier | undefined | null => {
    const a = fieldAssignments.get(fieldName);
    if (!a) return null; // field not in map at all
    return a.tier; // may be undefined (inspector-only)
  }, [fieldAssignments]);

  // --- Drag handlers ---
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const field = formData.fields.find((f) => f.name === event.active.id);
    setActiveField(field ?? null);
  }, [formData.fields]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeFieldName = String(active.id);
    const overId = String(over.id);

    let targetTier: DisplayTier | undefined | null = null;
    if (overId.startsWith('tier-')) {
      const tierStr = overId.replace('tier-', '');
      targetTier = tierStr === 'unassigned' ? undefined : tierStr as DisplayTier;
    } else {
      targetTier = findTierForField(overId);
    }

    if (targetTier === null) return;
    const currentTier = findTierForField(activeFieldName);
    if (currentTier === targetTier) return;

    setFieldAssignments((prev) => {
      const next = new Map(prev);
      const current = next.get(activeFieldName);
      if (!current) return prev;

      // If target is pill and already has a field, bump existing to summary
      if (targetTier === 'pill') {
        const existingPill = formData.fields.find(
          (f) => f.name !== activeFieldName && next.get(f.name)?.tier === 'pill'
        );
        if (existingPill) {
          next.set(existingPill.name, { tier: 'summary', order: 0 });
        }
      }

      const fieldsInTargetTier = formData.fields.filter(
        (f) => f.name !== activeFieldName && next.get(f.name)?.tier === targetTier
      );
      next.set(activeFieldName, {
        tier: targetTier!,
        order: fieldsInTargetTier.length,
      });

      return next;
    });
  }, [findTierForField, formData.fields, setFieldAssignments]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveField(null);
    const { active, over } = event;
    if (!over) return;

    const activeFieldName = String(active.id);
    const overId = String(over.id);

    if (overId.startsWith('tier-')) return;

    const activeTier = findTierForField(activeFieldName);
    const overTier = findTierForField(overId);

    if (activeTier && activeTier === overTier) {
      const tierFields = getFieldIdsForTier(activeTier);
      const oldIndex = tierFields.indexOf(activeFieldName);
      const newIndex = tierFields.indexOf(overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(tierFields, oldIndex, newIndex);
        setFieldAssignments((prev) => {
          const next = new Map(prev);
          reordered.forEach((name, index) => {
            const existing = next.get(name);
            if (existing) {
              next.set(name, { ...existing, order: index });
            }
          });
          return next;
        });
      }
    }
  }, [findTierForField, getFieldIdsForTier, setFieldAssignments]);

  // --- Field CRUD ---
  const addField = () => {
    if (isEditMode && onAddFieldCallback) {
      // In edit mode, open the modal to create a field, then call migration
      const newField: FieldSchema = {
        name: `field_${formData.fields.length + 1}`,
        label: '',
        type: 'string',
      };
      setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
      setFieldAssignments(prev => {
        const next = new Map(prev);
        next.set(newField.name, { tier: undefined, order: prev.size });
        return next;
      });
      setAddingField(true);
      setEditingFieldIndex(formData.fields.length);
    } else {
      // Creation mode: local state mutation
      const newField: FieldSchema = {
        name: `field_${formData.fields.length + 1}`,
        label: '',
        type: 'string',
      };
      setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
      setFieldAssignments(prev => {
        const next = new Map(prev);
        next.set(newField.name, { tier: undefined, order: prev.size });
        return next;
      });
      setAddingField(true);
      setEditingFieldIndex(formData.fields.length);
    }
  };

  const updateFieldAt = (index: number, updates: Partial<FieldSchema>) => {
    const oldField = formData.fields[index];
    if (updates.label !== undefined) {
      updates.name = toSnakeCase(updates.label);
    }

    // In edit mode, if adding a new field, we need to track it until saved
    const isAddingNewField = isEditMode && addingField && index === editingFieldIndex;

    // Handle type changes in edit mode (call migration)
    if (isEditMode && !isAddingNewField && updates.type && updates.type !== oldField.type && onChangeFieldType) {
      const enumOptions = updates.type === 'enum' ? (updates.options?.map(o => o.value) || []) : undefined;
      onChangeFieldType(oldField.name, updates.type, enumOptions);
    }

    setFormData(prev => {
      const updated = {
        ...prev,
        fields: prev.fields.map((f, i) => i === index ? { ...f, ...updates } : f),
      };
      return updated;
    });
    // If name changed, update assignment key
    if (updates.name && updates.name !== oldField.name) {
      setFieldAssignments(prev => {
        const next = new Map(prev);
        const existing = next.get(oldField.name);
        if (existing) {
          next.delete(oldField.name);
          next.set(updates.name!, existing);
        }
        return next;
      });

      // In edit mode, call rename migration (unless we're adding a new field)
      if (isEditMode && !isAddingNewField && onRenameField) {
        onRenameField(oldField.name, updates.name);
      }
    }
  };

  const removeField = (index: number) => {
    const field = formData.fields[index];

    // In edit mode, call migration operation
    if (isEditMode && onRemoveFieldCallback) {
      if (window.confirm(`Remove field "${field.label || field.name}"? This will delete the field from the schema and remove all instance data.`)) {
        onRemoveFieldCallback(field.name);
      }
      return;
    }

    // Creation mode: local state mutation
    setFormData(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
    setFieldAssignments(prev => {
      const next = new Map(prev);
      next.delete(field.name);
      return next;
    });
  };

  const closeFieldModal = () => {
    // If adding a new field and it has no label, remove it
    if (addingField && editingFieldIndex !== null) {
      const field = formData.fields[editingFieldIndex];
      if (field && !field.label.trim()) {
        // Remove from local state (creation mode) or just don't save (edit mode)
        if (!isEditMode) {
          removeField(editingFieldIndex);
        } else {
          // Just remove from local state - it was never migrated
          setFormData(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== editingFieldIndex) }));
          setFieldAssignments(prev => {
            const next = new Map(prev);
            next.delete(field.name);
            return next;
          });
        }
      } else if (isEditMode && onAddFieldCallback && field) {
        // Save the new field via migration
        const defaultValue = field.default;
        onAddFieldCallback(field, defaultValue);
      }
    }
    setEditingFieldIndex(null);
    setAddingField(false);
  };

  return (
    <>
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-1 relative">
          {TIERS.map((t, idx) => (
            <div key={t.tier} className="relative">
              {idx === 0 && (
                <button
                  className="absolute top-2 right-2 z-10 px-2 py-1 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded transition-colors cursor-pointer border-none"
                  onClick={addField}
                  title="Add a new field"
                >
                  + Add Field
                </button>
              )}
              <TierZone
                tier={t.tier}
                label={t.label}
                description={t.description}
                fields={getFieldsForTier(t.tier)}
                fieldIds={getFieldIdsForTier(t.tier)}
                maxItems={t.maxItems}
                onEditField={(fieldName) => {
                  const index = formData.fields.findIndex(f => f.name === fieldName);
                  if (index !== -1) {
                    setEditingFieldIndex(index);
                    setAddingField(false);
                  }
                }}
                onRemoveField={(fieldName) => {
                  const index = formData.fields.findIndex(f => f.name === fieldName);
                  if (index !== -1) removeField(index);
                }}
              />
            </div>
          ))}
          {/* Inspector Only zone for unassigned fields */}
          <div className="relative">
            <TierZone
              tier={undefined}
              label="Inspector Only"
              description="Fields visible only in the inspector panel, not shown on canvas."
              fields={getFieldsForTier(undefined)}
              fieldIds={getFieldIdsForTier(undefined)}
              onEditField={(fieldName) => {
                const index = formData.fields.findIndex(f => f.name === fieldName);
                if (index !== -1) {
                  setEditingFieldIndex(index);
                  setAddingField(false);
                }
              }}
              onRemoveField={(fieldName) => {
                const index = formData.fields.findIndex(f => f.name === fieldName);
                if (index !== -1) removeField(index);
              }}
            />
          </div>
        </div>

        <DragOverlay>
          {activeField && (
            <div className="opacity-90">
              <DraggableField field={activeField} id={activeField.name} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Field editing modal */}
      {editingFieldIndex !== null && formData.fields[editingFieldIndex] && (
        <Modal
          isOpen
          onClose={closeFieldModal}
          title={addingField ? 'New Field' : 'Edit Field'}
          maxWidth="480px"
          footer={
            <div className="flex justify-end">
              <Button variant="accent" size="sm" onClick={closeFieldModal}>
                Done
              </Button>
            </div>
          }
        >
          <FieldSubWizard
            field={formData.fields[editingFieldIndex]}
            onChange={(updates) => updateFieldAt(editingFieldIndex, updates)}
          />
        </Modal>
      )}
    </>
  );
}
