import type { DataKind } from '@carta/domain';
import StringField from './StringField';
import NumberField from './NumberField';
import BooleanField from './BooleanField';
import DateField from './DateField';
import EnumField from './EnumField';

export { StringField, NumberField, BooleanField, DateField, EnumField };

// Stub — real ResourceField component is built in task 05
const ResourceFieldStub: React.ComponentType<any> = () => null;

/**
 * Field renderer registry - maps data kinds to their components
 */
export const fieldRenderers: Record<DataKind, React.ComponentType<any>> = {
  string: StringField,
  number: NumberField,
  boolean: BooleanField,
  date: DateField,
  enum: EnumField,
  resource: ResourceFieldStub,
};

export default fieldRenderers;
