// src/components/media/MediaThumb.tsx

import { useState } from 'react';
import { FileImage, FileVideo, ExternalLink } from 'lucide-react';
import { formatDate } from '../../utils/formatDate';
import type { IncidentMediaSummary } from '../../types/media';
import { MediaType } from '../../types/enums';

interface MediaThumbProps {
  media:       IncidentMediaSummary;
  presignedUrl?: string;
  onClick?:    (media: IncidentMediaSummary) => void;
  className?:  string;
}

const isVideoType = (t: MediaType) =>
  t === MediaType.INCIDENT_RESOLUTION_VIDEO || t === MediaType.INCIDENT_EVIDENCE_VIDEO;

export function MediaThumb({ media, presignedUrl, onClick, className = '' }: MediaThumbProps) {
  const [imgError, setImgError] = useState(false);
  const isVideo = isVideoType(media.media_type);

  const labelMap: Record<string, string> = {
    [MediaType.INCIDENT_EVIDENCE_PHOTO]:    'Evidence Photo',
    [MediaType.INCIDENT_EVIDENCE_VIDEO]:    'Evidence Video',
    [MediaType.INCIDENT_RESOLUTION_PHOTO]:  'Resolution Photo',
    [MediaType.INCIDENT_RESOLUTION_VIDEO]:  'Resolution Video',
    [MediaType.PROFILE_PHOTO]:              'Profile Photo',
  };

  return (
    <div
      className={[
        'group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700',
        'bg-slate-100 dark:bg-slate-900 cursor-pointer transition-all',
        'hover:shadow-md hover:-translate-y-0.5',
        className,
      ].join(' ')}
      onClick={() => onClick?.(media)}
    >
      {/* Preview */}
      <div className="aspect-square w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
        {presignedUrl && !isVideo && !imgError ? (
          <img
            src={presignedUrl}
            alt={labelMap[media.media_type] ?? 'Media'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            {isVideo ? <FileVideo size={28} /> : <FileImage size={28} />}
          </div>
        )}
      </div>

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ExternalLink size={20} className="text-white" />
      </div>

      {/* Footer */}
      <div className="p-2">
        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">
          {labelMap[media.media_type] ?? media.media_type}
        </p>
        <p className="text-[10px] text-slate-400">{formatDate(media.created_at)}</p>
      </div>
    </div>
  );
}