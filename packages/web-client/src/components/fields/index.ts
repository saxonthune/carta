import type { DataKind } from '@carta/schema';
import StringField from './StringField';
import NumberField from './NumberField';
import BooleanField from './BooleanField';
import DateField from './DateField';
import EnumField from './EnumField';

export { StringField, NumberField, BooleanField, DateField, EnumField };

/**
 * Field renderer registry - maps data kinds to their components
 */
export const fieldRenderers = {
  string: StringField,
  number: NumberField,
  boolean: BooleanField,
  date: DateField,
  enum: EnumField,
} as Record<DataKind, React.ComponentType<any>>;

export default fieldRenderers;
