import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import Textarea from './ui/Textarea';

interface ProjectInfoModalProps {
  title: string;
  description: string;
  onSave: (title: string, description: string) => void;
  onClose: () => void;
}

export default function ProjectInfoModal({
  title,
  description,
  onSave,
  onClose,
}: ProjectInfoModalProps) {
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedDescription, setEditedDescription] = useState(description);

  // Sync with props when modal opens
  useEffect(() => {
    setEditedTitle(title);
    setEditedDescription(description);
  }, [title, description]);

  const handleSave = () => {
    onSave(editedTitle, editedDescription);
    onClose();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Project Info"
      maxWidth="500px"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-content-muted mb-1">
            Project Title
          </label>
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            placeholder="Untitled Project"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-content-muted mb-1">
            Description
          </label>
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            placeholder="A brief description of this project..."
            rows={3}
          />
        </div>
      </div>
    </Modal>
  );
}
