// src/components/admin/CreateAuthorityModal.tsx

import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import type { CreateAuthorityRequest } from '../../types/user';

interface CreateAuthorityModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  onSubmit:    (payload: CreateAuthorityRequest) => Promise<void>;
  isSubmitting?: boolean;
}

export function CreateAuthorityModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: CreateAuthorityModalProps) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), password });
      setName(''); setEmail(''); setPassword('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create authority.');
    }
  };

  const handleClose = () => {
    setName(''); setEmail(''); setPassword(''); setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Authority User"
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting} fullWidth>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} fullWidth>
            Create Authority
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rajesh Kumar"
          autoFocus
        />
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="authority@tourism.gov.in"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          hint="Authority user will be prompted to change on first login."
        />
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    </Modal>
  );
}