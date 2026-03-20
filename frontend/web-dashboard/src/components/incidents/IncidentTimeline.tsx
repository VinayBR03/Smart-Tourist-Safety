// src/components/incidents/IncidentTimeline.tsx

import React from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/formatDate';
import type { IncidentTimelineEntry } from '../../types/incident';
import { IncidentStatus } from '../../types/enums';

interface IncidentTimelineProps {
  entries:    IncidentTimelineEntry[];
  className?: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  [IncidentStatus.OPEN]:        { color: '#ef4444', icon: <AlertCircle size={14} /> },
  [IncidentStatus.IN_PROGRESS]: { color: '#f97316', icon: <Clock size={14} /> },
  [IncidentStatus.ESCALATED]:   { color: '#dc2626', icon: <AlertCircle size={14} /> },
  [IncidentStatus.RESOLVED]:    { color: '#22c55e', icon: <CheckCircle size={14} /> },
  [IncidentStatus.CLOSED]:      { color: '#94a3b8', icon: <CheckCircle size={14} /> },
  [IncidentStatus.CANCELLED]:   { color: '#94a3b8', icon: <XCircle size={14} /> },
  [IncidentStatus.REJECTED]:    { color: '#ef4444', icon: <XCircle size={14} /> },
};

export function IncidentTimeline({ entries, className = '' }: IncidentTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic py-4">No timeline entries.</p>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Vertical line */}
      <div className="absolute left-[13px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-700" />

      <div className="space-y-5">
        {entries.map((entry, i) => {
          const cfg   = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG[IncidentStatus.OPEN];
          const label = entry.status.replace(/_/g, ' ');

          return (
            <div key={i} className="flex items-start gap-3 relative">
              {/* Node */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                style={{ backgroundColor: cfg.color + '22', color: cfg.color, border: `2px solid ${cfg.color}` }}
              >
                {cfg.icon}
              </div>

              {/* Content */}
              <div className="flex-1 pb-1 pt-0.5">
                <p className="text-sm font-bold capitalize text-slate-800 dark:text-slate-100">
                  {label}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(entry.changed_at)}
                  </span>
                  {entry.changed_by && (
                    <span className="text-xs text-slate-400">
                      by user #{entry.changed_by}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}