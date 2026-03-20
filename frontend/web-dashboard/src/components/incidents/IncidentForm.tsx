// src/components/incidents/IncidentForm.tsx

import { useState } from 'react';
import { Input, Select, Textarea } from '../common/Input';
import { Button } from '../common/Button';
import type { IncidentCreateRequest } from '../../types/incident';
import { IncidentSource } from '../../types/enums';

interface IncidentFormProps {
  onSubmit:      (payload: IncidentCreateRequest) => Promise<void>;
  isSubmitting?: boolean;
  onCancel?:     () => void;
  defaultZoneId?: number;
}

const SOURCE_OPTIONS = Object.values(IncidentSource).map((v) => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));

export function IncidentForm({ onSubmit, isSubmitting = false, onCancel, defaultZoneId }: IncidentFormProps) {
  const [description, setDescription] = useState('');
  const [source, setSource]           = useState<IncidentSource>(IncidentSource.MOBILE);
  const [lat, setLat]                 = useState('');
  const [lng, setLng]                 = useState('');
  const [zoneId, setZoneId]           = useState(defaultZoneId?.toString() ?? '');
  const [error, setError]             = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!description.trim()) { setError('Description is required.'); return; }
    if (!lat && !lng && !zoneId) { setError('Provide GPS coordinates or a Zone ID.'); return; }

    try {
      await onSubmit({
        description,
        source,
        latitude:  lat ? parseFloat(lat) : undefined,
        longitude: lng ? parseFloat(lng) : undefined,
        zone_id:   zoneId ? parseInt(zoneId, 10) : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create incident.');
    }
  };

  return (
    <div className="space-y-4">
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the incident..."
        rows={3}
      />

      <Select
        label="Source"
        value={source}
        onChange={(e) => setSource(e.target.value as IncidentSource)}
        options={SOURCE_OPTIONS}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Latitude (optional)"
          type="number"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="12.9716"
        />
        <Input
          label="Longitude (optional)"
          type="number"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="77.5946"
        />
      </div>

      <Input
        label="Zone ID (optional)"
        type="number"
        value={zoneId}
        onChange={(e) => setZoneId(e.target.value)}
        placeholder="Zone ID if known"
      />

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} fullWidth>
            Cancel
          </Button>
        )}
        <Button variant="danger" onClick={handleSubmit} loading={isSubmitting} fullWidth>
          Report Incident
        </Button>
      </div>
    </div>
  );
}