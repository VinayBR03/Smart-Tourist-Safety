// src/components/health/HealthVitalCard.tsx

import { Heart, Wind, Thermometer } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';

interface HealthVitalCardProps {
  type:       'heart_rate' | 'spo2' | 'temperature';
  value:      number | null | undefined;
  isAlert?:   boolean;
  className?: string;
}

const VITAL_CONFIG = {
  heart_rate: {
    label:   'Heart Rate',
    unit:    'bpm',
    icon:    Heart,
    normal:  [60, 100] as [number, number],
    color:   '#ef4444',
    bgLight: 'bg-red-50 dark:bg-red-950/20',
  },
  spo2: {
    label:   'SpO₂',
    unit:    '%',
    icon:    Wind,
    normal:  [95, 100] as [number, number],
    color:   '#3b82f6',
    bgLight: 'bg-blue-50 dark:bg-blue-950/20',
  },
  temperature: {
    label:   'Body Temp',
    unit:    '°C',
    icon:    Thermometer,
    normal:  [36.1, 37.2] as [number, number],
    color:   '#f97316',
    bgLight: 'bg-orange-50 dark:bg-orange-950/20',
  },
};

export function HealthVitalCard({ type, value, isAlert = false, className = '' }: HealthVitalCardProps) {
  const cfg  = VITAL_CONFIG[type];
  const Icon = cfg.icon;

  const isOutOfRange = value != null &&
    (value < cfg.normal[0] || value > cfg.normal[1]);
  const alertColor = isAlert || isOutOfRange ? '#ef4444' : cfg.color;

  return (
    <Card
      className={className}
      variant={isAlert || isOutOfRange ? 'danger' : 'default'}
      padding="md"
    >
      <CardBody className="p-0">
        <div className="flex items-center justify-between">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bgLight}`}>
            <Icon size={18} style={{ color: alertColor }} />
          </div>
          {(isAlert || isOutOfRange) && (
            <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
              ALERT
            </span>
          )}
        </div>

        <div className="mt-3">
          {value != null ? (
            <p className="text-2xl font-bold" style={{ color: alertColor }}>
              {type === 'temperature' ? value.toFixed(1) : Math.round(value)}
              <span className="text-sm font-normal text-slate-400 ml-1">{cfg.unit}</span>
            </p>
          ) : (
            <p className="text-2xl font-bold text-slate-300 dark:text-slate-600">—</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cfg.label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Normal: {cfg.normal[0]}–{cfg.normal[1]} {cfg.unit}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}