// src/pages/incidents/IncidentDetailPage.tsx

import { useState, useCallback }    from 'react';
import { useParams, useNavigate }   from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Tag,
  Calendar,
  FileText,
  Camera,
} from 'lucide-react';

import {
  useIncident,
  useIncidentTimeline,
  useIncidentMutations,
} from '../../hooks/useIncidents';
import { useZones }               from '../../hooks/useZones';
import { useAuth }                from '../../hooks/useAuth';

import { PageHeader }             from '../../components/ui/SectionHeader';
import { SectionHeader }          from '../../components/ui/SectionHeader';
import { Card, CardBody }         from '../../components/ui/Card';
import { Button }                 from '../../components/common/Button';
import { Modal }                  from '../../components/common/Modal';
import { Badge, IncidentStatusBadge } from '../../components/common/Badge';
import { Loader }                 from '../../components/common/Loader';
import { EmptyState }             from '../../components/common/EmptyState';
import { IncidentTimeline }       from '../../components/incidents/IncidentTimeline';
import { MediaUploader }          from '../../components/media/MediaUploader';

import { IncidentStatus, IncidentSource, MediaType } from '../../types/enums';
import type { ZoneWithStatus }                       from '../../types/zone';
import { formatDateTime, formatDuration }            from '../../utils/formatDate';
import { uploadMediaFull } from '@/api/mediaApi';

// ─────────────────────────────────────────────
// Status transition map
// ─────────────────────────────────────────────

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.OPEN]:        [IncidentStatus.IN_PROGRESS, IncidentStatus.ESCALATED, IncidentStatus.REJECTED],
  [IncidentStatus.IN_PROGRESS]: [IncidentStatus.ESCALATED],
  [IncidentStatus.ESCALATED]:   [IncidentStatus.IN_PROGRESS],
  [IncidentStatus.RESOLVED]:    [],
  [IncidentStatus.CLOSED]:      [],
  [IncidentStatus.CANCELLED]:   [],
  [IncidentStatus.REJECTED]:    [],
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  [IncidentStatus.OPEN]:        'Open',
  [IncidentStatus.IN_PROGRESS]: 'In Progress',
  [IncidentStatus.ESCALATED]:   'Escalated',
  [IncidentStatus.RESOLVED]:    'Resolved',
  [IncidentStatus.CLOSED]:      'Closed',
  [IncidentStatus.CANCELLED]:   'Cancelled',
  [IncidentStatus.REJECTED]:    'Rejected',
};

const SOURCE_LABELS: Record<IncidentSource, string> = {
  [IncidentSource.MOBILE]: 'Mobile App',
  [IncidentSource.IOT]:    'IoT Sensor',
  [IncidentSource.SYSTEM]: 'System',
  [IncidentSource.ML]:     'ML Model',
  [IncidentSource.HEALTH]: 'Health Alert',
};

// ─────────────────────────────────────────────
// Detail field component
// ─────────────────────────────────────────────

function DetailField({
  icon,
  label,
  value,
}: {
  icon:  React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
          {value}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// IncidentDetailPage
// ─────────────────────────────────────────────

export function IncidentDetailPage() {
  const { incidentId }           = useParams<{ incidentId: string }>();
  const navigate                 = useNavigate();
  const { isAdmin, isAuthority } = useAuth();

  const id = incidentId ? parseInt(incidentId, 10) : null;

  const { incident, isLoading, error, refetch }     = useIncident(id);
  const { timeline, isLoading: timelineLoading }    = useIncidentTimeline(id);
  const { zones }                                   = useZones();

  const mutations = useIncidentMutations(() => {
    refetch();
  });

  const [showResolve,        setShowResolve]        = useState(false);
  const [resolutionNote,     setResolutionNote]      = useState('');
  const [showStatusModal,    setShowStatusModal]     = useState(false);
  const [showMediaUploader,  setShowMediaUploader]   = useState(false);

  // ── Zone lookup ──
  const zoneMap = Object.fromEntries((zones as ZoneWithStatus[]).map((z) => [z.id, z.name]));

  // ── Is terminal ──
  const isTerminal = incident
    ? [
        IncidentStatus.RESOLVED,
        IncidentStatus.CLOSED,
        IncidentStatus.CANCELLED,
        IncidentStatus.REJECTED,
      ].includes(incident.status)
    : false;

  const canAct = (isAdmin || isAuthority) && !isTerminal;

  // ── Status update ──
  const handleStatusChange = useCallback(
    async (status: IncidentStatus) => {
      if (!id) return;
      await mutations.updateStatus(id, { status });
      setShowStatusModal(false);
    },
    [id, mutations]
  );

  // ── Resolve ──
  const handleResolve = useCallback(async () => {
    if (!id) return;
    await mutations.resolve(id, { resolution_note: resolutionNote || undefined });
    setShowResolve(false);
    setResolutionNote('');
  }, [id, mutations, resolutionNote]);

  const availableTransitions = incident
    ? VALID_TRANSITIONS[incident.status] ?? []
    : [];

  // ─────────────────────────────────────────
  // Loading / error states
  // ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader size="lg" label="Loading incident…" center />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <EmptyState
        icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
        title="Incident not found"
        message={error ?? 'This incident does not exist or was removed.'}
        action={{ label: 'Back to Incidents', onClick: () => navigate('/incidents') }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Incident #${incident.id}`}
        subtitle={`Reported ${formatDateTime(incident.created_at)} · Duration: ${formatDuration(incident.created_at, incident.resolved_at)}`}
        icon={<AlertTriangle className="w-5 h-5" />}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Incidents', href: '/incidents' },
          { label: `#${incident.id}` },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/incidents')}
            >
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={refetch}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column — main details */}
        <div className="xl:col-span-2 space-y-4">
          {/* Status + actions card */}
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <IncidentStatusBadge status={incident.status} />
                  {incident.is_auto_generated && (
                    <Badge variant="warning" size="sm">Auto-generated</Badge>
                  )}
                  <Badge variant="ghost" size="sm">
                    {SOURCE_LABELS[incident.source]}
                  </Badge>
                </div>

                {canAct && (
                  <div className="flex items-center gap-2">
                    {availableTransitions.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<RefreshCw className="w-4 h-4" />}
                        onClick={() => setShowStatusModal(true)}
                      >
                        Update Status
                      </Button>
                    )}
                    {!isTerminal && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          leftIcon={<CheckCircle className="w-4 h-4" />}
                          onClick={() => setShowResolve(true)}
                        >
                          Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Camera className="w-4 h-4" />}
                          onClick={() => setShowMediaUploader(true)}
                        >
                          Add Media
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {mutations.error && (
                <p className="mt-3 text-xs text-red-500 dark:text-red-400">
                  {mutations.error}
                </p>
              )}
            </CardBody>
          </Card>

          {/* Incident details */}
          <Card>
            <CardBody>
              <SectionHeader
                title="Incident Details"
                icon={<FileText className="w-5 h-5" />}
                size="sm"
                divider
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <DetailField
                  icon={<Tag className="w-4 h-4" />}
                  label="Status"
                  value={<IncidentStatusBadge status={incident.status} />}
                />
                <DetailField
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Source"
                  value={SOURCE_LABELS[incident.source]}
                />
                <DetailField
                  icon={<MapPin className="w-4 h-4" />}
                  label="Zone"
                  value={
                    incident.zone_id
                      ? (zoneMap[incident.zone_id] ?? `Zone ${incident.zone_id}`)
                      : '—'
                  }
                />
                <DetailField
                  icon={<User className="w-4 h-4" />}
                  label="Reported by Tourist"
                  value={incident.tourist_id ? `#${incident.tourist_id}` : 'System'}
                />
                <DetailField
                  icon={<Calendar className="w-4 h-4" />}
                  label="Reported At"
                  value={formatDateTime(incident.created_at)}
                />
                {incident.resolved_at && (
                  <DetailField
                    icon={<CheckCircle className="w-4 h-4" />}
                    label="Resolved At"
                    value={formatDateTime(incident.resolved_at)}
                  />
                )}
              </div>

              {/* Description */}
              <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Description
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {incident.description}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right column — timeline */}
        <div>
          <Card className="h-full">
            <CardBody>
              <SectionHeader
                title="Activity Timeline"
                icon={<Clock className="w-5 h-5" />}
                size="sm"
                divider
              />
              {timelineLoading ? (
                <Loader size="sm" center />
              ) : timeline.length === 0 ? (
                <EmptyState
                  title="No timeline entries"
                  message="Status changes will appear here."
                  compact
                />
              ) : (
                <IncidentTimeline entries={timeline} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Update status modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Incident Status"
        size="sm"
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Select the new status for this incident:
          </p>
          {availableTransitions.map((status) => (
            <Button
              key={status}
              variant={status === IncidentStatus.ESCALATED ? 'danger' : 'secondary'}
              fullWidth
              onClick={() => handleStatusChange(status)}
              loading={mutations.isSubmitting}
            >
              Mark as {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </Modal>

      {/* Resolve modal */}
      <Modal
        isOpen={showResolve}
        onClose={() => { setShowResolve(false); setResolutionNote(''); }}
        title="Resolve Incident"
        description="Add an optional resolution note before marking this incident as resolved."
        size="md"
        footer={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setShowResolve(false)}
              disabled={mutations.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              fullWidth
              loading={mutations.isSubmitting}
              onClick={handleResolve}
            >
              Resolve Incident
            </Button>
          </div>
        }
      >
        <textarea
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          placeholder="Describe how the incident was resolved (optional)…"
          rows={4}
          className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </Modal>

      {/* Media uploader modal */}
      {showMediaUploader && incident && (
        <Modal
          isOpen={showMediaUploader}
          onClose={() => setShowMediaUploader(false)}
          title="Upload Evidence Media"
          size="md"
        >
          <MediaUploader
            incidentId={incident.id}
            mediaType={MediaType.INCIDENT_EVIDENCE_PHOTO}
            onUpload={(file, mediaType, incidentId) =>
              uploadMediaFull(file, { media_type: mediaType, incident_id: incidentId })
            }
            onSuccess={() => setShowMediaUploader(false)}
          />
        </Modal>
      )}
    </div>
  );
}
