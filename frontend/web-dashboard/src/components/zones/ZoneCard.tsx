// src/components/zones/ZoneCard.tsx

import { MapPin, Users, Clock, TrendingUp } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { RiskBadge } from '../common/Badge';
import { formatTimeAgo } from '../../utils/formatDate';
import { riskLevelToColor } from '../../utils/mapHelpers';
import type { ZoneWithStatus } from '../../types/zone';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ZoneCardProps {
  zone:          ZoneWithStatus;
  touristCount?: number;
  onClick?:      (zone: ZoneWithStatus) => void;
  className?:    string;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ZoneCard({ zone, touristCount, onClick, className = '' }: ZoneCardProps) {
  const riskColor = riskLevelToColor(zone.risk_level ?? null);

  return (
    <Card
      className={className}
      hoverable
      clickable={!!onClick}
      onClick={() => onClick?.(zone)}
      variant="default"
    >
      {/* Risk accent bar */}
      <div
        className="h-1 rounded-t-xl"
        style={{ backgroundColor: riskColor, opacity: 0.7 }}
      />

      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-slate-400 flex-shrink-0" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {zone.name}
              </p>
            </div>
            {zone.zone_type && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {zone.zone_type}
              </p>
            )}
          </div>

          {zone.risk_level && <RiskBadge level={zone.risk_level} />}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Risk score */}
          {zone.risk_score != null && (
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Score:
              </span>
              <span className="text-xs font-bold" style={{ color: riskColor }}>
                {(zone.risk_score * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {/* Tourist count */}
          {touristCount != null && (
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {touristCount}
              </span>
            </div>
          )}

          {/* Last updated */}
          {zone.status_updated_at && (
            <div className="flex items-center gap-1 ml-auto">
              <Clock size={11} className="text-slate-300" />
              <span className="text-[10px] text-slate-400">
                {formatTimeAgo(zone.status_updated_at)}
              </span>
            </div>
          )}
        </div>

        {/* Active indicator */}
        {!zone.is_active && (
          <div className="mt-2 text-[10px] text-slate-400 italic">Inactive</div>
        )}
      </CardBody>
    </Card>
  );
}