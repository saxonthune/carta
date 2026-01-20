import { useCallback, useRef, useEffect } from 'react';
import { registry } from '../constructs/registry';
import type { ConstructSchema } from '../constructs/types';

interface AddConstructMenuProps {
  x: number;
  y: number;
  onAdd: (schema: ConstructSchema, x: number, y: number) => void;
  onClose: () => void;
}

export default function AddConstructMenu({
  x,
  y,
  onAdd,
  onClose,
}: AddConstructMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const schemas = registry.getAllSchemas();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleSelect = useCallback(
    (schema: ConstructSchema) => {
      onAdd(schema, x, y);
      onClose();
    },
    [x, y, onAdd, onClose]
  );

  return (
    <div
      ref={menuRef}
      className="fixed bg-surface rounded-lg shadow-xl min-w-[200px] z-[1000] overflow-hidden"
      style={{ left: x, top: y }}
    >
      <div className="px-4 py-3 font-semibold text-content bg-surface-alt border-b border">
        Add Construct
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {schemas.map((schema) => (
          <button
            key={schema.type}
            className="block w-full px-4 py-2.5 border-none border-l-[3px] border-l-transparent bg-surface text-content text-sm text-left cursor-pointer hover:bg-surface-alt transition-all"
            onClick={() => handleSelect(schema)}
            style={{ borderLeftColor: schema.color }}
          >
            {schema.displayName}
          </button>
        ))}
      </div>
      {schemas.length === 0 && (
        <div className="p-5 text-center text-content-subtle">No constructs available</div>
      )}
    </div>
  );
}
