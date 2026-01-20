import type { FieldType } from '../../constructs/types';
import TextField from './TextField';
import DropdownField from './DropdownField';
import TableField from './TableField';
import CodeField from './CodeField';

export { TextField, DropdownField, TableField, CodeField };

/**
 * Field renderer registry - maps field types to their components
 */
export const fieldRenderers: Record<FieldType, React.ComponentType<any>> = {
  text: TextField,
  dropdown: DropdownField,
  table: TableField,
  connection: TextField, // Placeholder - will be implemented later
  code: CodeField,
};

export default fieldRenderers;
