import React, { useEffect, useState } from 'react';
import './EditDisplayNameDialog.scss';

interface EditDisplayNameDialogProps {
  isOpen: boolean;
  initialName: string;
  onCancel: () => void;
  onError?: (message: string) => void;
  save: (newName: string) => Promise<void>;
}

const EditDisplayNameDialog: React.FC<EditDisplayNameDialogProps> = ({
  isOpen,
  initialName,
  onCancel,
  onError,
  save,
}) => {
  const [name, setName] = useState(initialName || '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setError(null);
      setBusy(false);
    }
  }, [isOpen, initialName]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    if (isOpen) document.addEventListener('keydown', onEsc, { capture: true });
    return () => document.removeEventListener('keydown', onEsc, { capture: true } as any);
  }, [isOpen, onCancel]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Display name cannot be empty');
      return;
    }
    if (trimmed.length > 50) {
      setError('Display name is too long');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await save(trimmed);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to update name';
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="edit-name-overlay" onClick={onCancel}>
      <div className="edit-name-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Edit display name</h3>
          <button className="close-btn" onClick={onCancel} aria-label="Close">×</button>
        </div>
        <form className="dialog-content" onSubmit={handleSubmit}>
          <label htmlFor="displayName" className="label">Display name</label>
          <input
            id="displayName"
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={busy}
            maxLength={50}
            placeholder="Enter your name"
          />
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="button" className="secondary-btn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDisplayNameDialog;
