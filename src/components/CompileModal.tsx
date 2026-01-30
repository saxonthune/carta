import { useCallback } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Compiled Output"
      maxWidth="800px"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={handleCopy}>Copy to Clipboard</Button>
          <Button variant="primary" onClick={handleDownload}>Download</Button>
        </div>
      }
    >
      <pre className="m-0 p-4 bg-surface-elevated rounded-lg font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto">
        {output}
      </pre>
    </Modal>
  );
}
