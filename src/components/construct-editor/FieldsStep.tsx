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
  { tier: 'minimal', label: 'Minimal', description: 'Shown in the collapsed/summary view on canvas.' },
  { tier: 'details', label: 'Details', description: 'Shown when the node is expanded to details view.' },
  { tier: 'full', label: 'Full', description: 'Only visible in the full view modal.' },
];

interface FieldsStepProps {
  formData: ConstructSchema;
  setFormData: React.Dispatch<React.SetStateAction<ConstructSchema>>;
  fieldAssignments: Map<string, { tier: DisplayTier; order: number }>;
  setFieldAssignments: React.Dispatch<React.SetStateAction<Map<string, { tier: DisplayTier; order: number }>>>;
}

export default function FieldsStep({ formData, setFormData, fieldAssignments, setFieldAssignments }: FieldsStepProps) {
  const [activeField, setActiveField] = useState<FieldSchema | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [addingField, setAddingField] = useState(false);

  const getFieldsForTier = useCallback((tier: DisplayTier): FieldSchema[] => {
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

  const getFieldIdsForTier = useCallback((tier: DisplayTier): string[] => {
    return getFieldsForTier(tier).map((f) => f.name);
  }, [getFieldsForTier]);

  const findTierForField = useCallback((fieldName: string): DisplayTier | null => {
    const a = fieldAssignments.get(fieldName);
    return a?.tier ?? null;
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

    let targetTier: DisplayTier | null = null;
    if (overId.startsWith('tier-')) {
      targetTier = overId.replace('tier-', '') as DisplayTier;
    } else {
      targetTier = findTierForField(overId);
    }

    if (!targetTier) return;
    const currentTier = findTierForField(activeFieldName);
    if (currentTier === targetTier) return;

    setFieldAssignments((prev) => {
      const next = new Map(prev);
      const current = next.get(activeFieldName);
      if (!current) return prev;

      // If target is pill and already has a field, bump existing to minimal
      if (targetTier === 'pill') {
        const existingPill = formData.fields.find(
          (f) => f.name !== activeFieldName && next.get(f.name)?.tier === 'pill'
        );
        if (existingPill) {
          next.set(existingPill.name, { tier: 'minimal', order: 0 });
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
    const newField: FieldSchema = {
      name: `field_${formData.fields.length + 1}`,
      label: '',
      type: 'string',
    };
    setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
    // Default new fields to "full" tier
    setFieldAssignments(prev => {
      const next = new Map(prev);
      next.set(newField.name, { tier: 'full', order: prev.size });
      return next;
    });
    setAddingField(true);
    setEditingFieldIndex(formData.fields.length);
  };

  const updateFieldAt = (index: number, updates: Partial<FieldSchema>) => {
    const oldField = formData.fields[index];
    if (updates.label !== undefined) {
      updates.name = toSnakeCase(updates.label);
    }
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? { ...f, ...updates } : f),
    }));
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
    }
  };

  const removeField = (index: number) => {
    const field = formData.fields[index];
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
        removeField(editingFieldIndex);
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
