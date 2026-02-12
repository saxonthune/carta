import { memo, useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';

import { List } from '@phosphor-icons/react';
interface CustomNodeData {
  label: string;
  isRenaming?: boolean;
  onRename?: (newLabel: string) => void;
  onDoubleClick?: () => void;
}

interface CustomNodeComponentProps {
  data: CustomNodeData;
  selected?: boolean;
}

const CustomNode = memo(({ data, selected }: CustomNodeComponentProps) => {
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isRenaming, onRename, onDoubleClick } = data;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    setEditValue(data.label);
  }, [data.label]);

  const handleSubmit = () => {
    if (editValue.trim() && onRename) {
      onRename(editValue.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(data.label);
      if (onRename) {
        onRename(data.label);
      }
    }
  };

  const handleBlur = () => {
    handleSubmit();
  };

  return (
    <div className={`bg-white border-2 rounded-lg min-w-[150px] w-full h-full shadow-md overflow-hidden relative flex flex-col ${selected ? 'border-indigo-500 shadow-[0_0_0_2px_#6366f1]' : 'border-gray-200'}`}>
      {selected && (
        <NodeResizer
          minWidth={150}
          minHeight={60}
          lineClassName="!border-indigo-500 !border-2"
          handleClassName="!w-2 !h-2 !bg-indigo-500 !!border-white !rounded-full"
        />
      )}

      <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-2 !h-2" />

      <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-indigo-500 text-white cursor-move select-none border-b border-white/20 w-full shrink-0">
        <List weight="regular" size={20} className="opacity-60" />
        <span className="text-xs opacity-80 uppercase">Node</span>
      </div>

      <div className="p-2 text-sm text-gray-800 flex-1 overflow-y-auto min-h-0">
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="nodrag w-full px-2 py-1 border-2 border-indigo-500 rounded text-sm bg-white text-gray-800 outline-none"
          />
        ) : (
          <div onDoubleClick={onDoubleClick}>{data.label}</div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-2 !h-2" />
    </div>
  );
});

export default CustomNode;
