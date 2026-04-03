import { apiClient } from './client';
import type {
  MediaUploadRequest,
  MediaUploadResponse,
  MediaResponse,
} from '@/types/api';

export const mediaApi = {
  requestUpload: (data: MediaUploadRequest) =>
    apiClient.post<MediaUploadResponse>('/media/upload', data).then((r) => r.data),

  confirmUpload: (s3_key: string, media_type: string, incident_id?: number) =>
    apiClient
      .post<MediaResponse>('/media/confirm', { s3_key, media_type, incident_id })
      .then((r) => r.data),

  getUrl: (mediaId: number) =>
    apiClient.get<{ url: string }>(`/media/${mediaId}/url`).then((r) => r.data),

  listMine: () =>
    apiClient.get<MediaResponse[]>('/media/me').then((r) => r.data),

  listForIncident: (incidentId: number) =>
    apiClient.get<MediaResponse[]>(`/media/incident/${incidentId}`).then((r) => r.data),

  // Upload directly to S3 presigned URL
  uploadToS3: async (presignedUrl: string, file: Blob, contentType: string) => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!response.ok) throw new Error('S3 upload failed');
  },
};