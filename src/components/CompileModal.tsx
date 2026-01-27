import { useCallback } from 'react';

interface CompileModalProps {
  output: string;
  onClose: () => void;
}

export default function CompileModal({ output, onClose }: CompileModalProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output);
  }, [output]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'constructs-output.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [output]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl w-[90%] max-w-[800px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border">
          <h2 className="m-0 text-lg text-content">Compiled Output</h2>
          <button
            className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          <pre className="m-0 p-4 bg-surface-elevated text-content rounded-lg font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto">
            {output}
          </pre>
        </div>
        <div className="flex gap-2 justify-end px-4 py-3 border-t border">
          <button
            className="px-4 py-2 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={handleCopy}
          >
            Copy to Clipboard
          </button>
          <button
            className="px-4 py-2 border-none rounded-md bg-emerald-500 text-white text-sm font-medium cursor-pointer hover:bg-emerald-600 transition-colors"
            onClick={handleDownload}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
