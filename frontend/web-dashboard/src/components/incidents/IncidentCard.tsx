// src/components/incidents/IncidentCard.tsx

import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { IncidentStatusBadge } from '../common/Badge';
import { formatTimeAgo } from '../../utils/formatDate';
import type { IncidentSummary } from '../../types/incident';
import { IncidentSource } from '../../types/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface IncidentCardProps {
  incident:   IncidentSummary;
  zoneName?:  string;
  onClick?:   (incident: IncidentSummary) => void;
  className?: string;
}

// ─────────────────────────────────────────────
// Source label
// ─────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  [IncidentSource.MOBILE]: 'Mobile',
  [IncidentSource.IOT]:    'IoT',
  [IncidentSource.SYSTEM]: 'System',
  [IncidentSource.ML]:     'ML',
  [IncidentSource.HEALTH]: 'Health',
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function IncidentCard({ incident, zoneName, onClick, className = '' }: IncidentCardProps) {
  return (
    <Card
      className={className}
      hoverable
      clickable={!!onClick}
      onClick={() => onClick?.(incident)}
      variant="default"
      padding="md"
    >
      <CardBody className="p-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 flex-shrink-0">
              {incident.is_auto_generated ? (
                <span className="text-amber-500"><AlertTriangle size={15} /></span>
              ) : (
                <span className="text-blue-500"><AlertTriangle size={15} /></span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Incident #{incident.id}
              </p>
              {zoneName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={10} />
                  {zoneName}
                </p>
              )}
            </div>
          </div>
          <IncidentStatusBadge status={incident.status} />
        </div>

        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          {incident.is_auto_generated && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
              Auto
            </span>
          )}
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
            {SOURCE_LABELS[incident.source] ?? incident.source}
          </span>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
            <Clock size={10} />
            {formatTimeAgo(incident.created_at)}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}