// src/api/mediaApi.ts

import { apiClient } from './apiClient';
import type {
  Media,
  IncidentMediaSummary,
  MediaUploadRequest,
  MediaUploadResponse,
  MediaConfirmRequest,
} from '../types/media';

// ─────────────────────────────────────────────
// Generate presigned upload URL
// POST /media/upload
// ─────────────────────────────────────────────

export async function requestUploadUrl(
  payload: MediaUploadRequest
): Promise<MediaUploadResponse> {
  return apiClient.post<MediaUploadResponse>('/media/upload', payload);
}

// ─────────────────────────────────────────────
// Upload file directly to S3 presigned URL
// PUT <presigned_url>
// ─────────────────────────────────────────────

export async function uploadToS3(
  presignedUrl: string,
  file: File
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.statusText}`);
  }
}

// ─────────────────────────────────────────────
// Confirm upload after S3 success
// POST /media/confirm
// ─────────────────────────────────────────────

export async function confirmUpload(payload: MediaConfirmRequest): Promise<Media> {
  return apiClient.post<Media>('/media/confirm', payload);
}

// ─────────────────────────────────────────────
// Get presigned download URL
// GET /media/:id/url
// ─────────────────────────────────────────────

export async function getMediaUrl(mediaId: number): Promise<{ url: string }> {
  return apiClient.get<{ url: string }>(`/media/${mediaId}/url`);
}

// ─────────────────────────────────────────────
// List incident media
// GET /media/incident/:id
// ─────────────────────────────────────────────

export async function listIncidentMedia(
  incidentId: number
): Promise<IncidentMediaSummary[]> {
  return apiClient.get<IncidentMediaSummary[]>(`/media/incident/${incidentId}`);
}

// ─────────────────────────────────────────────
// List my media
// GET /media/me
// ─────────────────────────────────────────────

export async function listMyMedia(): Promise<Media[]> {
  return apiClient.get<Media[]>('/media/me');
}

// ─────────────────────────────────────────────
// Get media by ID
// GET /media/:id
// ─────────────────────────────────────────────

export async function getMedia(mediaId: number): Promise<Media> {
  return apiClient.get<Media>(`/media/${mediaId}`);
}

// ─────────────────────────────────────────────
// Full upload flow (request → S3 → confirm)
// ─────────────────────────────────────────────

export async function uploadMediaFull(
  file: File,
  payload: Omit<MediaUploadRequest, 'content_type' | 'file_size_bytes'>
): Promise<Media> {
  const uploadMeta = await requestUploadUrl({
    ...payload,
    content_type: file.type,
    file_size_bytes: file.size,
  });

  await uploadToS3(uploadMeta.upload_url, file);

  return confirmUpload({
    media_type: payload.media_type,
    s3_key: uploadMeta.s3_key,
    incident_id: payload.incident_id,
  });
}