// src/pages/incidents/IncidentDetailPage.tsx

import { useState, useCallback, useEffect }  from 'react';
import { useParams, useNavigate }            from 'react-router-dom';
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
  Image,
  Video,
  ExternalLink,
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
import type { IncidentMediaSummary }                 from '../../types/media';
import { formatDate, formatDateTime, formatDuration } from '../../utils/formatDate';
import {
  uploadMediaFull,
  listIncidentMedia,
  getMediaUrl,
} from '../../api/mediaApi';

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
// Detail field
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
// Media gallery
// ─────────────────────────────────────────────

const MEDIA_TYPE_LABELS: Record<string, string> = {
  [MediaType.INCIDENT_EVIDENCE_PHOTO]:   'Evidence Photo',
  [MediaType.INCIDENT_EVIDENCE_VIDEO]:   'Evidence Video',
  [MediaType.INCIDENT_RESOLUTION_PHOTO]: 'Resolution Photo',
  [MediaType.INCIDENT_RESOLUTION_VIDEO]: 'Resolution Video',
};

const EVIDENCE_TYPES  = [MediaType.INCIDENT_EVIDENCE_PHOTO,   MediaType.INCIDENT_EVIDENCE_VIDEO];
const RESOLUTION_TYPES = [MediaType.INCIDENT_RESOLUTION_PHOTO, MediaType.INCIDENT_RESOLUTION_VIDEO];

interface MediaItemProps {
  item: IncidentMediaSummary;
}

function MediaItem({ item }: MediaItemProps) {
  const [url,      setUrl]      = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const isVideo = item.media_type === MediaType.INCIDENT_EVIDENCE_VIDEO ||
                  item.media_type === MediaType.INCIDENT_RESOLUTION_VIDEO;

  const fetchUrl = useCallback(async () => {
    if (url) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    setFetching(true);
    try {
      const res = await getMediaUrl(item.id);
      setUrl(res.url);
      window.open(res.url, '_blank', 'noopener');
    } catch {
      // silently fail
    } finally {
      setFetching(false);
    }
  }, [item.id, url]);

  return (
    <button
      onClick={fetchUrl}
      disabled={fetching}
      className={[
        'flex items-center gap-3 w-full p-3 rounded-xl border text-left transition-all',
        'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
        'hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:shadow-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        fetching ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0">
        {isVideo
          ? <Video className="w-4 h-4 text-purple-500" />
          : <Image className="w-4 h-4 text-blue-500" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {MEDIA_TYPE_LABELS[item.media_type] ?? item.media_type}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {item.content_type} · {formatDate(item.created_at)}
        </p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
    </button>
  );
}

interface MediaGalleryProps {
  incidentId:    number;
  refreshSignal: number;
}

function MediaGallery({ incidentId, refreshSignal }: MediaGalleryProps) {
  const [media,     setMedia]     = useState<IncidentMediaSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const items = await listIncidentMedia(incidentId);
        if (!cancelled) setMedia(items);
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [incidentId, refreshSignal]);

  const evidenceItems   = media.filter((m) => EVIDENCE_TYPES.includes(m.media_type));
  const resolutionItems = media.filter((m) => RESOLUTION_TYPES.includes(m.media_type));

  if (isLoading) {
    return <Loader size="sm" center label="Loading media…" />;
  }

  if (media.length === 0) {
    return (
      <EmptyState
        title="No media attached"
        message="Upload evidence or resolution photos/videos using the buttons above."
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {evidenceItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Evidence ({evidenceItems.length})
          </p>
          <div className="space-y-2">
            {evidenceItems.map((m) => <MediaItem key={m.id} item={m} />)}
          </div>
        </div>
      )}
      {resolutionItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Resolution ({resolutionItems.length})
          </p>
          <div className="space-y-2">
            {resolutionItems.map((m) => <MediaItem key={m.id} item={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// IncidentDetailPage
// ─────────────────────────────────────────────

type UploadMode = 'evidence_photo' | 'evidence_video' | 'resolution_photo' | 'resolution_video';

const UPLOAD_MODE_CONFIG: Record<UploadMode, { label: string; mediaType: MediaType; accept: string }> = {
  evidence_photo:    { label: 'Upload Evidence Photo',    mediaType: MediaType.INCIDENT_EVIDENCE_PHOTO,   accept: 'image/*' },
  evidence_video:    { label: 'Upload Evidence Video',    mediaType: MediaType.INCIDENT_EVIDENCE_VIDEO,   accept: 'video/*' },
  resolution_photo:  { label: 'Upload Resolution Photo',  mediaType: MediaType.INCIDENT_RESOLUTION_PHOTO, accept: 'image/*' },
  resolution_video:  { label: 'Upload Resolution Video',  mediaType: MediaType.INCIDENT_RESOLUTION_VIDEO, accept: 'video/*' },
};

export function IncidentDetailPage() {
  const { incidentId }           = useParams<{ incidentId: string }>();
  const navigate                 = useNavigate();
  const { isAdmin, isAuthority } = useAuth();

  const id = incidentId ? parseInt(incidentId, 10) : null;

  const { incident, isLoading, error, refetch }     = useIncident(id);
  const { timeline, isLoading: timelineLoading }    = useIncidentTimeline(id);
  const { zones }                                   = useZones();

  const mutations = useIncidentMutations(() => { refetch(); });

  const [showResolve,       setShowResolve]       = useState(false);
  const [resolutionNote,    setResolutionNote]     = useState('');
  const [showStatusModal,   setShowStatusModal]    = useState(false);
  const [uploadMode,        setUploadMode]         = useState<UploadMode | null>(null);
  const [mediaRefresh,      setMediaRefresh]       = useState(0);

  // ── Zone lookup ──
  const zoneMap = Object.fromEntries((zones as ZoneWithStatus[]).map((z) => [z.id, z.name]));

  // ── Terminal state ──
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
        title={`Incident ${incident.id}`}
        subtitle={`Reported ${formatDateTime(incident.created_at)} · Duration: ${formatDuration(incident.created_at, incident.resolved_at)}`}
        icon={<AlertTriangle className="w-5 h-5" />}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Incidents', href: '/incidents' },
          { label: `${incident.id}` },
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

          {/* Status + actions */}
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
                  <div className="flex items-center gap-2 flex-wrap">
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
                  value={incident.tourist_id ? `${incident.tourist_id}` : 'System'}
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

          {/* ── Media section ── */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  title="Photos &amp; Videos"
                  icon={<Camera className="w-5 h-5" />}
                  size="sm"
                />
                {/* Upload buttons — always show so any role can view, but canAct controls upload */}
                {canAct && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Image className="w-3.5 h-3.5" />}
                      onClick={() => setUploadMode('evidence_photo')}
                    >
                      Evidence Photo
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Video className="w-3.5 h-3.5" />}
                      onClick={() => setUploadMode('evidence_video')}
                    >
                      Evidence Video
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Image className="w-3.5 h-3.5 text-emerald-500" />}
                      onClick={() => setUploadMode('resolution_photo')}
                    >
                      Resolution Photo
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Video className="w-3.5 h-3.5 text-emerald-500" />}
                      onClick={() => setUploadMode('resolution_video')}
                    >
                      Resolution Video
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <MediaGallery incidentId={incident.id} refreshSignal={mediaRefresh} />
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

      {/* Media upload modal */}
      {uploadMode && incident && (
        <Modal
          isOpen={!!uploadMode}
          onClose={() => setUploadMode(null)}
          title={UPLOAD_MODE_CONFIG[uploadMode].label}
          size="md"
        >
          <MediaUploader
            incidentId={incident.id}
            mediaType={UPLOAD_MODE_CONFIG[uploadMode].mediaType}
            accept={UPLOAD_MODE_CONFIG[uploadMode].accept}
            onUpload={(file, mediaType, incidentId) =>
              uploadMediaFull(file, { media_type: mediaType, incident_id: incidentId })
            }
            onSuccess={() => {
              setUploadMode(null);
              setMediaRefresh((n) => n + 1);
            }}
          />
        </Modal>
      )}
    </div>
  );
}