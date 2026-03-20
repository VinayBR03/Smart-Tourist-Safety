// src/components/devices/DeviceForm.tsx

import { useState } from 'react';
import { Input, Select } from '../common/Input';
import { Button } from '../common/Button';
import type { DeviceRegisterRequest } from '../../types/device';
import { DeviceType } from '../../types/enums';

interface DeviceFormProps {
  onSubmit:      (payload: DeviceRegisterRequest) => Promise<void>;
  isSubmitting?: boolean;
  onCancel?:     () => void;
}

const TYPE_OPTIONS = Object.values(DeviceType).map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));

export function DeviceForm({ onSubmit, isSubmitting = false, onCancel }: DeviceFormProps) {
  const [deviceId, setDeviceId]   = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>(DeviceType.WRISTBAND);
  const [error, setError]           = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!deviceId.trim()) { setError('Device ID is required.'); return; }
    try {
      await onSubmit({ device_id: deviceId.trim(), device_type: deviceType });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  return (
    <div className="space-y-4">
      <Input
        label="Device ID"
        value={deviceId}
        onChange={(e) => setDeviceId(e.target.value)}
        placeholder="e.g. wristband-001"
        hint="Lowercase, no spaces. Min 3 characters."
      />

      <Select
        label="Device Type"
        value={deviceType}
        onChange={(e) => setDeviceType(e.target.value as DeviceType)}
        options={TYPE_OPTIONS}
      />

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
          ⚠️ The API key is shown only once after registration. Store it securely.
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} fullWidth>
            Cancel
          </Button>
        )}
        <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} fullWidth>
          Register Device
        </Button>
      </div>
    </div>
  );
}