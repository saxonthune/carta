import { useCallback } from 'react';
import type { FieldDefinition, TableRow } from '../../constructs/types';

interface TableFieldProps {
  field: FieldDefinition;
  value: TableRow[];
  onChange: (value: TableRow[]) => void;
}

export default function TableField({ field, value = [], onChange }: TableFieldProps) {
  const rows = value || [];

  const addRow = useCallback(() => {
    const newRow: TableRow = {
      id: `row-${Date.now()}`,
    };
    field.columns?.forEach((col) => {
      if (col.type === 'boolean') {
        newRow[col.name] = false;
      } else if (col.type === 'dropdown' && col.options?.[0]) {
        newRow[col.name] = col.options[0];
      } else {
        newRow[col.name] = '';
      }
    });
    onChange([...rows, newRow]);
  }, [rows, field.columns, onChange]);

  const updateRow = useCallback(
    (rowId: string, colName: string, newValue: unknown) => {
      onChange(
        rows.map((row) =>
          row.id === rowId ? { ...row, [colName]: newValue } : row
        )
      );
    },
    [rows, onChange]
  );

  const deleteRow = useCallback(
    (rowId: string) => {
      onChange(rows.filter((row) => row.id !== rowId));
    },
    [rows, onChange]
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
      <div className="nodrag rounded overflow-hidden">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {field.columns?.map((col) => (
                <th key={col.name} className="px-2 py-1.5 text-left bg-surface-alt font-semibold text-content-muted border-b border">
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-1.5 bg-surface-alt border-b border"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {field.columns?.map((col) => (
                  <td key={col.name} className="p-1 border-b border-subtle last:border-b-0">
                    {col.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        className="w-auto"
                        checked={!!row[col.name]}
                        onChange={(e) =>
                          updateRow(row.id, col.name, e.target.checked)
                        }
                      />
                    ) : col.type === 'dropdown' ? (
                      <select
                        className="w-full px-1.5 py-1 border-transparent rounded text-xs bg-transparent focus:border-accent focus:bg-surface outline-none"
                        value={(row[col.name] as string) || ''}
                        onChange={(e) =>
                          updateRow(row.id, col.name, e.target.value)
                        }
                      >
                        {col.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full px-1.5 py-1 border-transparent rounded text-xs bg-transparent focus:border-accent focus:bg-surface outline-none"
                        value={(row[col.name] as string) || ''}
                        onChange={(e) =>
                          updateRow(row.id, col.name, e.target.value)
                        }
                      />
                    )}
                  </td>
                ))}
                <td className="p-1 border-b border-subtle last:border-b-0">
                  <button
                    className="w-5 h-5 flex items-center justify-center border-none rounded bg-transparent text-content-subtle text-base cursor-pointer hover:bg-danger-muted hover:text-danger"
                    onClick={() => deleteRow(row.id)}
                    title="Delete row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="w-full px-1.5 py-1.5 border-none bg-surface-alt text-content-muted text-xs cursor-pointer hover:bg-surface-alt hover:text-content transition-colors"
          onClick={addRow}
        >
          + Add Row
        </button>
      </div>
    </div>
  );
}
